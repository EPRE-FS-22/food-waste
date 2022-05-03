<script setup lang="ts">
  import { useRouter } from 'vue-router';
  import { authFailure, checkSession, hasUserSession } from '../data';
  const router = useRouter();

  authFailure.subscribe(() => {
    router.push('/login');
  });

  if (!hasUserSession()) {
    router.push('/admin');
  }
  checkSession();
</script>

<template>
  <div class="content-base add">Add</div>
</template>

<style lang="scss">
  .add {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    font-size: 2rem;
  }
</style>
