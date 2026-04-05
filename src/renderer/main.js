import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './assets/base.css';
import 'md-editor-v3/lib/style.css';

createApp(App).use(createPinia()).mount('#app');
