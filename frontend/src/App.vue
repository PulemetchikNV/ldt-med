<script setup lang="ts">
import { computed, defineComponent, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
import AppLayout from './layouts/AppLayout.vue';

const authStore = useAuthStore();
const route = useRoute();

const PlainLayout = defineComponent({
  name: 'PlainLayout',
  setup(_, { slots }) {
    return () => slots.default?.();
  },
});

const layoutComponent = computed(() => {
  if (route.meta.layout === 'app') {
    return AppLayout;
  }
  return PlainLayout;
});

onMounted(() => {
  authStore.checkAuth();
});
</script>

<template>
  <router-view v-slot="{ Component }">
    <component :is="layoutComponent">
      <component :is="Component" />
    </component>
  </router-view>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
