<script setup lang="ts">
  import { useRouter } from 'vue-router';
  import {
    authFailure,
    checkSession,
    hasConfirmedUserSession,
    hasConfirmedUserSessionWithPreferences,
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
  } else if (!hasConfirmedUserSessionWithPreferences()) {
    router.push('/preferences');
  } else {
    checkSession();
  }
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
