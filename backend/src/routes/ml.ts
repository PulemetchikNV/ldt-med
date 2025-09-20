import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MLService } from '../services/mlService.js';
import { VolumeType } from '../types/ml.js';

/**
 * Интерфейсы для параметров роутов
 */
interface SliceParams {
    patientId: string;
    volumeType: VolumeType;
    sliceIndex: string;
}

/**
 * Роуты для работы с ML сервисом анализа опухолей
 */
export default async function mlRoutes(
    fastify: FastifyInstance,
    options: any
): Promise<void> {
    const mlService = new MLService();

    /**
     * POST /api/ml/predict/nifti - Анализ NIfTI файла
     */
    fastify.post('/predict/nifti', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const data = await request.file();

            if (!data) {
                return reply.code(400).send({ error: 'Файл не предоставлен' });
            }

            // Проверяем расширение файла
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

            return reply.code(200).send({
                success: true,
                data: result,
                filename
            });

        } catch (error) {
            fastify.log.error('Ошибка при обработке NIfTI файла:', error);
            return reply.code(500).send({
                error: 'Ошибка при обработке файла',
                details: error instanceof Error ? error.message : 'Неизвестная ошибка'
            });
        }
    });

    /**
     * POST /api/ml/predict/zip - Анализ ZIP архива с DICOM файлами
     */
    fastify.post('/predict/zip', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const data = await request.file();

            if (!data) {
                return reply.code(400).send({ error: 'Файл не предоставлен' });
            }

            // Проверяем расширение файла
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

            return reply.code(200).send({
                success: true,
                data: result,
                filename
            });

        } catch (error) {
            fastify.log.error('Ошибка при обработке ZIP архива:', error);
            return reply.code(500).send({
                error: 'Ошибка при обработке архива',
                details: error instanceof Error ? error.message : 'Неизвестная ошибка'
            });
        }
    });

    /**
     * GET /api/ml/slice/:patientId/:volumeType/:sliceIndex - Получение среза изображения
     */
    fastify.get<{ Params: SliceParams }>(
        '/slice/:patientId/:volumeType/:sliceIndex',
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
                fastify.log.error('Ошибка при получении среза:', error);
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
            fastify.log.error('ML сервис недоступен:', error);
            return reply.code(503).send({
                error: 'ML сервис недоступен',
                details: error instanceof Error ? error.message : 'Неизвестная ошибка',
                timestamp: new Date().toISOString()
            });
        }
    });
}
