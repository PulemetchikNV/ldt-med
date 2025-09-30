<template>
  <div class="auth-page">
    <section class="brand-panel">
      <div class="brand-logo" aria-hidden="true">
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="register-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0d6efd" />
              <stop offset="100%" stop-color="#f97316" />
            </linearGradient>
          </defs>
          <rect x="8" y="8" width="48" height="48" rx="12" fill="url(#register-logo-gradient)" />
          <path
            d="M32 17.5c7.99 0 14.5 6.51 14.5 14.5S39.99 46.5 32 46.5c-2.53 0-4.91-.65-6.97-1.78l-7.51 2.17 2.17-7.5A14.46 14.46 0 0 1 17.5 32C17.5 24.01 24.01 17.5 32 17.5Zm0 5.5a1.5 1.5 0 0 0-1.5 1.5v5.5h-5.5a1.5 1.5 0 0 0-.14 2.99l.14.01h5.5v5.5a1.5 1.5 0 0 0 2.99.14l.01-.14v-5.5h5.5a1.5 1.5 0 0 0 .14-2.99l-.14-.01h-5.5V24.5A1.5 1.5 0 0 0 32 23Z"
            fill="#f8fafc"
          />
        </svg>
      </div>
      <h1>Классификация КТ ОГК</h1>
      <p>
        Зарегистрируйтесь, чтобы подключить сервис к рабочему процессу и получать мгновенные решения по норме и патологиям.
      </p>
    </section>

    <section class="form-panel">
      <div class="form-card">
        <h2>Запросить доступ</h2>
        <p class="form-subtitle">
          После проверки учётной записи вы получите уведомление на указанную почту.
        </p>
        <form @submit.prevent="handleRegister" novalidate>
          <label class="form-field">
            <span class="field-label">Электронная почта</span>
            <input
              v-model="email"
              type="email"
              inputmode="email"
              autocomplete="email"
              placeholder="name@example.ru"
              required
            />
          </label>
          <label class="form-field">
            <span class="field-label">Пароль</span>
            <input
              v-model="password"
              type="password"
              autocomplete="new-password"
              placeholder="Минимум 8 символов"
              required
            />
          </label>
          <button type="submit" :disabled="loading">
            {{ loading ? 'Отправляем запрос…' : 'Создать учётную запись' }}
          </button>
        </form>
        <p v-if="error" class="error" role="alert" aria-live="assertive">{{ error }}</p>
        <p class="footer-text">
          Уже есть доступ? <router-link to="/login">Войти</router-link>
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const router = useRouter();
const authStore = useAuthStore();

const handleRegister = async () => {
  if (!email.value || !password.value) return;
  
  loading.value = true;
  error.value = '';
  
  try {
    await authStore.register(email.value, password.value);
    router.push('/dashboard');
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
:global(body) {
  margin: 0;
  font-family: "Segoe UI", "Roboto", system-ui, -apple-system, sans-serif;
  background-color: #f3f5f7;
  color: #1e293b;
}

.auth-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(140deg, #f9fafb 0%, #e3edf5 100%);
}

.brand-panel {
  padding: 48px 32px 16px;
  text-align: center;
}

.brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  margin-bottom: 20px;
  border-radius: 24px;
  box-shadow: 0 12px 24px rgba(13, 110, 253, 0.16);
}

.brand-panel h1 {
  margin: 0 0 12px;
  font-size: 1.9rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.brand-panel p {
  margin: 0 auto;
  max-width: 520px;
  line-height: 1.6;
  color: #475569;
}

.form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.form-card {
  width: min(480px, 100%);
  background: #ffffff;
  border-radius: 16px;
  padding: 40px 48px;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.08);
  border: 1px solid #d9e2ec;
}

.form-card h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.form-subtitle {
  margin: 12px 0 32px;
  color: #52627a;
  line-height: 1.5;
}

.form-field {
  display: block;
  margin-bottom: 20px;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  color: #1e293b;
}

.form-field input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 1rem;
  background-color: #f8fafc;
  color: #0f172a;
  box-sizing: border-box;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-field input:focus {
  outline: none;
  border-color: #f97316;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.2);
  background-color: #ffffff;
}

button {
  width: 100%;
  padding: 14px 16px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  background: linear-gradient(120deg, #0d6efd, #f97316);
  color: #ffffff;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

button:hover:enabled {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(249, 115, 22, 0.18);
}

button:disabled {
  cursor: not-allowed;
  background: #94a3b8;
  box-shadow: none;
}

.error {
  margin: 16px 0 0;
  padding: 12px 16px;
  background-color: #fee2e2;
  border: 1px solid #f87171;
  border-radius: 10px;
  color: #b91c1c;
  font-size: 0.95rem;
}

.footer-text {
  margin-top: 28px;
  text-align: center;
  color: #475569;
}

.footer-text a {
  color: #0d6efd;
  font-weight: 600;
}

.footer-text a:focus,
.footer-text a:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .brand-panel {
    padding: 32px 20px 8px;
  }

  .form-card {
    padding: 32px 24px;
  }
}

@media (max-width: 480px) {
  .form-card {
    padding: 28px 20px;
  }

  .brand-panel h1 {
    font-size: 1.6rem;
  }

  .form-card h2 {
    font-size: 1.35rem;
  }
}
</style>
