<script setup lang="ts">
  import { ranking, secret } from '../settings';
</script>

<template>
  <div class="header">
    <router-link to="/" class="header-container">
      <img src="../assets/mllonelogo.png" class="logo" />
      <div class="title">Waste</div>
    </router-link>
    <button v-if="secret" class="view-toggle" @click="ranking = !ranking">
      {{ ranking ? 'Ranking' : 'Overview' }}
    </button>
  </div>
</template>

<style scoped lang="scss">
  .header {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
    height: 12vh;
  }

  .header-container {
    width: min-content;
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    color: unset;
    text-decoration: none;
  }

  .logo {
    margin-left: 3.5vh;
    margin-right: 3.5vh;
    height: 10vh;
    cursor: pointer;
  }

  .title {
    font-weight: bold;
    font-size: 9vh;
    line-height: 10vh;
  }

  .view-toggle {
    margin-left: auto;
    margin-right: 0.75rem;
    margin-top: 0;
    margin-bottom: 0.6rem;
    height: 2.1rem;
    font-size: 1rem;
    line-height: 1rem;
    font-weight: bold;
    padding: 0.45rem;
    background-color: #ffffff;
    border: solid 0.1rem rgb(179, 179, 179);
    border-radius: 1rem;
    box-shadow: 0 0.125rem 0.125rem rgba(0, 0, 0, 0.3);
  }

  @media (max-aspect-ratio: 1/1) {
    .header {
      height: 12vw;
    }

    .logo {
      margin-left: 1.75vw;
      margin-right: 1.75vw;
      height: 10vw;
    }

    .title {
      font-weight: bold;
      font-size: 9vw;
      line-height: 10vw;
    }

    .view-toggle {
      height: 1.7rem;
      font-size: 0.8rem;
      line-height: 0.8rem;
      padding: 0.35rem;
    }
  }
</style>
