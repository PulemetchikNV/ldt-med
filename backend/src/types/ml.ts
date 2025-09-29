/**
 * Типы для работы с ML сервисом
 */

export interface MLPredictionResult {
    prediction: string;
    has_tumor: boolean;
    mask_image?: string;
    request_id?: string;
    patient_id?: string;
    total_slices?: number;
    analysis_id?: number;
    error?: string;
}

export interface MLSliceData {
    slice_data: string;
    error?: string;
}

export interface MLPredictionError {
    error: string;
}

export interface MLPredictZipResult {
    message?: string;
    request_id?: string;
    patient_id?: string;
    has_tumor?: boolean;
    prediction?: string;
    total_slices?: number;
    analysis_id?: number;
    error?: string;
}

export type VolumeType = 'original' | 'mask';

export interface MLServiceConfig {
    baseUrl: string;
    analyzeUrl?: string;
    timeout: number;
}

export interface MLAnalyzeResponse {
    analysis: string;
    error?: string;
}

export interface MLClassifyDicomResponse {
    [key: string]: string;
}
