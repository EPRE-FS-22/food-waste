import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import Home from './pages/Home.vue';
import Admin from './pages/Admin.vue';
import User from './pages/User.vue';
import Login from './pages/Login.vue';
import Ranking from './components/Ranking.vue';

import './styles.scss';

const routes = [
  { path: '/', component: Home },
  { path: '/admin', component: Admin },
  { path: '/user', component: User },
  { path: '/login', component: Login },
  { path: '/ranking', component: Ranking },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const app = createApp(App);
app.use(router);
app.mount('#app');
