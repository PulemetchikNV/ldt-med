<template>
  <div class="dicom-insights">
    <div class="content-wrapper">
      <Card class="intro-card">
        <template #title>
          <h4 class="card-title">Анализ DICOM файлов</h4>
        </template>
        <template #subtitle>
          <p class="card-subtitle">Загрузите файл формата .dcm или .zip архив с DICOM-файлами, укажите запрос для ML модели и получите текстовый анализ вместе с вероятностями классов.</p>
        </template>
        <template #content>
          <div class="form-grid">
            <div class="form-field">
              <label for="dicom-file">Выберите файл</label>
              <FileUploaderNew
                id="dicom-file"
                accept=".dcm,.zip"
                :auto="false"
                :max-file-size="52428800 * 10"
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
              <Card class="analysis-card" v-if="FEATURE_FLAGS.ENABLE_ANALYZE_API">
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

              <Card class="analysis-card" v-if="FEATURE_FLAGS.ENABLE_CLASSIFY_DICOM_API">
                <template #header>
                  <div class="section-header">
                    <span class="section-label">
                      <i class="pi pi-chart-line"></i>
                      Итог классификации
                    </span>
                  </div>
                </template>
                <template #content>
                  <div
                    v-if="classificationSummary"
                    class="classification-summary"
                    :class="classificationSummary.variant"
                  >
                    <div class="summary-header">
                      <span class="summary-title">{{ classificationSummary.title }}</span>
                      <Tag :severity="classificationSummary.tagSeverity" :value="classificationSummary.tag" />
                    </div>
                    <p class="summary-text">{{ classificationSummary.description }}</p>
                    <div class="confidence-meter">
                      <span>Уверенность модели</span>
                      <ProgressBar :value="classificationSummary.confidenceValue" show-value />
                    </div>
                  </div>
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
import { MLApiService, type MLAnalyzeResult, type MLClassifyDicomResult } from '../services/mlApi';
import { FEATURE_FLAGS } from '../__data__/const';
import Card from 'primevue/card';
import Button from 'primevue/button';
import FileUploaderNew from '../components/FileUploaderNew.vue';
import Textarea from 'primevue/textarea';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import ProgressBar from 'primevue/progressbar';

const mlApi = new MLApiService();

const selectedFile = ref<File | null>(null);
const textPrompt = ref('Опиши ключевые патологии, которые ты видишь на снимке, и возможные рекомендации.');
const analyzeResult = ref<MLAnalyzeResult | null>(null);
const classifyResult = ref<MLClassifyDicomResult | null>(null);
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);

const selectedFileName = computed(() => selectedFile.value?.name ?? '');
const hasResult = computed(() => Boolean(analyzeResult.value || classifyResult.value));

const classificationSummary = computed(() => {
  const result = classifyResult.value?.data;
  if (!result) return null;

  const confidence = parseFloat(result.max_pathology_probability?.replace('%', '') ?? '0');
  const isPathology = Number(result.prediction) === 1;

  return {
    variant: isPathology ? 'is-pathology' : 'is-normal',
    title: isPathology ? 'Вероятна патология' : 'Признаки патологии не обнаружены',
    description: isPathology
      ? 'Модель сигнализирует о потенциальных отклонениях. Рекомендуется детальный просмотр срезов и подготовка заключения.'
      : 'Исследование соответствует норме по мнению модели. Проверьте ключевые серии для окончательного подтверждения.',
    tag: isPathology ? 'Патология' : 'Норма',
    tagSeverity: isPathology ? 'danger' : 'success',
    confidenceValue: Math.max(0, Math.min(confidence, 100)),
  };
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

  try {
    const promises = [];

    if (FEATURE_FLAGS.ENABLE_ANALYZE_API) {
      promises.push(mlApi.analyze(prompt, file));
    } else {
      promises.push(Promise.resolve(null));
    }

    if (FEATURE_FLAGS.ENABLE_CLASSIFY_DICOM_API) {
      promises.push(mlApi.classifyDicom(file));
    } else {
      promises.push(Promise.resolve(null));
    }

    const [analyzeResponse, classifyResponse] = await Promise.all(promises);

    if (analyzeResponse) {
      analyzeResult.value = analyzeResponse as MLAnalyzeResult;
    }
    if (classifyResponse) {
      classifyResult.value = classifyResponse as MLClassifyDicomResult;
    }
  } catch (err) {
    const error = err as Error;
    errorMessage.value = error.message || 'Не удалось выполнить запросы. Попробуйте позже.';
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.dicom-insights {
  padding: 2rem 1rem;
  /* background: linear-gradient(180deg, #f9fafb 0%, #ffffff 60%); */
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
  text-align: start;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  text-align: start;
}

.card-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  text-align: start;
  margin-bottom: 2rem;
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
  text-align: start;
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

/* @media (min-width: 768px) {
  .results-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
} */

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

.classification-summary {
  padding: 1.5rem;
  border-radius: 16px;
  background: linear-gradient(135deg, #f1f5f9 0%, #f8fafc 100%);
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.classification-summary.is-normal {
  border-color: #bbf7d0;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%);
}

.classification-summary.is-pathology {
  border-color: #fecaca;
  background: linear-gradient(135deg, rgba(248, 113, 113, 0.15) 0%, rgba(249, 115, 22, 0.12) 100%);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.summary-title {
  font-weight: 600;
  font-size: 1.15rem;
  color: #0f172a;
}

.summary-text {
  margin: 0;
  color: #334155;
  line-height: 1.6;
}

.confidence-meter {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  color: #475569;
}

.confidence-meter span {
  font-size: 0.95rem;
  font-weight: 500;
}

.confidence-meter :deep(.p-progressbar) {
  height: 1.75rem;
  border-radius: 999px;
}

.confidence-meter :deep(.p-progressbar-value) {
  border-radius: 999px;
}

.confidence-meter :deep(.p-progressbar-label) {
  font-weight: 600;
}
</style>
