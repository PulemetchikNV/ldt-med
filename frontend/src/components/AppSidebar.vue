<template>
  <aside class="sidebar">
    <div class="sidebar-content">
    <RouterLink to="/dashboard" class="brand" aria-label="Перейти на главную панель">
      <img src="../assets/logo.png" alt="Логотип" class="brand-logo-img" />
    </RouterLink>

    <Divider class="divider" />

    <nav aria-label="Основная навигация">
      <ul class="nav-list">
        <li v-for="item in menuItems" :key="item.to">
          <Button
            :label="item.label"
            :icon="item.icon"
            :class="['nav-button', { 'is-active': route.path === item.to }]"
            text
            @click="navigate(item.to)"
          />
        </li>
      </ul>
    </nav>

    <Divider class="divider" />

    <div class="user-block" v-if="userEmail">
      <Avatar :label="avatarInitials" shape="circle" class="user-avatar" />
      <div class="user-details">
        <span class="user-name">{{ userEmail }}</span>
        <Button
          label="Выйти"
          icon="pi pi-sign-out"
          size="small"
          severity="secondary"
          text
          @click="$emit('logout')"
        />
      </div>
    </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import Button from 'primevue/button';
import Divider from 'primevue/divider';
import Avatar from 'primevue/avatar';
import type { NavigationItem } from '../types/navigation';

const props = defineProps({
  userEmail: {
    type: String,
    default: '',
  },
  menuItems: {
    type: Array as PropType<NavigationItem[]>,
    default: () => [],
  },
});

const router = useRouter();
const route = useRoute();

const avatarInitials = computed(() => {
  if (!props.userEmail) return 'DR';
  const name = props.userEmail.split('@')[0] ?? '';
  return name.slice(0, 2).toUpperCase();
});

const navigate = (path: string) => {
  if (route.path !== path) {
    router.push(path);
  }
};
</script>

<style scoped>
.sidebar {
  width: 288px;
  min-height: 100vh;
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
}

.sidebar-content {
  height: 100%;
  max-height: 100vh;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.brand {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: inherit;
}

.brand-logo-img {
  width: 100%;
  height: auto;
  object-fit: contain;
}

.brand-description {
  margin: 0;
  color: #475569;
  line-height: 1.5;
  font-size: 0.95rem;
}

.divider {
  margin: 0;
}

.nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-button {
  justify-content: flex-start;
  width: 100%;
  color: #0f172a;
}

.nav-button.is-active {
  background: rgba(13, 110, 253, 0.08);
  border-radius: 10px;
}

.user-block {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
}

.user-avatar {
  background: #0d6efd;
  color: #ffffff;
  font-weight: 600;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.user-name {
  font-size: 0.9rem;
  color: #0f172a;
  word-break: break-all;
}

@media (max-width: 1024px) {
  .sidebar {
    width: 260px;
  }
}

@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
}
</style>
