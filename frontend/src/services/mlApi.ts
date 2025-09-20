/**
 * API сервис для работы с ML функциональностью
 */

export interface MLPredictionResult {
    success: boolean;
    data: {
        prediction: string;
        has_tumor: boolean;
        mask_image?: string;
        request_id?: string;
        patient_id?: string;
        message?: string;
    };
    filename: string;
}

export interface MLSliceResult {
    success: boolean;
    data: {
        slice_data: string;
    };
}

export interface MLHealthResult {
    success: boolean;
    ml_service: {
        message: string;
    };
    timestamp: string;
}

export class MLApiService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    }

    /**
     * Анализ NIfTI файла
     */
    async predictNifti(file: File): Promise<MLPredictionResult> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseUrl}/api/ml/predict/nifti`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка при анализе NIfTI файла');
        }

        return response.json();
    }

    /**
     * Анализ ZIP архива с DICOM файлами
     */
    async predictZip(file: File): Promise<MLPredictionResult> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseUrl}/api/ml/predict/zip`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка при анализе ZIP архива');
        }

        return response.json();
    }

    /**
     * Получение среза изображения
     */
    async getSlice(
        patientId: string,
        volumeType: 'original' | 'mask',
        sliceIndex: number
    ): Promise<MLSliceResult> {
        const response = await fetch(
            `${this.baseUrl}/api/ml/slice/${patientId}/${volumeType}/${sliceIndex}`
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка при получении среза');
        }

        return response.json();
    }

    /**
     * Проверка состояния ML сервиса
     */
    async healthCheck(): Promise<MLHealthResult> {
        const response = await fetch(`${this.baseUrl}/api/ml/health`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'ML сервис недоступен');
        }

        return response.json();
    }
}
