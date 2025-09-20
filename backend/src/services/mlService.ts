import FormData from 'form-data';
import {
    MLPredictionResult,
    MLSliceData,
    MLPredictZipResult,
    VolumeType,
    MLServiceConfig
} from '../types/ml.js';

/**
 * Сервис для работы с ML API
 */
export class MLService {
    private config: MLServiceConfig;

    constructor(config: MLServiceConfig = {
        baseUrl: process.env.ML_SERVICE_URL || 'http://ml:8000',
        timeout: 300000 // 5 минут для обработки больших файлов
    }) {
        this.config = config;
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
            body: formData,
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
        const formData = new FormData();
        formData.append('file', fileBuffer, {
            filename,
            contentType: 'application/zip'
        });

        const response = await fetch(`${this.config.baseUrl}/predict_zip`, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders(),
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
}
