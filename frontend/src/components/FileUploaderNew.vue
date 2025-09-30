<template>
  <div class="uploader" :class="{ 'is-disabled': disabled }">
    <input
      ref="inputRef"
      type="file"
      class="hidden-input"
      :accept="accept || undefined"
      :multiple="multiple"
      :disabled="disabled"
      @change="handleInputChange"
    />

    <div
      class="drop-zone"
      :class="{ 'drag-over': isDragOver }"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
      @click="triggerFileDialog"
    >
      <div class="drop-zone-content" v-if="!selectedFiles.length">
        <i class="pi pi-cloud-upload icon" />
        <p class="title">Перетащите файл сюда или нажмите для выбора</p>
        <p v-if="accept" class="subtitle">Поддерживаемые форматы: {{ humanReadableAccept }}</p>
      </div>

      <div class="selected-files" v-else>
        <i class="pi pi-file" />
        <div class="file-list">
          <span v-for="file in selectedFiles" :key="file.name" class="file-name">{{ file.name }}</span>
        </div>
        <button class="replace-button" type="button" @click.stop="triggerFileDialog" :disabled="disabled">
          Выбрать другой файл
        </button>
      </div>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps({
  accept: { type: String, default: '' },
  auto: { type: Boolean, default: false },
  maxFileSize: { type: Number, default: 1000000 },
  disabled: { type: Boolean, default: false },
  multiple: { type: Boolean, default: false }
});

const emit = defineEmits<{
  (e: 'select', payload: { files: File[] }): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const isDragOver = ref(false);
const errorMessage = ref('');
const selectedFiles = ref<File[]>([]);

const acceptPatterns = computed(() =>
  props.accept
    .split(',')
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0)
);

const humanReadableAccept = computed(() => acceptPatterns.value.join(', '));

const triggerFileDialog = () => {
  if (props.disabled) return;
  inputRef.value?.click();
};

const handleDragOver = () => {
  if (!props.disabled) {
    isDragOver.value = true;
  }
};

const handleDragLeave = () => {
  isDragOver.value = false;
};

const handleDrop = (event: DragEvent) => {
  isDragOver.value = false;
  if (props.disabled) return;

  const droppedFiles = event.dataTransfer?.files;
  if (!droppedFiles || droppedFiles.length === 0) return;

  processFiles(droppedFiles);
  resetInput();
};

const handleInputChange = (event: Event) => {
  const files = (event.target as HTMLInputElement).files;
  if (!files || files.length === 0) return;

  processFiles(files);
  resetInput();
};

const processFiles = (fileList: FileList | File[]) => {
  const list = Array.from(fileList);
  if (!list.length) return;

  const limited = props.multiple ? list : [list[0]];
  const validatedFiles: File[] = [];

  for (const file of limited) {
    if (!matchesAccept(file)) {
      errorMessage.value = `Файл ${file.name} имеет неподдерживаемый формат.`;
      selectedFiles.value = [];
      emit('select', { files: [] });
      return;
    }

    if (props.maxFileSize && file.size > props.maxFileSize) {
      errorMessage.value = `Файл ${file.name} превышает допустимый размер ${formatBytes(props.maxFileSize)}.`;
      selectedFiles.value = [];
      emit('select', { files: [] });
      return;
    }

    validatedFiles.push(file);
  }

  errorMessage.value = '';
  selectedFiles.value = validatedFiles;
  emit('select', { files: validatedFiles });
};

const matchesAccept = (file: File) => {
  if (!acceptPatterns.value.length) return true;

  const fileName = file.name.toLowerCase();
  const mimeType = file.type;

  return acceptPatterns.value.some((pattern) => {
    const lowerPattern = pattern.toLowerCase();

    if (lowerPattern === '*/*') return true;
    if (lowerPattern.endsWith('/*')) {
      const baseType = lowerPattern.slice(0, lowerPattern.length - 2);
      return mimeType.startsWith(baseType);
    }
    if (lowerPattern.startsWith('.')) {
      return fileName.endsWith(lowerPattern);
    }
    return mimeType === lowerPattern;
  });
};

const resetInput = () => {
  if (inputRef.value) {
    inputRef.value.value = '';
  }
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, index);
  return `${size.toFixed(1)} ${units[index]}`;
};
</script>

<style scoped>
.uploader {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hidden-input {
  display: none;
}

.drop-zone {
  border: 2px dashed var(--p-content-border-color, #d1d5db);
  border-radius: 12px;
  padding: 2rem 1.5rem;
  text-align: center;
  cursor: pointer;
  background: var(--p-surface-50, #f9fafb);
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.drop-zone.drag-over {
  border-color: var(--p-primary-color, #3b82f6);
  background: var(--p-primary-50, #eff6ff);
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.icon {
  font-size: 2rem;
  color: var(--p-text-muted-color, #6b7280);
}

.title {
  font-weight: 600;
  margin: 0;
  color: var(--p-text-color, #111827);
}

.subtitle {
  margin: 0;
  color: var(--p-text-muted-color, #6b7280);
  font-size: 0.9rem;
}

.selected-files {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
  color: var(--p-text-color, #111827);
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-name {
  font-weight: 600;
}

.replace-button {
  border: 1px solid var(--p-content-border-color, #d1d5db);
  background: transparent;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  cursor: pointer;
  color: var(--p-primary-color, #3b82f6);
  transition: background-color 0.2s ease, color 0.2s ease;
}

.replace-button:disabled {
  cursor: not-allowed;
  color: var(--p-text-muted-color, #9ca3af);
}

.replace-button:not(:disabled):hover {
  background: var(--p-primary-50, #eff6ff);
}

.error {
  color: var(--p-danger-color, #ef4444);
  margin: 0;
  font-size: 0.9rem;
}

.is-disabled .drop-zone {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
