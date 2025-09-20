<template>
  <div class="dashboard">
    <header>
      <h1>AI Анализ МРТ - Дашборд</h1>
      <div class="user-info">
        <span>{{ authStore.user?.email }}</span>
        <button @click="handleLogout">Выйти</button>
      </div>
    </header>
    
    <main>
      <div class="dashboard-content">
        <h2>Добро пожаловать в систему анализа медицинских изображений</h2>
        <p>Система предоставляет возможности для анализа опухолей на основе ML алгоритмов</p>
        
        <div class="feature-cards">
          <div class="feature-card">
            <div class="card-icon">🧠</div>
            <h3>ML Анализ</h3>
            <p>Анализ медицинских изображений с помощью нейронных сетей</p>
            <router-link to="/ml-analysis" class="card-button">
              Перейти к анализу
            </router-link>
          </div>
          
          <div class="feature-card">
            <div class="card-icon">📊</div>
            <h3>Статистика</h3>
            <p>Просмотр статистики и истории анализов</p>
            <button class="card-button" disabled>
              Скоро
            </button>
          </div>
          
          <div class="feature-card">
            <div class="card-icon">⚙️</div>
            <h3>Настройки</h3>
            <p>Конфигурация системы и профиля пользователя</p>
            <button class="card-button" disabled>
              Скоро
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-info button {
  padding: 8px 16px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

main {
  padding: 40px 20px;
}

.dashboard-content {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}

.dashboard-content h2 {
  color: #374151;
  margin-bottom: 12px;
  font-size: 28px;
}

.dashboard-content > p {
  color: #6b7280;
  font-size: 16px;
  margin-bottom: 40px;
}

.feature-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-top: 40px;
}

.feature-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 32px 24px;
  text-align: center;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.feature-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.feature-card h3 {
  color: #374151;
  margin-bottom: 12px;
  font-size: 20px;
}

.feature-card p {
  color: #6b7280;
  margin-bottom: 24px;
  line-height: 1.5;
}

.card-button {
  display: inline-block;
  padding: 12px 24px;
  background-color: #3b82f6;
  color: white;
  text-decoration: none;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.card-button:hover:not(:disabled) {
  background-color: #2563eb;
}

.card-button:disabled {
  background-color: #d1d5db;
  color: #9ca3af;
  cursor: not-allowed;
}
</style>

