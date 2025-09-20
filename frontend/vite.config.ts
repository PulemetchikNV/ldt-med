import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 8080
  },
  define: {
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false'
  }
})
