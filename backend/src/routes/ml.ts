import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MLService } from '../services/mlService.js';
import { VolumeType } from '../types/ml.js';
import prisma from '../lib/prisma.js';
import { AnalysisType, Prisma } from '../generated/prisma/index.js';
import type { Analysis } from '../generated/prisma/index.js';

/**
 * Интерфейсы для параметров роутов
 */
interface SliceParams {
    patientId: string;
    volumeType: VolumeType;
    sliceIndex: string;
}

interface VolumeMetaParams {
    patientId: string;
}

interface OrthogonalSlicesParams {
    patientId: string;
}

interface AnalysisIdParams {
    id: string;
}

interface AuthenticatedUser {
    userId: number;
    email: string;
}

const getAuthenticatedUser = (request: FastifyRequest): AuthenticatedUser => {
    const payload = request.user as AuthenticatedUser | undefined;
    if (!payload?.userId) {
        throw new Error('Отсутствует пользователь в JWT');
    }
    return payload;
};

const sanitizeMetadata = (result: unknown): Prisma.InputJsonValue | undefined => {
    if (!result || typeof result !== 'object') {
        return undefined;
    }

    const clone: Record<string, unknown> = { ...(result as Record<string, unknown>) };
    delete clone['mask'];
    delete clone['original_slice'];
    delete clone['slice_data'];
    delete clone['axial'];
    delete clone['sagittal'];
    delete clone['coronal'];
    return clone as Prisma.InputJsonValue;
};

const toNullableBoolean = (value: unknown): boolean | null =>
    typeof value === 'boolean' ? value : null;

const toOptionalString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.length > 0 ? value : undefined;

const persistAnalysis = async (params: {
    userId: number;
    analysisType: AnalysisType;
    filename?: string;
    result: Record<string, unknown>;
}) => {
    const metadata = sanitizeMetadata(params.result);
    const hasTumorValue = toNullableBoolean(params.result['has_tumor']);
    const analysis = await prisma.analysis.create({
        data: {
            userId: params.userId,
            analysisType: params.analysisType,
            inputFilename: params.filename ?? null,
            patientId: toOptionalString(params.result['patient_id']) ?? null,
            requestId: toOptionalString(params.result['request_id']) ?? null,
            prediction: toOptionalString(params.result['prediction']) ?? null,
            ...(hasTumorValue !== null ? { hasTumor: hasTumorValue } : {}),
            ...(metadata !== undefined ? { metadata } : {}),
        }
    });

    return analysis;
};

const mapAnalysisResponse = (analysis: Analysis | null) => {
    if (!analysis) {
        return null;
    }
    const { id, analysisType, inputFilename, patientId, requestId, prediction, hasTumor, createdAt, updatedAt, metadata } = analysis;
    return {
        id,
        analysisType,
        inputFilename,
        patientId,
        requestId,
        prediction,
        hasTumor,
        createdAt,
        updatedAt,
        metadata
    };
};

const ensurePatientOwnership = async (userId: number, patientId: string): Promise<Analysis | null> => {
    const analysis = await prisma.analysis.findFirst({
        where: {
            userId,
            patientId
        }
    });

    return analysis;
};

/**
 * Роуты для работы с ML сервисом анализа опухолей
 */
export default async function mlRoutes(
    fastify: FastifyInstance,
    options: any
): Promise<void> {
    const mlService = new MLService();

    fastify.get('/analyses', {
        preHandler: [fastify.authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = getAuthenticatedUser(request);
        const analyses = await prisma.analysis.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        return reply.send({
            success: true,
            data: analyses.map(mapAnalysisResponse)
        });
    });

    fastify.get<{ Params: AnalysisIdParams }>('/analyses/:id', {
        preHandler: [fastify.authenticate]
    }, async (request: FastifyRequest<{ Params: AnalysisIdParams }>, reply: FastifyReply) => {
        const { userId } = getAuthenticatedUser(request);
        const id = Number(request.params.id);

        if (!Number.isFinite(id)) {
            return reply.code(400).send({ error: 'Некорректный идентификатор анализа' });
        }

        const analysis = await prisma.analysis.findFirst({
            where: { id, userId }
        });

        if (!analysis) {
            return reply.code(404).send({ error: 'Анализ не найден' });
        }

        return reply.send({
            success: true,
            data: mapAnalysisResponse(analysis)
        });
    });

    /**
     * POST /api/ml/predict/nifti - Анализ NIfTI файла
     */
    fastify.post('/predict/nifti', {
        preHandler: [fastify.authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const data = await request.file();

            if (!data) {
                return reply.code(400).send({ error: 'Файл не предоставлен' });
            }

            const filename = data.filename;
            const isNifti = filename.endsWith('.nii') || filename.endsWith('.nii.gz');

            if (!isNifti) {
                return reply.code(400).send({
                    error: 'Поддерживаются только файлы формата NIfTI (.nii, .nii.gz)'
                });
            }

            const fileBuffer = await data.toBuffer();

            fastify.log.info(`Обработка NIfTI файла: ${filename}, размер: ${fileBuffer.length} байт`);

            const result = await mlService.predictNifti(fileBuffer, filename);

            if ((result as any)?.error) {
                return reply.code(400).send({
                    error: 'Ошибка обработки ML сервиса',
                    details: (result as any).error
                });
            }

            const user = getAuthenticatedUser(request);
            const resultObject = { ...(result as unknown as Record<string, unknown>) };
            const analysis = await persistAnalysis({
                userId: user.userId,
                analysisType: AnalysisType.NIFTI,
                filename,
                result: resultObject
            });

            const responseData = {
                ...resultObject,
                analysis_id: analysis.id
            };

            return reply.code(200).send({
                success: true,
                data: responseData,
                filename,
                analysisId: analysis.id
            });

        } catch (error) {
            fastify.log.error({ err: error }, 'Ошибка при обработке NIfTI файла');
            return reply.code(500).send({
                error: 'Ошибка при обработке файла',
                details: error instanceof Error ? error.message : 'Неизвестная ошибка'
            });
        }
    });

    /**
     * POST /api/ml/classify-dicom - Классификация DICOM файла
     */
    fastify.post('/classify-dicom', {
        preHandler: [fastify.authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        console.log('CLASSIFY DICOM');
        try {
            const data = await request.file();

            if (!data) {
                return reply.code(400).send({ error: 'Файл не предоставлен' });
            }

            const filename = data.filename;
            const supportedExtensions = ['.dcm', '.zip'];
            if (!supportedExtensions.some(ext => filename.toLowerCase().endsWith(ext))) {
                return reply.code(400).send({
                    error: 'Поддерживаются только файлы формата DICOM (.dcm) и ZIP (.zip)'
                });
            }

            const fileBuffer = await data.toBuffer();

            fastify.log.info(`Обработка DICOM файла: ${filename}, размер: ${fileBuffer.length} байт`);

            const result = await mlService.classifyDicom(fileBuffer, filename);

            if ((result as any)?.error) {
                return reply.code(400).send({
                    error: 'Ошибка обработки ML сервиса',
                    details: (result as any).error
                });
            }

            return reply.code(200).send({
                success: true,
                data: result
            });

        } catch (error) {
            fastify.log.error({ err: error }, 'Ошибка при классификации DICOM');
            return reply.code(500).send({
                error: 'Ошибка при классификации файла',
                details: error instanceof Error ? error.message : 'Неизвестная ошибка'
            });
        }
    });

    /**
     * POST /api/ml/predict/zip - Анализ ZIP архива с DICOM файлами
     */
    fastify.post('/predict/zip', {
        preHandler: [fastify.authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const data = await request.file();

            if (!data) {
                return reply.code(400).send({ error: 'Файл не предоставлен' });
            }

            const filename = data.filename;
            const isZip = filename.endsWith('.zip');

            if (!isZip) {
                return reply.code(400).send({
                    error: 'Поддерживаются только ZIP архивы с DICOM файлами'
                });
            }

            const fileBuffer = await data.toBuffer();

            fastify.log.info(`Обработка ZIP архива: ${filename}, размер: ${fileBuffer.length} байт`);

            const result = await mlService.predictZip(fileBuffer, filename);

            if ((result as any)?.error) {
                return reply.code(400).send({
                    error: 'Ошибка обработки ML сервиса',
                    details: (result as any).error
                });
            }

            const user = getAuthenticatedUser(request);
            const resultObject = { ...(result as unknown as Record<string, unknown>) };
            const analysis = await persistAnalysis({
                userId: user.userId,
                analysisType: AnalysisType.DICOM_ZIP,
                filename,
                result: resultObject
            });

            const responseData = {
                ...resultObject,
                analysis_id: analysis.id
            };

            return reply.code(200).send({
                success: true,
                data: responseData,
                filename,
                analysisId: analysis.id
            });

        } catch (error) {
            fastify.log.error({ err: error }, 'Ошибка при обработке ZIP архива');
            return reply.code(500).send({
                error: 'Ошибка при обработке архива',
                details: error instanceof Error ? error.message : 'Неизвестная ошибка'
            });
        }
    });

    /**
     * POST /api/ml/analyze - Анализ с текстовым промптом (и опционально файлом)
     */
    fastify.post('/analyze', {
        preHandler: [fastify.authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const parts = request.parts();
            let textPrompt: string | undefined;
            let fileBuffer: Buffer | undefined;
            let filename: string | undefined;

            for await (const part of parts) {
                if (part.type === 'field' && part.fieldname === 'text_prompt') {
                    textPrompt = part.value as string;
                }
                if (part.type === 'file' && part.fieldname === 'file') {
                    filename = part.filename;
                    fileBuffer = await part.toBuffer();
                }
            }

            if (!textPrompt) {
                return reply.code(400).send({ error: 'Поле text_prompt обязательно' });
            }

            fastify.log.info(`Запрос на анализ: промпт="${textPrompt}", файл=${filename || 'нет'}`);

            const result = await mlService.analyze(textPrompt, fileBuffer, filename);

            if ((result as any)?.error) {
                return reply.code(400).send({
                    error: 'Ошибка обработки ML сервиса',
                    details: (result as any).error
                });
            }

            return reply.code(200).send({
                success: true,
                data: result
            });

        } catch (error) {
            fastify.log.error({ err: error }, 'Ошибка при выполнении анализа');
            return reply.code(500).send({
                error: 'Ошибка при выполнении анализа',
                details: error instanceof Error ? error.message : 'Неизвестная ошибка'
            });
        }
    });

    /**
     * GET /api/ml/slice/:patientId/:volumeType/:sliceIndex - Получение среза изображения
     */
    fastify.get<{ Params: SliceParams }>(
        '/slice/:patientId/:volumeType/:sliceIndex',
        {
            preHandler: [fastify.authenticate]
        },
        async (request: FastifyRequest<{ Params: SliceParams }>, reply: FastifyReply) => {
            try {
                const { patientId, volumeType, sliceIndex } = request.params;

                // Валидация параметров
                if (!patientId || !volumeType || !sliceIndex) {
                    return reply.code(400).send({
                        error: 'Необходимы параметры: patientId, volumeType, sliceIndex'
                    });
                }

                if (!['original', 'mask'].includes(volumeType)) {
                    return reply.code(400).send({
                        error: 'volumeType должен быть "original" или "mask"'
                    });
                }

                const sliceIndexNum = parseInt(sliceIndex, 10);
                if (isNaN(sliceIndexNum) || sliceIndexNum < 0) {
                    return reply.code(400).send({
                        error: 'sliceIndex должен быть положительным числом'
                    });
                }

                const { userId } = getAuthenticatedUser(request);
                const analysis = await ensurePatientOwnership(userId, patientId);

                if (!analysis) {
                    return reply.code(404).send({ error: 'Анализ не найден или недоступен' });
                }

                fastify.log.info(`Запрос среза: пациент=${patientId}, тип=${volumeType}, индекс=${sliceIndexNum}`);

                const result = await mlService.getSlice(patientId, volumeType as VolumeType, sliceIndexNum);

                if (result.error) {
                    return reply.code(404).send({ error: result.error });
                }

                return reply.code(200).send({
                    success: true,
                    data: result
                });

            } catch (error) {
                fastify.log.error({ err: error }, 'Ошибка при получении среза');
                return reply.code(500).send({
                    error: 'Ошибка при получении среза',
                    details: error instanceof Error ? error.message : 'Неизвестная ошибка'
                });
            }
        }
    );

/**
 * GET /api/ml/health - Проверка состояния ML сервиса
 */
fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const result = await mlService.healthCheck();

        return reply.code(200).send({
            success: true,
            ml_service: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        fastify.log.error({ err: error }, 'ML сервис недоступен');
        return reply.code(503).send({
            error: 'ML сервис недоступен',
            details: error instanceof Error ? error.message : 'Неизвестная ошибка',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/ml/volume/:patientId/meta - Получение метаданных объема
 */
fastify.get<{ Params: VolumeMetaParams; Querystring: { volume_type?: string } }>(
    '/volume/:patientId/meta',
    {
        preHandler: [fastify.authenticate]
    },
    async (request: FastifyRequest<{ Params: VolumeMetaParams; Querystring: { volume_type?: string } }>, reply: FastifyReply) => {
        try {
            const { patientId } = request.params;
            const { volume_type = 'original' } = request.query;

            if (!patientId) {
                return reply.code(400).send({
                    error: 'Необходим параметр patientId'
                });
            }

            const { userId } = getAuthenticatedUser(request);
            const analysis = await ensurePatientOwnership(userId, patientId);

            if (!analysis) {
                return reply.code(404).send({ error: 'Анализ не найден или недоступен' });
            }

            if (!['original', 'mask'].includes(volume_type)) {
                return reply.code(400).send({
                    error: 'volume_type должен быть "original" или "mask"'
                });
            }

            fastify.log.info(`Запрос метаданных объема: пациент=${patientId}, тип=${volume_type}`);

            const result = await mlService.getVolumeMeta(patientId, volume_type as 'original' | 'mask');

            if (result.error) {
                return reply.code(404).send({ error: result.error });
            }

            return reply.code(200).send(result);

        } catch (error) {
            fastify.log.error({ err: error }, 'Ошибка при получении метаданных объема');
            return reply.code(500).send({
                error: 'Ошибка при получении метаданных объема',
                details: error instanceof Error ? error.message : 'Неизвестная ошибка'
            });
        }
    }
);

/**
 * GET /api/ml/orthoslices/:patientId - Получение ортогональных срезов
 */
fastify.get<{
    Params: OrthogonalSlicesParams;
    Querystring: {
        i: string;
        j: string;
        k: string;
        modality?: string;
        overlay?: string;
        alpha?: string;
        wl?: string;
        ww?: string;
        scale?: string;
    }
}>(
    '/orthoslices/:patientId',
    {
        preHandler: [fastify.authenticate]
    },
    async (request: FastifyRequest<{
        Params: OrthogonalSlicesParams;
        Querystring: {
            i: string;
            j: string;
            k: string;
            modality?: string;
            overlay?: string;
            alpha?: string;
            wl?: string;
            ww?: string;
            scale?: string;
        }
    }>, reply: FastifyReply) => {
        try {
            const { patientId } = request.params;
            const {
                i, j, k,
                modality = 'original',
                overlay,
                alpha,
                wl, ww,
                scale
            } = request.query;

            if (!patientId) {
                return reply.code(400).send({
                    error: 'Необходим параметр patientId'
                });
            }

            const { userId } = getAuthenticatedUser(request);
            const analysis = await ensurePatientOwnership(userId, patientId);

            if (!analysis) {
                return reply.code(404).send({ error: 'Анализ не найден или недоступен' });
            }

            // Валидация координат
            const iNum = parseInt(i, 10);
            const jNum = parseInt(j, 10);
            const kNum = parseInt(k, 10);

            if (isNaN(iNum) || isNaN(jNum) || isNaN(kNum)) {
                return reply.code(400).send({
                    error: 'Координаты i, j, k должны быть числами'
                });
            }

            if (iNum < 0 || jNum < 0 || kNum < 0) {
                return reply.code(400).send({
                    error: 'Координаты i, j, k должны быть неотрицательными'
                });
            }

            // Валидация опциональных параметров
            if (modality && !['original', 'mask'].includes(modality)) {
                return reply.code(400).send({
                    error: 'modality должен быть "original" или "mask"'
                });
            }

            if (overlay && overlay !== 'mask') {
                return reply.code(400).send({
                    error: 'overlay должен быть "mask" или не указан'
                });
            }

            const params: {
                i: number;
                j: number;
                k: number;
                modality?: 'original' | 'mask';
                overlay?: 'mask';
                alpha?: number;
                wl?: number;
                ww?: number;
                scale?: number;
            } = {
                i: iNum,
                j: jNum,
                k: kNum
            };

            params.modality = modality as 'original' | 'mask';
            if (overlay) {
                params.overlay = 'mask';
            }
            if (alpha !== undefined) {
                const alphaNum = parseFloat(alpha);
                if (!Number.isNaN(alphaNum)) {
                    params.alpha = alphaNum;
                }
            }
            if (wl !== undefined) {
                const wlNum = parseFloat(wl);
                if (!Number.isNaN(wlNum)) {
                    params.wl = wlNum;
                }
            }
            if (ww !== undefined) {
                const wwNum = parseFloat(ww);
                if (!Number.isNaN(wwNum)) {
                    params.ww = wwNum;
                }
            }
            if (scale !== undefined) {
                const scaleNum = parseFloat(scale);
                if (!Number.isNaN(scaleNum)) {
                    params.scale = scaleNum;
                }
            }

            fastify.log.info(`Запрос ортогональных срезов: пациент=${patientId}, координаты=${iNum},${jNum},${kNum}`);

            const result = await mlService.getOrthogonalSlices(patientId, params);

            if (result.error) {
                return reply.code(404).send({ error: result.error });
            }

            return reply.code(200).send(result);

        } catch (error) {
            fastify.log.error({ err: error }, 'Ошибка при получении ортогональных срезов');
            return reply.code(500).send({
                error: 'Ошибка при получении ортогональных срезов',
                details: error instanceof Error ? error.message : 'Неизвестная ошибка'
            });
        }
    }
);
}
