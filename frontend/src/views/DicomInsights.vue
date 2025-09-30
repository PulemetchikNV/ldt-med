<template>
  <div class="dicom-insights">
    <div class="content-wrapper">
      <Card class="intro-card">
        <template #title>Анализ одиночного DICOM файла</template>
        <template #subtitle>
          Загрузите файл формата .dcm, укажите запрос для ML модели и получите текстовый анализ вместе с вероятностями классов.
        </template>
        <template #content>
          <div class="form-grid">
            <div class="form-field">
              <label for="dicom-file">Выберите файл</label>
              <FileUploaderNew
                id="dicom-file"
                accept=".dcm"
                :auto="false"
                :max-file-size="52428800 * 3"
                @select="onFileSelect"
                :disabled="isLoading"
              />
              <small v-if="selectedFileName" class="file-name">{{ selectedFileName }}</small>
            </div>

            <div class="form-field">
              <label for="prompt">Текстовый промпт</label>
              <Textarea
                id="prompt"
                v-model="textPrompt"
                auto-resize
                rows="4"
                :disabled="isLoading"
                placeholder="Опишите, какой анализ нужно выполнить для загруженного снимка"
              />
            </div>

            <div class="form-actions">
              <Button
                label="Запустить анализ"
                icon="pi pi-play"
                :loading="isLoading"
                :disabled="!canSubmit"
                @click="runAnalysis"
              />
              <Button
                label="Сбросить"
                icon="pi pi-refresh"
                severity="secondary"
                outlined
                :disabled="isLoading && !hasResult"
                @click="resetState"
              />
            </div>

            <Message v-if="errorMessage" severity="error" :closable="false">
              {{ errorMessage }}
            </Message>
          </div>
        </template>
      </Card>

      <div class="results-wrapper" v-if="isLoading || hasResult">
        <Card class="results-card">
          <template #title>Результаты</template>
          <template #content>
            <div v-if="isLoading" class="loading-state">
              <ProgressSpinner stroke-width="4" />
              <p>Проводим анализ DICOM файла...</p>
            </div>

            <div v-else class="results-grid">
              <Card class="analysis-card">
                <template #header>
                  <div class="section-header">
                    <span class="section-label">
                      <i class="pi pi-file-edit"></i>
                      Текстовый обзор
                    </span>
                    <Tag value="/api/ml/analyze" severity="info" />
                  </div>
                </template>
                <template #content>
                  <p class="analysis-text" v-if="analyzeResult">
                    {{ analyzeResult.data.analysis }}
                  </p>
                  <p v-else class="empty-state">Ответ не получен</p>
                </template>
              </Card>

              <Card class="analysis-card">
                <template #header>
                  <div class="section-header">
                    <span class="section-label">
                      <i class="pi pi-chart-bar"></i>
                      Классификация
                    </span>
                    <Tag value="/api/ml/classify-dicom" severity="success" />
                  </div>
                </template>
                <template #content>
                  <DataTable
                    v-if="classificationRows.length"
                    :value="classificationRows"
                    size="small"
                    class="classification-table"
                  >
                    <Column field="label" header="Класс" />
                    <Column field="probability" header="Вероятность" />
                  </DataTable>
                  <p v-else class="empty-state">Нет данных классификации</p>
                </template>
              </Card>
            </div>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { axiosInstance } from '../plugins/axios';
import type { MLAnalyzeResult, MLClassifyDicomResult } from '../services/mlApi';
import Card from 'primevue/card';
import Button from 'primevue/button';
import FileUploaderNew from '../components/FileUploaderNew.vue';
import Textarea from 'primevue/textarea';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import ProgressSpinner from 'primevue/progressspinner';
import { AxiosError } from 'axios';

const selectedFile = ref<File | null>(null);
const textPrompt = ref('Опиши ключевые патологии, которые ты видишь на снимке, и возможные рекомендации.');
const analyzeResult = ref<MLAnalyzeResult | null>(null);
const classifyResult = ref<MLClassifyDicomResult | null>(null);
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);

const selectedFileName = computed(() => selectedFile.value?.name ?? '');
const hasResult = computed(() => Boolean(analyzeResult.value || classifyResult.value));

const classificationRows = computed(() => {
  if (!classifyResult.value) return [] as Array<{ label: string; probability: string }>;
  return Object.entries(classifyResult.value.data).map(([label, probability]) => ({
    label,
    probability
  }));
});

const canSubmit = computed(() => Boolean(selectedFile.value && textPrompt.value.trim()));

const onFileSelect = (event: { files: File[] }) => {
  const file = event.files?.[0];
  selectedFile.value = file ?? null;
};

const resetState = () => {
  selectedFile.value = null;
  analyzeResult.value = null;
  classifyResult.value = null;
  errorMessage.value = null;
};

const runAnalysis = async () => {
  if (!selectedFile.value) {
    errorMessage.value = 'Пожалуйста, выберите DICOM файл.';
    return;
  }

  if (!textPrompt.value.trim()) {
    errorMessage.value = 'Введите текстовый промпт для анализа.';
    return;
  }

  isLoading.value = true;
  errorMessage.value = null;
  analyzeResult.value = null;
  classifyResult.value = null;

  const file = selectedFile.value;
  const prompt = textPrompt.value.trim();

  const analyzeForm = new FormData();
  analyzeForm.append('text_prompt', prompt);
  analyzeForm.append('file', file);

  const classifyForm = new FormData();
  classifyForm.append('file', file);

  try {
    const [analyzeResponse, classifyResponse] = await Promise.all([
      axiosInstance.post<MLAnalyzeResult>('/api/ml/analyze', analyzeForm, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }),
      axiosInstance.post<MLClassifyDicomResult>('/api/ml/classify-dicom', classifyForm, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    ]);

    analyzeResult.value = analyzeResponse.data;
    classifyResult.value = classifyResponse.data;
  } catch (err) {
    const error = err as AxiosError<{ message?: string; error?: string }>;
    if (error.response?.data?.message) {
      errorMessage.value = error.response.data.message;
    } else if (error.response?.data?.error) {
      errorMessage.value = error.response.data.error;
    } else if (error.message) {
      errorMessage.value = error.message;
    } else {
      errorMessage.value = 'Не удалось выполнить запросы. Попробуйте позже.';
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.dicom-insights {
  padding: 2rem 1rem;
  background: linear-gradient(180deg, #f9fafb 0%, #ffffff 60%);
  min-height: calc(100vh - 60px);
}

.content-wrapper {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 600;
  color: #1f2937;
}

.file-name {
  color: #6b7280;
  font-size: 0.875rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.results-wrapper {
  display: flex;
  flex-direction: column;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 0;
  color: #4b5563;
}

.results-grid {
  display: grid;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .results-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #111827;
}

.analysis-text {
  white-space: pre-line;
  line-height: 1.6;
  color: #374151;
  font-size: 0.95rem;
}

.empty-state {
  color: #9ca3af;
  font-style: italic;
}

.classification-table :deep(.p-datatable-header) {
  display: none;
}

.classification-table :deep(.p-datatable-thead > tr > th) {
  background: #f3f4f6;
  color: #4b5563;
}

.classification-table :deep(.p-datatable-tbody > tr > td) {
  border-bottom: 1px solid #e5e7eb;
}
</style>
