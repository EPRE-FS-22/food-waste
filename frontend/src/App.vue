<script setup lang="ts">
  import HeaderBar from './components/HeaderBar.vue';
  import Footer from './components/Footer.vue';
  import { loading } from './settings';
</script>

<template>
  <div
    class="loading"
    :class="{
      hide:
        !loading ||
        $router.currentRoute.value.path === '/login' ||
        $router.currentRoute.value.path === '/add' ||
        $router.currentRoute.value.path === '/preferences' ||
        $router.currentRoute.value.path.startsWith('/detail/') ||
        $router.currentRoute.value.path.startsWith('/plan/') ||
        $router.currentRoute.value.path.startsWith('/host/'),
    }"
  >
    Loading deliciousness...
  </div>
  <div class="container">
    <HeaderBar> </HeaderBar>
    <router-view v-slot="{ Component }">
      <transition name="fade">
        <component :is="Component" :key="$route.name" />
      </transition>
    </router-view>
    <Footer> </Footer>
  </div>
</template>

<style scoped lang="scss">
  .container {
    width: 100%;
    height: 100%;
    background: rgb(17, 17, 17);
    background: linear-gradient(
      137deg,
      rgba(17, 17, 17, 1) 0%,
      rgba(33, 33, 33, 1) 50%,
      rgba(62, 62, 62, 1) 100%
    );
    color: #ffffff;

    padding: 0;
    margin: 0;
    border: none;
  }

  .loading {
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    height: 100%;
    width: 100%;
    background: rgb(17, 17, 17);
    background: linear-gradient(
      137deg,
      rgba(17, 17, 17, 1) 0%,
      rgba(33, 33, 33, 1) 50%,
      rgba(62, 62, 62, 1) 100%
    );
    font-size: 2rem;
    text-align: center;
    color: #ffffff;
    padding: 0;
    margin: 0;
    border: none;
    z-index: 100;
  }

  .loading.hide {
    display: none;
  }
</style>
