<template>
  <div class="ml-results">
    <div class="results-header">
      <h2>Результаты анализа</h2>
      <div class="file-info">
        <span class="filename">📄 {{ result.filename }}</span>
      </div>
    </div>
    
    <div class="prediction-result">
      <div class="prediction-card" :class="predictionClass">
        <div class="prediction-icon">
          {{ result.data.has_tumor ? '⚠️' : '✅' }}
        </div>
        <div class="prediction-text">
          <h3>{{ result.data.prediction }}</h3>
          <p>{{ predictionDescription }}</p>
        </div>
      </div>
    </div>
    
    <!-- Отображение маски для NIfTI -->
    <div v-if="result.data.mask_image" class="mask-section">
      <h3>Визуализация результата</h3>
      <div class="mask-image">
        <img 
          :src="`data:image/png;base64,${result.data.mask_image}`" 
          alt="Маска сегментации"
          class="mask-img"
        />
        <p class="mask-caption">Средний срез с выделенными областями</p>
      </div>
    </div>
    
    <!-- Интерактивный просмотр срезов для ZIP/DICOM -->
    <div v-if="result.data.patient_id" class="slice-viewer">
      <h3>Просмотр срезов</h3>
      
      <div class="viewer-controls">
        <div class="volume-type-selector">
          <label>
            <input 
              type="radio" 
              value="original" 
              v-model="selectedVolumeType"
              @change="loadSlice"
            />
            Оригинал
          </label>
          <label>
            <input 
              type="radio" 
              value="mask" 
              v-model="selectedVolumeType"
              @change="loadSlice"
            />
            Сегментация
          </label>
        </div>
        
        <div class="slice-controls">
          <button 
            @click="previousSlice" 
            :disabled="currentSlice <= 0 || loadingSlice"
            class="slice-btn"
          >
            ← Пред
          </button>
          <span class="slice-info">
            Срез: {{ currentSlice + 1 }} / {{ totalSlices }}
          </span>
          <button 
            @click="nextSlice" 
            :disabled="currentSlice >= totalSlices - 1 || loadingSlice"
            class="slice-btn"
          >
            След →
          </button>
        </div>
      </div>
      
      <div class="slice-display">
        <div v-if="loadingSlice" class="slice-loading">
          <div class="spinner"></div>
          <p>Загружаем срез...</p>
        </div>
        
        <div v-else-if="currentSliceImage" class="slice-image">
          <img 
            :src="`data:image/png;base64,${currentSliceImage}`"
            alt="Медицинский срез"
            class="slice-img"
          />
        </div>
        
        <div v-else-if="sliceError" class="slice-error">
          ❌ {{ sliceError }}
        </div>
      </div>
    </div>
    
    <div class="actions">
      <button @click="$emit('new-analysis')" class="action-btn primary">
        Новый анализ
      </button>
      <button @click="downloadResults" class="action-btn secondary">
        Скачать результаты
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { MLApiService } from '../services/mlApi';
import type { MLPredictionResult } from '../services/mlApi';

interface Props {
  result: MLPredictionResult;
}

interface Emits {
  (e: 'new-analysis'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const mlApi = new MLApiService();

// Состояние для просмотра срезов
const selectedVolumeType = ref<'original' | 'mask'>('original');
const currentSlice = ref(50); // Начинаем с середины
const totalSlices = ref(100); // Примерное количество срезов
const currentSliceImage = ref('');
const loadingSlice = ref(false);
const sliceError = ref('');

const predictionClass = computed(() => ({
  'tumor-detected': props.result.data.has_tumor,
  'no-tumor': !props.result.data.has_tumor
}));

const predictionDescription = computed(() => {
  if (props.result.data.has_tumor) {
    return 'Обнаружены признаки патологических изменений';
  } else {
    return 'Патологические изменения не обнаружены';
  }
});

const loadSlice = async () => {
  if (!props.result.data.patient_id) return;
  
  loadingSlice.value = true;
  sliceError.value = '';
  
  try {
    const response = await mlApi.getSlice(
      props.result.data.patient_id,
      selectedVolumeType.value,
      currentSlice.value
    );
    
    currentSliceImage.value = response.data.slice_data;
  } catch (error) {
    sliceError.value = error instanceof Error ? error.message : 'Ошибка загрузки среза';
    currentSliceImage.value = '';
  } finally {
    loadingSlice.value = false;
  }
};

const previousSlice = () => {
  if (currentSlice.value > 0) {
    currentSlice.value--;
    loadSlice();
  }
};

const nextSlice = () => {
  if (currentSlice.value < totalSlices.value - 1) {
    currentSlice.value++;
    loadSlice();
  }
};

const downloadResults = () => {
  const data = {
    filename: props.result.filename,
    prediction: props.result.data.prediction,
    has_tumor: props.result.data.has_tumor,
    timestamp: new Date().toISOString(),
    request_id: props.result.data.request_id,
    patient_id: props.result.data.patient_id
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ml_analysis_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

onMounted(() => {
  // Если есть patient_id, загружаем первый срез
  if (props.result.data.patient_id) {
    loadSlice();
  }
});
</script>

<style scoped>
.ml-results {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.results-header {
  margin-bottom: 24px;
  text-align: center;
}

.results-header h2 {
  color: #374151;
  margin-bottom: 8px;
}

.filename {
  color: #6b7280;
  font-size: 14px;
}

.prediction-result {
  margin-bottom: 32px;
}

.prediction-card {
  display: flex;
  align-items: center;
  padding: 24px;
  border-radius: 12px;
  gap: 16px;
}

.prediction-card.tumor-detected {
  background-color: #fef2f2;
  border: 2px solid #fecaca;
}

.prediction-card.no-tumor {
  background-color: #f0fdf4;
  border: 2px solid #bbf7d0;
}

.prediction-icon {
  font-size: 32px;
}

.prediction-text h3 {
  margin: 0 0 4px 0;
  font-size: 20px;
}

.prediction-text p {
  margin: 0;
  color: #6b7280;
}

.tumor-detected .prediction-text h3 {
  color: #dc2626;
}

.no-tumor .prediction-text h3 {
  color: #16a34a;
}

.mask-section, .slice-viewer {
  margin-bottom: 32px;
}

.mask-section h3, .slice-viewer h3 {
  color: #374151;
  margin-bottom: 16px;
}

.mask-image {
  text-align: center;
}

.mask-img, .slice-img {
  max-width: 100%;
  height: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #f9fafb;
}

.mask-caption {
  margin-top: 8px;
  color: #6b7280;
  font-size: 14px;
}

.viewer-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 16px;
}

.volume-type-selector {
  display: flex;
  gap: 16px;
}

.volume-type-selector label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.slice-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slice-btn {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.slice-btn:hover:not(:disabled) {
  background-color: #f3f4f6;
}

.slice-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.slice-info {
  font-weight: 500;
  color: #374151;
}

.slice-display {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #f9fafb;
}

.slice-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f4f6;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.slice-error {
  color: #dc2626;
  text-align: center;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.action-btn {
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.action-btn.primary {
  background-color: #3b82f6;
  color: white;
}

.action-btn.primary:hover {
  background-color: #2563eb;
}

.action-btn.secondary {
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.action-btn.secondary:hover {
  background-color: #e5e7eb;
}
</style>
