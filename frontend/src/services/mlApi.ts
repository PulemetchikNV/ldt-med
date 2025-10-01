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
        total_slices?: number;
        analysis_id?: number;
    };
    filename: string;
    analysisId?: number;
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

export interface MLVolumeMeta {
    shape: number[];
    spacing: number[];
    affine: number[][];
    intensity: {
        min: number;
        max: number;
    };
    available_volumes: string[];
    error?: string;
}

export interface MLOrthogonalSlices {
    indices: {
        i: number;
        j: number;
        k: number;
    };
    sagittal: string;
    coronal: string;
    axial: string;
    shape: number[];
    error?: string;
}

export interface MLAnalyzeResult {
    success: boolean;
    data: {
        analysis: string;
    };
}

export interface MLClassifyDicomResult {
    success: boolean;
    data: {
        [key: string]: string;
    };
}

export interface AnalysisRecord {
    id: number;
    analysisType: 'NIFTI' | 'DICOM_ZIP';
    inputFilename: string | null;
    patientId: string | null;
    requestId: string | null;
    prediction: string | null;
    hasTumor: boolean | null;
    createdAt: string;
    updatedAt: string;
    metadata?: unknown;
}

import { axiosInstance } from '../plugins/axios';

export class MLApiService {
    /**
     * Анализ с текстовым промптом (и опционально файлом)
     */
    async analyze(textPrompt: string, file?: File): Promise<MLAnalyzeResult> {
        const formData = new FormData();
        formData.append('text_prompt', textPrompt);
        if (file) {
            formData.append('file', file);
        }

        try {
            const response = await axiosInstance.post<MLAnalyzeResult>('/api/ml/analyze', formData);
            return response.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Ошибка при выполнении анализа');
        }
    }

    /**
     * Классификация DICOM файла
     */
    async classifyDicom(file: File): Promise<MLClassifyDicomResult> {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axiosInstance.post<MLClassifyDicomResult>(
                '/api/ml/classify-dicom',
                formData
            );
            return response.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Ошибка при классификации DICOM файла');
        }
    }

    /**
     * Анализ NIfTI файла
     */
    async predictNifti(file: File): Promise<MLPredictionResult> {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axiosInstance.post<MLPredictionResult>(
                '/api/ml/predict/nifti',
                formData
            );
            return response.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Ошибка при анализе NIfTI файла');
        }
    }

    /**
     * Анализ ZIP архива с DICOM файлами
     */
    async predictZip(file: File): Promise<MLPredictionResult> {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axiosInstance.post<MLPredictionResult>(
                '/api/ml/predict/zip',
                formData
            );
            return response.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Ошибка при анализе ZIP архива');
        }
    }

    /**
     * Получение среза изображения
     */
    async getSlice(
        patientId: string,
        volumeType: 'original' | 'mask',
        sliceIndex: number
    ): Promise<MLSliceResult> {
        try {
            const response = await axiosInstance.get<MLSliceResult>(
                `/api/ml/slice/${patientId}/${volumeType}/${sliceIndex}`
            );
            return response.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Ошибка при получении среза');
        }
    }

    /**
     * Проверка состояния ML сервиса
     */
    async healthCheck(): Promise<MLHealthResult> {
        try {
            const response = await axiosInstance.get<MLHealthResult>('/api/ml/health');
            return response.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'ML сервис недоступен');
        }
    }

    /**
     * Получение метаданных объема
     */
    async getVolumeMeta(
        patientId: string,
        volumeType: 'original' | 'mask' = 'original'
    ): Promise<MLVolumeMeta> {
        try {
            const response = await axiosInstance.get<MLVolumeMeta>(
                `/api/ml/volume/${patientId}/meta`,
                {
                    params: { volume_type: volumeType }
                }
            );
            return response.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Ошибка при получении метаданных объема');
        }
    }

    /**
     * Получение ортогональных срезов
     */
    async getOrthogonalSlices(
        patientId: string,
        params: {
            i: number;
            j: number;
            k: number;
            modality?: 'original' | 'mask';
            overlay?: 'mask';
            alpha?: number;
            wl?: number;
            ww?: number;
            scale?: number;
        }
    ): Promise<MLOrthogonalSlices> {
        try {
            const response = await axiosInstance.get<MLOrthogonalSlices>(
                `/api/ml/orthoslices/${patientId}`,
                { params }
            );
            return response.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Ошибка при получении ортогональных срезов');
        }
    }

    async listAnalyses(): Promise<{ success: boolean; data: AnalysisRecord[] }> {
        try {
            const response = await axiosInstance.get<{ success: boolean; data: AnalysisRecord[] }>(
                '/api/ml/analyses'
            );
            return response.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Не удалось получить список анализов');
        }
    }

    async getAnalysis(id: number): Promise<{ success: boolean; data: AnalysisRecord }> {
        try {
            const response = await axiosInstance.get<{ success: boolean; data: AnalysisRecord }>(
                `/api/ml/analyses/${id}`
            );
            return response.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Анализ не найден');
        }
    }
}
