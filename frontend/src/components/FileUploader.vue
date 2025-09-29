<template>
  <div class="file-uploader">
    <div class="upload-area" :class="{ 'drag-over': isDragOver, 'uploading': isUploading }">
      <div 
        class="drop-zone"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
        @click="triggerFileInput"
      >
        <div v-if="!isUploading" class="upload-content">
          <div class="upload-icon">📁</div>
          <h3>Загрузить медицинский файл</h3>
          <p>Перетащите файл сюда или нажмите для выбора</p>
          <div class="supported-formats">
            <span class="format">NIfTI (.nii, .nii.gz)</span>
            <span class="format">ZIP с DICOM</span>
          </div>
        </div>
        
        <div v-else class="uploading-content">
          <div class="spinner"></div>
          <h3>Анализируем файл...</h3>
          <p>{{ uploadProgress }}</p>
        </div>
      </div>
      
      <input
        ref="fileInput"
        type="file"
        accept=".nii,.nii.gz,.zip"
        @change="onFileSelect"
        style="display: none"
      />
    </div>
    
    <div v-if="error" class="error-message">
      ❌ {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { MLApiService } from '../services/mlApi';

interface Props {
  disabled?: boolean;
}

interface Emits {
  (e: 'upload-success', result: any): void;
  (e: 'upload-error', error: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
});

const emit = defineEmits<Emits>();

const fileInput = ref<HTMLInputElement>();
const isDragOver = ref(false);
const isUploading = ref(false);
const uploadProgress = ref('');
const error = ref('');

const mlApi = new MLApiService();

const triggerFileInput = () => {
  if (!props.disabled && !isUploading.value) {
    fileInput.value?.click();
  }
};

const onDragOver = () => {
  if (!props.disabled && !isUploading.value) {
    isDragOver.value = true;
  }
};

const onDragLeave = () => {
  isDragOver.value = false;
};

const onDrop = (e: DragEvent) => {
  isDragOver.value = false;
  const fileList = e.dataTransfer?.files;
  if (!props.disabled && !isUploading.value && fileList && fileList.length > 0) {
    const file = fileList[0];
    uploadFile(file);
  }
};

const onFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (files && files.length > 0) {
    const file = files[0];
    uploadFile(file);
  }
};

const validateFile = (file: File): string | null => {
  const maxSize = 1000 * 1024 * 1024; // 1GB
  
  if (file.size > maxSize) {
    return 'Файл слишком большой. Максимальный размер: 1GB';
  }
  
  const validExtensions = ['.nii', '.nii.gz', '.zip'];
  const fileName = file.name.toLowerCase();
  
  if (!validExtensions.some(ext => fileName.endsWith(ext))) {
    return 'Неподдерживаемый формат файла. Поддерживаются: .nii, .nii.gz, .zip';
  }
  
  return null;
};

const uploadFile = async (file: File) => {
  error.value = '';
  
  // Валидация файла
  const validationError = validateFile(file);
  if (validationError) {
    error.value = validationError;
    return;
  }

  if (!localStorage.getItem('token')) {
    const authError = 'Необходимо войти в систему перед запуском анализа';
    error.value = authError;
    emit('upload-error', authError);
    return;
  }
  
  isUploading.value = true;
  uploadProgress.value = 'Загружаем файл...';
  
  try {
    let result;
    
    if (file.name.toLowerCase().endsWith('.zip')) {
      uploadProgress.value = 'Анализируем DICOM данные...';
      result = await mlApi.predictZip(file);
    } else {
      uploadProgress.value = 'Анализируем NIfTI данные...';
      result = await mlApi.predictNifti(file);
    }
    
    uploadProgress.value = 'Анализ завершен!';
    emit('upload-success', result);
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
    error.value = errorMessage;
    emit('upload-error', errorMessage);
  } finally {
    isUploading.value = false;
    uploadProgress.value = '';
    
    // Очищаем input для возможности повторной загрузки того же файла
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  }
};
</script>

<style scoped>
.file-uploader {
  max-width: 600px;
  margin: 0 auto;
}

.upload-area {
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
}

.upload-area.drag-over {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.upload-area.uploading {
  border-color: #f59e0b;
  background-color: #fffbeb;
}

.drop-zone {
  text-align: center;
  padding: 40px 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.drop-zone:hover {
  background-color: #f9fafb;
}

.upload-content .upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.upload-content h3 {
  color: #374151;
  margin-bottom: 8px;
  font-size: 18px;
}

.upload-content p {
  color: #6b7280;
  margin-bottom: 16px;
}

.supported-formats {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.format {
  background-color: #e5e7eb;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: #374151;
}

.uploading-content {
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

.uploading-content h3 {
  color: #f59e0b;
  margin: 0;
}

.uploading-content p {
  color: #92400e;
  margin: 0;
}

.error-message {
  margin-top: 16px;
  padding: 12px;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  text-align: center;
}
</style>
