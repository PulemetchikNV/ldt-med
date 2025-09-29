<template>
  <div class="orthogonal-viewer">
    <div class="viewer-header">
      <h3>Трехмерный просмотр</h3>
      <div class="coordinates-display">
        <span class="coord-label">Координаты:</span>
        <span class="coord-value">X: {{ currentCoords.i }}, Y: {{ currentCoords.j }}, Z: {{ currentCoords.k }}</span>
        <span v-if="sliderState.isDragging" class="loading-indicator">⏳</span>
      </div>
    </div>
    
    <div class="viewer-grid">
      <!-- Сагиттальная плоскость (X) -->
      <div class="plane-container">
        <div class="plane-header">
          <h4>Сагиттальная (X = {{ currentCoords.i }})</h4>
          <div class="plane-coords">
            Y: {{ currentCoords.j }}, Z: {{ currentCoords.k }}
          </div>
        </div>
        <div 
          class="image-container"
          @click="onPlaneClick('sagittal', $event)"
          @mousemove="onMouseMove('sagittal', $event)"
          @mouseleave="onMouseLeave"
        >
          <img 
            v-if="images.sagittal" 
            :src="`data:image/png;base64,${images.sagittal}`"
            :alt="'Сагиттальный срез'"
            class="plane-image"
            ref="sagittalImage"
          />
          <div v-else class="placeholder">
            <span>Загрузка...</span>
          </div>
          <div 
            v-if="mouseCoords.sagittal" 
            class="crosshair"
            :style="{
              left: mouseCoords.sagittal.x + 'px',
              top: mouseCoords.sagittal.y + 'px'
            }"
          ></div>
        </div>
      </div>
      
      <!-- Корональная плоскость (Y) -->
      <div class="plane-container">
        <div class="plane-header">
          <h4>Корональная (Y = {{ currentCoords.j }})</h4>
          <div class="plane-coords">
            X: {{ currentCoords.i }}, Z: {{ currentCoords.k }}
          </div>
        </div>
        <div 
          class="image-container"
          @click="onPlaneClick('coronal', $event)"
          @mousemove="onMouseMove('coronal', $event)"
          @mouseleave="onMouseLeave"
        >
          <img 
            v-if="images.coronal" 
            :src="`data:image/png;base64,${images.coronal}`"
            :alt="'Корональный срез'"
            class="plane-image"
            ref="coronalImage"
          />
          <div v-else class="placeholder">
            <span>Загрузка...</span>
          </div>
          <div 
            v-if="mouseCoords.coronal" 
            class="crosshair"
            :style="{
              left: mouseCoords.coronal.x + 'px',
              top: mouseCoords.coronal.y + 'px'
            }"
          ></div>
        </div>
      </div>
      
      <!-- Аксиальная плоскость (Z) -->
      <div class="plane-container">
        <div class="plane-header">
          <h4>Аксиальная (Z = {{ currentCoords.k }})</h4>
          <div class="plane-coords">
            X: {{ currentCoords.i }}, Y: {{ currentCoords.j }}
          </div>
        </div>
        <div 
          class="image-container"
          @click="onPlaneClick('axial', $event)"
          @mousemove="onMouseMove('axial', $event)"
          @mouseleave="onMouseLeave"
        >
          <img 
            v-if="images.axial" 
            :src="`data:image/png;base64,${images.axial}`"
            :alt="'Аксиальный срез'"
            class="plane-image"
            ref="axialImage"
          />
          <div v-else class="placeholder">
            <span>Загрузка...</span>
          </div>
          <div 
            v-if="mouseCoords.axial" 
            class="crosshair"
            :style="{
              left: mouseCoords.axial.x + 'px',
              top: mouseCoords.axial.y + 'px'
            }"
          ></div>
        </div>
      </div>
    </div>
    
    <!-- Навигация -->
    <div class="navigation-controls">
      <div class="nav-group">
        <label>X (Сагиттальная):</label>
        <input 
          type="range" 
          :min="0" 
          :max="(volumeShape[0] || 1) - 1" 
          v-model.number="currentCoords.i"
          @input="onSliderInput"
          @mousedown="onSliderStart"
          @mouseup="onSliderEnd"
          @touchstart="onSliderStart"
          @touchend="onSliderEnd"
          class="coord-slider"
          :class="{ 'dragging': sliderState.isDragging }"
        />
        <span class="coord-display">{{ currentCoords.i }}</span>
      </div>
      
      <div class="nav-group">
        <label>Y (Корональная):</label>
        <input 
          type="range" 
          :min="0" 
          :max="(volumeShape[1] || 1) - 1" 
          v-model.number="currentCoords.j"
          @input="onSliderInput"
          @mousedown="onSliderStart"
          @mouseup="onSliderEnd"
          @touchstart="onSliderStart"
          @touchend="onSliderEnd"
          class="coord-slider"
          :class="{ 'dragging': sliderState.isDragging }"
        />
        <span class="coord-display">{{ currentCoords.j }}</span>
      </div>
      
      <div class="nav-group">
        <label>Z (Аксиальная):</label>
        <input 
          type="range" 
          :min="0" 
          :max="(volumeShape[2] || 1) - 1" 
          v-model.number="currentCoords.k"
          @input="onSliderInput"
          @mousedown="onSliderStart"
          @mouseup="onSliderEnd"
          @touchstart="onSliderStart"
          @touchend="onSliderEnd"
          class="coord-slider"
          :class="{ 'dragging': sliderState.isDragging }"
        />
        <span class="coord-display">{{ currentCoords.k }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onUnmounted } from 'vue';

interface Coordinates {
  i: number;
  j: number;
  k: number;
}

interface Images {
  sagittal: string;
  coronal: string;
  axial: string;
}

interface MouseCoords {
  x: number;
  y: number;
}

type PlaneName = 'sagittal' | 'coronal' | 'axial'

type PlaneMouseCoords = Record<PlaneName, MouseCoords | null>

type PlanePixelCoords = {
  x: number
  y: number
  containerWidth: number
  containerHeight: number
  imageWidth: number
  imageHeight: number
}

interface Props {
  images: Images;
  volumeShape: number[];
  initialCoords?: Coordinates;
  loading?: boolean;
}

interface SliderState {
  isDragging: boolean;
  pendingCoords: Coordinates | null;
}

interface Emits {
  (e: 'coords-change', coords: Coordinates): void;
  (e: 'plane-click', plane: PlaneName, coords: Coordinates, pixelCoords: PlanePixelCoords): void;
}

const props = withDefaults(defineProps<Props>(), {
  initialCoords: () => ({ i: 0, j: 0, k: 0 }),
  loading: false
});

const emit = defineEmits<Emits>();

// Состояние
const currentCoords = reactive<Coordinates>({ ...props.initialCoords });
const mouseCoords = reactive<PlaneMouseCoords>({
  sagittal: null,
  coronal: null,
  axial: null
});

// Refs для изображений
const sagittalImage = ref<HTMLImageElement>();
const coronalImage = ref<HTMLImageElement>();
const axialImage = ref<HTMLImageElement>();

// Debounce для слайдеров
let debounceTimer: number | null = null;
const DEBOUNCE_DELAY = 300; // 300ms задержка

// Состояние слайдеров
const sliderState = reactive<SliderState>({
  isDragging: false,
  pendingCoords: null
});

// Методы
const onCoordsChange = () => {
  // Очищаем предыдущий таймер
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  // Устанавливаем новый таймер
  debounceTimer = window.setTimeout(() => {
    emit('coords-change', { ...currentCoords });
  }, DEBOUNCE_DELAY);
};

const onSliderInput = () => {
  // При движении слайдера отмечаем, что идет перетаскивание
  sliderState.isDragging = true;
  sliderState.pendingCoords = { ...currentCoords };
};

const onSliderStart = () => {
  sliderState.isDragging = true;
};

const onSliderEnd = () => {
  sliderState.isDragging = false;
  // Отправляем финальные координаты
  if (sliderState.pendingCoords) {
    emit('coords-change', { ...sliderState.pendingCoords });
    sliderState.pendingCoords = null;
  }
};

const onPlaneClick = (plane: PlaneName, event: MouseEvent) => {
  // Очищаем debounce таймер при клике (мгновенный отклик)
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  const container = event.currentTarget as HTMLElement;
  const rect = container.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const image = container.querySelector('img') as HTMLImageElement | null;
  const imageRect = image?.getBoundingClientRect();

  const pixelCoords = {
    x: Math.round(x),
    y: Math.round(y),
    containerWidth: rect.width,
    containerHeight: rect.height,
    imageWidth: imageRect?.width ?? rect.width,
    imageHeight: imageRect?.height ?? rect.height
  };

  emit('plane-click', plane, { ...currentCoords }, pixelCoords);
};

const onMouseMove = (plane: PlaneName, event: MouseEvent) => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  mouseCoords[plane] = { 
    x: Math.round(x), 
    y: Math.round(y) 
  };
};

const onMouseLeave = () => {
  mouseCoords.sagittal = null;
  mouseCoords.coronal = null;
  mouseCoords.axial = null;
};

// Следим за изменениями координат извне
watch(() => props.initialCoords, (newCoords) => {
  if (newCoords) {
    currentCoords.i = newCoords.i;
    currentCoords.j = newCoords.j;
    currentCoords.k = newCoords.k;
  }
}, { deep: true });

// Следим за изменениями формы объема
watch(() => props.volumeShape, (newShape) => {
  if (newShape && newShape.length >= 3) {
        // Ограничиваем координаты в пределах формы
        currentCoords.i = Math.min(currentCoords.i, (newShape[0] || 1) - 1);
        currentCoords.j = Math.min(currentCoords.j, (newShape[1] || 1) - 1);
        currentCoords.k = Math.min(currentCoords.k, (newShape[2] || 1) - 1);
  }
});

// Очистка таймера при размонтировании компонента
onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
});
</script>

<style scoped>
.orthogonal-viewer {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e5e7eb;
}

.viewer-header h3 {
  margin: 0;
  color: #374151;
  font-size: 20px;
}

.coordinates-display {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f3f4f6;
  padding: 8px 12px;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
}

.coord-label {
  font-weight: 500;
  color: #6b7280;
}

.coord-value {
  color: #374151;
  font-weight: 600;
}

.loading-indicator {
  margin-left: 8px;
  font-size: 14px;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.viewer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.plane-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.plane-header h4 {
  margin: 0;
  color: #374151;
  font-size: 16px;
}

.plane-coords {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #6b7280;
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #d1d5db;
}

.image-container {
  position: relative;
  background: #f3f4f6;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  cursor: crosshair;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plane-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #6b7280;
  font-style: italic;
}

.crosshair {
  position: absolute;
  width: 20px;
  height: 20px;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.crosshair::before,
.crosshair::after {
  content: '';
  position: absolute;
  background: #ef4444;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
}

.crosshair::before {
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  transform: translateY(-50%);
}

.crosshair::after {
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
}

.navigation-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.nav-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-group label {
  min-width: 120px;
  font-weight: 500;
  color: #374151;
  font-size: 14px;
}

.coord-slider {
  flex: 1;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.coord-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.coord-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.coord-slider.dragging {
  background: #dbeafe;
}

.coord-slider.dragging::-webkit-slider-thumb {
  background: #1d4ed8;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.coord-slider.dragging::-moz-range-thumb {
  background: #1d4ed8;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.coord-display {
  min-width: 40px;
  text-align: center;
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: #374151;
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #d1d5db;
}

@media (max-width: 768px) {
  .viewer-grid {
    grid-template-columns: 1fr;
  }
  
  .viewer-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .nav-group {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .nav-group label {
    min-width: auto;
  }
  
  .coord-slider {
    width: 100%;
  }
}
</style>
