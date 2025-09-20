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
      <div class="placeholder">
        <h2>Добро пожаловать в систему AI анализа МРТ снимков</h2>
        <p>Здесь будет интерфейс для загрузки и анализа 3D МРТ снимков</p>
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

.placeholder {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
  padding: 60px 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.placeholder h2 {
  color: #333;
  margin-bottom: 20px;
}

.placeholder p {
  color: #666;
  font-size: 16px;
}
</style>

