import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';
import router from './router';
import PrimeVue from 'primevue/config';
import theme from './plugins/primevue/theme';
import ToastService from 'primevue/toastservice';
import 'primeicons/primeicons.css'

const app = createApp(App);

app.use(PrimeVue, { theme });
app.use(ToastService);
app.use(createPinia());
app.use(router);
app.mount('#app');
