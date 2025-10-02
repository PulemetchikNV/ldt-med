import { promises as fs, Stats } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import AdmZip from 'adm-zip';
import type { IZipEntry } from 'adm-zip';
import dicomParser from 'dicom-parser';
import ExcelJS from 'exceljs';
import { MLService } from '../services/mlService.js';

interface CliOptions {
  inputPath: string;
  outputPath?: string;
}

interface ClassificationRow {
  path_to_study: string;
  study_uid: string | null;
  series_uid: string | null;
  probability_of_pathology: number | null;
  pathology: number | null;
  processing_status: 'Success' | 'Failure';
  time_of_processing: number | null;
  most_dangerous_pathology_type?: string | null;
  pathology_localization?: string | null;
  error_message?: string | null;
}

const SUPPORTED_EXTENSIONS = new Set(['.zip']);

function parseArgs(argv: string[]): CliOptions {
  const [, , ...rest] = argv;
  if (rest.length === 0) {
    throw new Error('Не указан путь до файла или директории. Пример: npm run classify-to-xlsx ./input.zip');
  }

  let inputPath = '';
  let outputPath: string | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--out' || token === '-o') {
      outputPath = rest[i + 1];
      i += 1;
      continue;
    }

    if (!inputPath) {
      inputPath = token;
    }
  }

  if (!inputPath) {
    throw new Error('Не удалось определить входной путь.');
  }

  const resolvedInput = path.resolve(process.cwd(), inputPath);
  const options: CliOptions = { inputPath: resolvedInput };

  if (outputPath) {
    options.outputPath = outputPath;
  }

  return options;
}

async function ensureExists(targetPath: string): Promise<Stats> {
  try {
    return await fs.stat(targetPath);
  } catch (error) {
    throw new Error(`Файл или директория не найдены: ${targetPath}`);
  }
}

function extractDicomMetadata(buffer: Buffer): { studyUid: string | null; seriesUid: string | null } {
  try {
    const zip = new AdmZip(buffer);
    const entries: IZipEntry[] = zip
      .getEntries()
      .filter((entry) => !entry.isDirectory && !entry.entryName.startsWith('__MACOSX'))
      .sort((a, b) => a.entryName.localeCompare(b.entryName));

    let inspected = 0;
    for (const entry of entries) {
      if (inspected >= 25) {
        break;
      }
      inspected += 1;

      const data = entry.getData();
      if (!data || data.length === 0) {
        continue;
      }

      try {
        const byteArray = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        const dataSet = dicomParser.parseDicom(byteArray);
        const studyUid = dataSet.string('x0020000d') ?? null;
        const seriesUid = dataSet.string('x0020000e') ?? null;
        if (studyUid || seriesUid) {
          return { studyUid, seriesUid };
        }
      } catch (dicomError) {
        console.warn(`[classifyToXlsx] Не удалось разобрать DICOM из ${entry.entryName}:`, dicomError);
      }
    }
  } catch (zipError) {
    console.warn('[classifyToXlsx] Не удалось распаковать ZIP для извлечения DICOM метаданных:', zipError);
  }

  return { studyUid: null, seriesUid: null };
}

async function classifyFile(mlService: MLService, filePath: string): Promise<ClassificationRow> {
  const absolutePath = path.resolve(filePath);
  const filename = path.basename(filePath);
  const result: ClassificationRow = {
    path_to_study: absolutePath,
    study_uid: null,
    series_uid: null,
    probability_of_pathology: null,
    pathology: null,
    processing_status: 'Failure',
    time_of_processing: null,
    most_dangerous_pathology_type: null,
    pathology_localization: null,
    error_message: null,
  };

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch (error) {
    result.error_message = `Не удалось прочитать файл: ${(error as Error).message}`;
    return result;
  }

  const { studyUid, seriesUid } = extractDicomMetadata(buffer);
  result.study_uid = studyUid;
  result.series_uid = seriesUid;

  const start = performance.now();

  try {
    const response = await mlService.classifyDicom(buffer, filename);
    const payload = (response as any)?.data ?? response;

    const rawProbability = payload?.max_pathology_probability;
    const rawPrediction = payload?.prediction;

    if (typeof rawProbability === 'string') {
      const numeric = Number.parseFloat(rawProbability.replace('%', ''));
      if (!Number.isNaN(numeric)) {
        result.probability_of_pathology = numeric / 100;
      }
    } else if (typeof rawProbability === 'number') {
      result.probability_of_pathology = rawProbability;
    }

    if (typeof rawPrediction === 'number') {
      result.pathology = rawPrediction;
    } else if (typeof rawPrediction === 'string') {
      const numericPrediction = Number.parseInt(rawPrediction, 10);
      if (!Number.isNaN(numericPrediction)) {
        result.pathology = numericPrediction;
      }
    }

    result.processing_status = 'Success';
  } catch (error) {
    result.error_message = (error as Error).message;
  } finally {
    const durationSeconds = (performance.now() - start) / 1000;
    result.time_of_processing = Number(durationSeconds.toFixed(3));
  }

  return result;
}

async function collectTargets(target: string, stats: Stats): Promise<string[]> {
  if (stats.isDirectory()) {
    const items = await fs.readdir(target);
    const candidates: string[] = [];
    for (const item of items) {
      const fullPath = path.join(target, item);
      try {
        const itemStats = await fs.stat(fullPath);
        if (itemStats.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(fullPath).toLowerCase())) {
          candidates.push(fullPath);
        }
      } catch (error) {
        console.warn(`[classifyToXlsx] Не удалось проверить ${fullPath}:`, error);
      }
    }
    return candidates;
  }

  if (stats.isFile()) {
    if (!SUPPORTED_EXTENSIONS.has(path.extname(target).toLowerCase())) {
      throw new Error('Ожидается ZIP архив с DICOM файлами.');
    }
    return [target];
  }

  throw new Error('Поддерживаются только файлы и директории.');
}

async function writeXlsx(rows: ClassificationRow[], outputPath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('classification');

  worksheet.columns = [
    { header: 'path_to_study', key: 'path_to_study', width: 50 },
    { header: 'study_uid', key: 'study_uid', width: 32 },
    { header: 'series_uid', key: 'series_uid', width: 32 },
    { header: 'probability_of_pathology', key: 'probability_of_pathology', width: 24 },
    { header: 'pathology', key: 'pathology', width: 12 },
    { header: 'processing_status', key: 'processing_status', width: 16 },
    { header: 'time_of_processing', key: 'time_of_processing', width: 18 },
    { header: 'most_dangerous_pathology_type', key: 'most_dangerous_pathology_type', width: 32 },
    { header: 'pathology_localization', key: 'pathology_localization', width: 32 },
    { header: 'error_message', key: 'error_message', width: 40 },
  ];

  rows.forEach((row) => {
    worksheet.addRow(row);
  });

  await workbook.xlsx.writeFile(outputPath);
}

async function main() {
  try {
    const { inputPath, outputPath: explicitOutput } = parseArgs(process.argv);
    const stats = await ensureExists(inputPath);
    const targets = await collectTargets(inputPath, stats);

    if (targets.length === 0) {
      console.warn('Не найдено файлов .zip для обработки.');
      return;
    }

    const mlService = new MLService();
    const rows: ClassificationRow[] = [];

    for (const target of targets) {
      console.info(`[classifyToXlsx] Обрабатываем ${target}`);
      const row = await classifyFile(mlService, target);
      rows.push(row);
    }

    const outputPath = explicitOutput
      ? path.resolve(process.cwd(), explicitOutput)
      : path.join(process.cwd(), `classification-report-${Date.now()}.xlsx`);

    await writeXlsx(rows, outputPath);
    console.info(`Готово. Результат: ${outputPath}`);
  } catch (error) {
    console.error('[classifyToXlsx] Ошибка:', error);
    process.exitCode = 1;
  }
}

void main();
