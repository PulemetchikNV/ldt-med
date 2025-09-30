import FormData from 'form-data';
import {
    MLPredictionResult,
    MLSliceData,
    MLPredictZipResult,
    VolumeType,
    MLServiceConfig,
    MLAnalyzeResponse,
    MLClassifyDicomResponse
} from '../types/ml.js';

/**
 * Сервис для работы с ML API
 */
export class MLService {
    private config: MLServiceConfig;

    constructor(config?: MLServiceConfig) {
        const defaultConfig = {
            baseUrl: process.env['ML_SERVICE_URL'] || 'http://ml-service:8000',
            timeout: Number(process.env['ML_TIMEOUT_MS'] || 1200000)
        };
        const analyzeUrl = process.env['ML_ANALYZE_URL'];
        const dicomClassifyUrl = process.env['ML_DICOM_CLASSIFY_URL'];

        this.config = {
            ...defaultConfig,
            ...(analyzeUrl && { analyzeUrl }),
            ...(dicomClassifyUrl && { dicomClassifyUrl }),
            ...config
        };
    }

    /**
     * Анализ текстового промпта с/без файла
     */
    async analyze(textPrompt: string, fileBuffer?: Buffer, filename?: string): Promise<MLAnalyzeResponse> {
        const analyzeUrl = this.config.analyzeUrl;
        if (!analyzeUrl) {
            throw new Error('ML_ANALYZE_URL is not configured');
        }

        const formData = new FormData();
        formData.append('text_prompt', textPrompt);

        if (fileBuffer && filename) {
            formData.append('file', fileBuffer, {
                filename,
                contentType: 'application/octet-stream'
            });
        }

        // Логи запроса
        try {
            console.info('[MLService.analyze] → POST', analyzeUrl);
            console.info('[MLService.analyze] Payload', {
                textPromptPreview: typeof textPrompt === 'string' ? textPrompt.slice(0, 200) : undefined,
                file: fileBuffer && filename ? { filename, size: fileBuffer.length } : null
            });
        } catch {}

        const response = await fetch(analyzeUrl, {
            method: 'POST',
            body: formData as any,
            headers: formData.getHeaders(),
            signal: AbortSignal.timeout(this.config.timeout)
        });

        // Читаем тело ответа один раз, чтобы можно было и залогировать, и вернуть
        let responseBody: unknown;
        try {
            responseBody = await response.json();
        } catch {
            try {
                responseBody = await response.text();
            } catch {
                responseBody = undefined;
            }
        }

        // Логи ответа
        try {
            console.info('[MLService.analyze] ← Response', {
                status: response.status,
                statusText: response.statusText,
                body: responseBody
            });
        } catch {}

        if (!response.ok) {
            const bodyForError = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
            throw new Error(`ML service error: ${response.status} ${response.statusText}; body: ${bodyForError}`);
        }

        return responseBody as MLAnalyzeResponse;
    }

    /**
     * Классификация DICOM файла
     */
    async classifyDicom(fileBuffer: Buffer, filename: string): Promise<MLClassifyDicomResponse> {
        const formData = new FormData();
        formData.append('file', fileBuffer, {
            filename,
            contentType: 'application/dicom'
        });

        const url = `${this.config.dicomClassifyUrl}`;

        // Логи запроса
        try {
            console.info('[MLService.classifyDicom] → POST', url);
            console.info('[MLService.classifyDicom] Payload', {
                file: { filename, size: fileBuffer.length }
            });
        } catch {}

        const response = await fetch(url, {
            method: 'POST',
            body: formData as any,
            headers: formData.getHeaders(),
            signal: AbortSignal.timeout(this.config.timeout)
        });

        // Читаем тело ответа один раз, чтобы можно было и залогировать, и вернуть
        let responseBody: unknown;
        try {
            responseBody = await response.json();
        } catch {
            try {
                responseBody = await response.text();
            } catch {
                responseBody = undefined;
            }
        }

        // Логи ответа
        try {
            console.info('[MLService.classifyDicom] ← Response', {
                status: response.status,
                statusText: response.statusText,
                body: responseBody
            });
        } catch {}

        if (!response.ok) {
            const bodyForError = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
            throw new Error(`ML service error: ${response.status} ${response.statusText}; body: ${bodyForError}`);
        }

        return responseBody as MLClassifyDicomResponse;
    }

    /**
     * Предсказание для NIfTI файла
     */
    async predictNifti(fileBuffer: Buffer, filename: string): Promise<MLPredictionResult> {
        const formData = new FormData();
        formData.append('file', fileBuffer, {
            filename,
            contentType: 'application/octet-stream'
        });

        const response = await fetch(`${this.config.baseUrl}/predict`, {
            method: 'POST',
            body: formData as any,
            headers: formData.getHeaders(),
            signal: AbortSignal.timeout(this.config.timeout)
        });

        if (!response.ok) {
            throw new Error(`ML service error: ${response.status} ${response.statusText}`);
        }

        return response.json() as Promise<MLPredictionResult>;
    }

    /**
     * Предсказание для ZIP архива с DICOM файлами
     */
    async predictZip(fileBuffer: Buffer, filename: string): Promise<MLPredictZipResult> {
        // Создаем multipart/form-data вручную
        const boundary = '----formdata-' + Math.random().toString(36).substring(2);
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\n`),
            Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`),
            Buffer.from(`Content-Type: application/zip\r\n\r\n`),
            fileBuffer,
            Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);

        const response = await fetch(`${this.config.baseUrl}/predict_zip`, {
            method: 'POST',
            body: body,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length.toString()
            },
            signal: AbortSignal.timeout(this.config.timeout)
        });

        if (!response.ok) {
            throw new Error(`ML service error: ${response.status} ${response.statusText}`);
        }

        return response.json() as Promise<MLPredictZipResult>;
    }

    /**
     * Получение среза изображения
     */
    async getSlice(
        patientId: string,
        volumeType: VolumeType,
        sliceIndex: number
    ): Promise<MLSliceData> {
        const response = await fetch(
            `${this.config.baseUrl}/slice/${patientId}/${volumeType}/${sliceIndex}`,
            {
                method: 'GET',
                signal: AbortSignal.timeout(this.config.timeout)
            }
        );

        if (!response.ok) {
            throw new Error(`ML service error: ${response.status} ${response.statusText}`);
        }

        return response.json() as Promise<MLSliceData>;
    }

    /**
     * Проверка состояния ML сервиса
     */
    async healthCheck(): Promise<{ message: string }> {
        const response = await fetch(`${this.config.baseUrl}/`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            throw new Error(`ML service is not available: ${response.status}`);
        }

        return response.json() as Promise<{ message: string }>;
    }

    // ----------------------
    // Доп. методы для ортосрезов и метаданных объёма
    // ----------------------

    private buildQuery(params: Record<string, unknown>): string {
        const sp = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v === undefined || v === null) return;
            sp.set(k, String(v));
        });
        const qs = sp.toString();
        return qs ? `?${qs}` : '';
    }

    /**
     * Получить метаданные объёма (shape, spacing, affine, intensity, доступные тома)
     */
    async getVolumeMeta(
        patientId: string,
        volumeType: 'original' | 'mask' = 'original'
    ): Promise<{ shape: number[]; spacing: number[]; affine: number[][]; intensity: { min: number; max: number }; available_volumes: string[]; error?: string }> {
        const qs = this.buildQuery({ volume_type: volumeType });
        const response = await fetch(`${this.config.baseUrl}/volume/${patientId}/meta${qs}`, {
            method: 'GET',
            signal: AbortSignal.timeout(this.config.timeout)
        });
        if (!response.ok) {
            throw new Error(`ML service error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    /**
     * Получить ортогональные срезы (сагиттальный, корональный, аксиальный) одним запросом
     */
    async getOrthogonalSlices(
        patientId: string,
        params: {
            i: number; j: number; k: number;
            modality?: 'original' | 'mask';
            overlay?: 'mask';
            alpha?: number;
            wl?: number; ww?: number;
            scale?: number;
        }
    ): Promise<{
        indices: { i: number; j: number; k: number };
        sagittal: string; coronal: string; axial: string;
        shape: number[];
        error?: string;
    }> {
        const qs = this.buildQuery({
            i: params.i,
            j: params.j,
            k: params.k,
            modality: params.modality,
            overlay: params.overlay,
            alpha: params.alpha,
            wl: params.wl,
            ww: params.ww,
            scale: params.scale
        });
        const response = await fetch(`${this.config.baseUrl}/orthoslices/${patientId}${qs}`, {
            method: 'GET',
            signal: AbortSignal.timeout(this.config.timeout)
        });
        if (!response.ok) {
            throw new Error(`ML service error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
}
