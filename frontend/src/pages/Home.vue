<script setup lang="ts">
  import {
    DisplayType,
    resetSettings,
    resetSettingsMessages,
    resetState,
  } from '../settings';
  import Waste from '../components/Waste.vue';
  import {
    authFailure,
    checkSession,
    hasSession,
    hasUserSession,
    isLoggingOut,
  } from '../data';
  import { useRouter } from 'vue-router';
  const router = useRouter();

  authFailure.subscribe(() => {
    resetState();
    resetSettings();
    resetSettingsMessages();
  });

  if (!isLoggingOut() && hasSession()) {
    if (hasUserSession()) {
      router.push('/user');
    } else {
      router.push('/admin');
    }
  } else {
    checkSession(false, true);
  }
</script>

<template>
  <div class="page">
    <Waste :small="false" :type="DisplayType.available"> </Waste>
  </div>
</template>
