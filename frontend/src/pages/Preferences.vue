<script setup lang="ts">
  import { useRouter } from 'vue-router';
  import {
    authFailure,
    checkSession,
    hasConfirmedUserSession,
    hasUserSession,
  } from '../data';
  import { resetState } from '../settings';
  const router = useRouter();

  authFailure.subscribe(() => {
    resetState();
    router.push('/login');
  });

  if (!hasUserSession()) {
    router.push('/admin');
  } else if (!hasConfirmedUserSession()) {
    router.push('/login');
  } else {
    checkSession();
  }
</script>

<template>
  <div class="content-base preferences">Preferences</div>
</template>

<style lang="scss">
  .preferences {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    overflow-y: auto;
    font-size: 2rem;
  }
</style>
