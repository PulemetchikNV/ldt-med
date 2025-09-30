<template>
  <div class="dashboard-view">
    <section class="page-header">
      <h1>Оперативный контроль исследований КТ органов грудной клетки</h1>
      <p>
        Загрузите ZIP с DICOM-срезами, проверьте результат классификации и передайте заключение врачу-куратору.
      </p>
    </section>

    <section class="primary-action">
      <Card class="upload-card">
        <template #title>Загрузка и анализ исследования</template>
        <template #subtitle>
          Поддерживается пакетная загрузка архивов. Система автоматически выполняет проверку целостности файлов и сообщает
          о ходе анализа.
        </template>
        <template #content>
          <ul class="card-points">
            <li>Рекомендованный формат: ZIP ≤ 250 МБ, полный набор DICOM-срезов.</li>
            <li>Итоговая классификация: «норма» или «патология» с указанием уровня уверенности модели.</li>
            <li>Статус обработки отображается в журнале, уведомления приходят на корпоративную почту.</li>
          </ul>
        </template>
        <template #footer>
          <div class="card-actions">
            <Button label="Перейти к загрузке" icon="pi pi-cloud-upload" size="large" @click="goToAnalysis" />
          </div>
        </template>
      </Card>
    </section>

    <section class="support-grid">
      <Card class="info-card">
        <template #title>Требования к данным</template>
        <template #content>
          <p>
            Перед загрузкой убедитесь, что архив содержит последовательные серии КТ ОГК и корректные заголовки исследования.
            Удалите персональные данные пациента или используйте анонимизатор PACS.
          </p>
        </template>
      </Card>
      <Card class="info-card">
        <template #title>Регламент использования</template>
        <template #content>
          <p>
            Результаты модели не заменяют врачебное заключение. Пожалуйста, сохраняйте протокол проверки и подтверждайте
            решения, прежде чем передавать их в ЕГИСЗ.
          </p>
        </template>
      </Card>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';

const router = useRouter();

const goToAnalysis = () => {
  router.push('/ml-analysis');
};
</script>

<style scoped>
.dashboard-view {
  display: grid;
  grid-template-columns: 1fr;
  gap: 32px;
  color: #0f172a;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 720px;
  text-align: start;
}

.page-header h1 {
  margin: 0;
  font-size: 1.9rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.page-header p {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
  color: #475569;
}

.primary-action {
  text-align: start; 
}

.upload-card :deep(.p-card-title) {
  font-size: 1.4rem;
  font-weight: 600;
}

.upload-card :deep(.p-card-subtitle) {
  color: #52627a;
  font-size: 0.95rem;
  line-height: 1.6;
}

.card-points {
  margin: 0;
  padding-left: 20px;
  color: #334155;
  line-height: 1.6;
  font-size: 0.95rem;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
}

.support-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.info-card :deep(.p-card-title) {
  font-size: 1.1rem;
  font-weight: 600;
}

.info-card :deep(.p-card-body) {
  padding-top: 1.25rem;
}

.info-card p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: #475569;
}
</style>
