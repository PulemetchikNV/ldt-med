<template>
  <div class="ml-analysis">
    <header class="page-header">
      <h1>Анализ медицинских изображений</h1>
      <p>Загрузите NIfTI файлы или ZIP архивы с DICOM для анализа опухолей</p>
    </header>
    
    <!-- Проверка состояния ML сервиса -->
    <div class="service-status">
      <div class="status-card" :class="serviceStatusClass">
        <span class="status-icon">{{ serviceStatusIcon }}</span>
        <span class="status-text">{{ serviceStatusText }}</span>
        <button 
          @click="checkServiceHealth" 
          class="refresh-btn"
          :disabled="checkingHealth"
        >
          🔄
        </button>
      </div>
    </div>
    
    <!-- Основной контент -->
    <div class="main-content">
      <!-- Загрузка файла -->
      <div v-if="!analysisResult" class="upload-section">
        <FileUploader 
          @upload-success="onUploadSuccess"
          @upload-error="onUploadError"
          :disabled="false"
        />
        
        <!-- Инструкции -->
        <div class="instructions">
          <h3>Поддерживаемые форматы:</h3>
          <div class="format-list">
            <div class="format-item">
              <strong>NIfTI файлы</strong> (.nii, .nii.gz)
              <p>Стандартный формат для медицинских 3D изображений</p>
            </div>
            <div class="format-item">
              <strong>ZIP архивы</strong> с DICOM файлами
              <p>Архивы, содержащие серии DICOM изображений</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Результаты анализа -->
      <div v-else class="results-section">
        <MLResults 
          :result="analysisResult"
          @new-analysis="startNewAnalysis"
        />
        
        <!-- Трехмерный просмотр для ZIP результатов -->
        <div v-if="showOrthogonalViewer" class="orthogonal-section">
          <OrthogonalViewer
            :images="orthogonalImages"
            :volume-shape="volumeShape"
            :initial-coords="currentCoords"
            :loading="loadingOrthogonal"
            @coords-change="onCoordsChange"
            @plane-click="onPlaneClick"
          />
        </div>
      </div>
    </div>
    
    <!-- История анализов -->
    <div v-if="analysisHistory.length > 0" class="history-section">
      <h3>История анализов</h3>
      <div class="history-list">
        <div 
          v-for="item in analysisHistory" 
          :key="item.id"
          class="history-item"
          @click="loadHistoryItem(item)"
        >
          <div class="history-info">
            <span class="history-filename">{{ item.filename }}</span>
            <span class="history-date">{{ formatDate(item.timestamp) }}</span>
          </div>
          <div class="history-result" :class="{ 'tumor': item.has_tumor }">
            {{ item.prediction }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import FileUploader from '../components/FileUploader.vue';
import MLResults from '../components/MLResults.vue';
import OrthogonalViewer from '../components/OrthogonalViewer.vue';
import { MLApiService } from '../services/mlApi';
import type { MLPredictionResult } from '../services/mlApi';

interface HistoryItem {
  id: string;
  filename: string;
  prediction: string;
  has_tumor: boolean;
  timestamp: Date;
  result: MLPredictionResult;
}

const mlApi = new MLApiService();

// Состояние
const analysisResult = ref<MLPredictionResult | null>(null);
const analysisHistory = ref<HistoryItem[]>([]);
const serviceHealthy = ref<boolean | null>(null);
const checkingHealth = ref(false);

// Состояние для трехмерного просмотра
const showOrthogonalViewer = ref(false);
const orthogonalImages = reactive({
  sagittal: '',
  coronal: '',
  axial: ''
});
const volumeShape = ref<number[]>([0, 0, 0]);
const currentCoords = reactive({ i: 0, j: 0, k: 0 });
const loadingOrthogonal = ref(false);

// Вычисляемые свойства для статуса сервиса
const serviceStatusClass = computed(() => ({
  'status-healthy': serviceHealthy.value === true,
  'status-unhealthy': serviceHealthy.value === false,
  'status-unknown': serviceHealthy.value === null
}));

const serviceStatusIcon = computed(() => {
  if (serviceHealthy.value === true) return '🟢';
  if (serviceHealthy.value === false) return '🔴';
  return '🟡';
});

const serviceStatusText = computed(() => {
  if (serviceHealthy.value === true) return 'ML сервис работает';
  if (serviceHealthy.value === false) return 'ML сервис недоступен';
  return 'Проверяем статус...';
});

// Методы
const checkServiceHealth = async () => {
  checkingHealth.value = true;
  try {
    await mlApi.healthCheck();
    serviceHealthy.value = true;
  } catch (error) {
    serviceHealthy.value = false;
    console.error('ML service health check failed:', error);
  } finally {
    checkingHealth.value = false;
  }
};

const onUploadSuccess = async (result: MLPredictionResult) => {
  analysisResult.value = result;
  
  // Добавляем в историю
  const historyItem: HistoryItem = {
    id: Date.now().toString(),
    filename: result.filename,
    prediction: result.data.prediction,
    has_tumor: result.data.has_tumor,
    timestamp: new Date(),
    result
  };
  
  analysisHistory.value.unshift(historyItem);
  
  // Сохраняем историю в localStorage
  saveHistoryToStorage();
  
  // Если это ZIP результат с patient_id, загружаем метаданные и ортосрезы
  if (result.data.patient_id) {
    await loadOrthogonalData(result.data.patient_id);
  }
};

const onUploadError = (error: string) => {
  console.error('Upload error:', error);
  // Здесь можно добавить уведомление об ошибке
};

const startNewAnalysis = () => {
  analysisResult.value = null;
};

const loadHistoryItem = (item: HistoryItem) => {
  analysisResult.value = item.result;
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const saveHistoryToStorage = () => {
  try {
    const historyData = analysisHistory.value.map(item => ({
      ...item,
      timestamp: item.timestamp.toISOString()
    }));
    localStorage.setItem('ml-analysis-history', JSON.stringify(historyData));
  } catch (error) {
    console.error('Failed to save history:', error);
  }
};

const loadHistoryFromStorage = () => {
  try {
    const stored = localStorage.getItem('ml-analysis-history');
    if (stored) {
      const historyData = JSON.parse(stored);
      analysisHistory.value = historyData.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));
    }
  } catch (error) {
    console.error('Failed to load history:', error);
  }
};

// Методы для трехмерного просмотра
const loadOrthogonalData = async (patientId: string) => {
  try {
    loadingOrthogonal.value = true;
    showOrthogonalViewer.value = true;
    
    // Загружаем метаданные объема
    const meta = await mlApi.getVolumeMeta(patientId);
    if (meta.error) {
      console.error('Failed to load volume metadata:', meta.error);
      return;
    }
    
    volumeShape.value = meta.shape;
    
    // Устанавливаем начальные координаты в центр
    currentCoords.i = Math.floor((meta.shape[0] || 1) / 2);
    currentCoords.j = Math.floor((meta.shape[1] || 1) / 2);
    currentCoords.k = Math.floor((meta.shape[2] || 1) / 2);
    
    // Загружаем начальные ортосрезы
    await loadOrthogonalSlices(patientId);
    
  } catch (error) {
    console.error('Failed to load orthogonal data:', error);
  } finally {
    loadingOrthogonal.value = false;
  }
};

const loadOrthogonalSlices = async (patientId: string) => {
  try {
    const slices = await mlApi.getOrthogonalSlices(patientId, {
      i: currentCoords.i,
      j: currentCoords.j,
      k: currentCoords.k,
      modality: 'original',
      overlay: 'mask',
      alpha: 0.4
    });
    
    if (slices.error) {
      console.error('Failed to load orthogonal slices:', slices.error);
      return;
    }
    
    orthogonalImages.sagittal = slices.sagittal;
    orthogonalImages.coronal = slices.coronal;
    orthogonalImages.axial = slices.axial;
    
  } catch (error) {
    console.error('Failed to load orthogonal slices:', error);
  }
};

const onCoordsChange = async (coords: { i: number; j: number; k: number }) => {
  if (!analysisResult.value?.data.patient_id) return;
  
  currentCoords.i = coords.i;
  currentCoords.j = coords.j;
  currentCoords.k = coords.k;
  
  await loadOrthogonalSlices(analysisResult.value.data.patient_id);
};

const onPlaneClick = async (plane: string, coords: { i: number; j: number; k: number }, pixelCoords: { x: number; y: number }) => {
  console.log(`Clicked on ${plane} plane at coords:`, coords, 'pixel:', pixelCoords);
  
  // Обновляем координаты
  currentCoords.i = coords.i;
  currentCoords.j = coords.j;
  currentCoords.k = coords.k;
  
  // Перезагружаем срезы с новыми координатами
  if (analysisResult.value?.data.patient_id) {
    await loadOrthogonalSlices(analysisResult.value.data.patient_id);
  }
};

// Жизненный цикл
onMounted(() => {
  checkServiceHealth();
  loadHistoryFromStorage();
});
</script>

<style scoped>
.ml-analysis {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 32px;
}

.page-header h1 {
  color: #374151;
  margin-bottom: 8px;
  font-size: 28px;
}

.page-header p {
  color: #6b7280;
  font-size: 16px;
}

.service-status {
  margin-bottom: 24px;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.status-card.status-healthy {
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.status-card.status-unhealthy {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.status-card.status-unknown {
  background-color: #fffbeb;
  border: 1px solid #fed7aa;
  color: #92400e;
}

.refresh-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background-color: rgba(0, 0, 0, 0.1);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.main-content {
  margin-bottom: 40px;
}

.orthogonal-section {
  margin-top: 32px;
  padding-top: 32px;
  border-top: 2px solid #e5e7eb;
}

.upload-section {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.instructions {
  background-color: #f9fafb;
  padding: 24px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.instructions h3 {
  color: #374151;
  margin-bottom: 16px;
}

.format-list {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

.format-item {
  padding: 16px;
  background-color: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.format-item strong {
  display: block;
  color: #374151;
  margin-bottom: 4px;
}

.format-item p {
  color: #6b7280;
  font-size: 14px;
  margin: 0;
}

.history-section {
  margin-top: 40px;
  padding-top: 32px;
  border-top: 2px solid #e5e7eb;
}

.history-section h3 {
  color: #374151;
  margin-bottom: 16px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.history-item:hover {
  background-color: #f9fafb;
  border-color: #d1d5db;
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-filename {
  font-weight: 500;
  color: #374151;
}

.history-date {
  font-size: 12px;
  color: #6b7280;
}

.history-result {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background-color: #f0fdf4;
  color: #166534;
}

.history-result.tumor {
  background-color: #fef2f2;
  color: #dc2626;
}

@media (max-width: 768px) {
  .ml-analysis {
    padding: 16px;
  }
  
  .format-list {
    grid-template-columns: 1fr;
  }
  
  .history-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
