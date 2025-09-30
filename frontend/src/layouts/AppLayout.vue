<template>
  <div class="app-layout">
    <AppSidebar :user-email="userEmail" :menu-items="menuItems" @logout="handleLogout" />
    <main class="layout-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import AppSidebar from '../components/AppSidebar.vue';
import type { NavigationItem } from '../types/navigation';

const router = useRouter();
const authStore = useAuthStore();

const userEmail = computed(() => authStore.user?.email ?? '');

const menuItems = computed<NavigationItem[]>(() => [
  { label: 'Рабочая панель', to: '/dashboard', icon: 'pi pi-home' },
  { label: 'Загрузка исследований', to: '/ml-analysis', icon: 'pi pi-cloud-upload' },
]);

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f7fa;
}

.layout-main {
  flex: 1;
  padding: 40px 56px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

@media (max-width: 1024px) {
  .layout-main {
    padding: 32px;
  }
}

@media (max-width: 768px) {
  .layout-main {
    padding: 24px 20px 40px;
  }
}
</style>
