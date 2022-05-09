import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import Home from './pages/Home.vue';
import Admin from './pages/Admin.vue';
import User from './pages/User.vue';
import Add from './pages/Add.vue';
import Plans from './pages/Plans.vue';
import Login from './pages/Login.vue';
import Preferences from './pages/Preferences.vue';

import vhCheck from 'vh-check';
vhCheck();

import './styles.scss';
import { APP_NAME } from '../../backend/src/constants';

document.title = APP_NAME;

const routes = [
  { path: '/', component: Home },
  { path: '/admin', component: Admin },
  { path: '/user', component: User },
  { path: '/add', component: Add },
  { path: '/plans', component: Plans },
  { path: '/login', component: Login },
  { path: '/preferences', component: Preferences },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const app = createApp(App);
app.use(router);
app.mount('#app');
