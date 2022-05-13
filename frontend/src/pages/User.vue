<script setup lang="ts">
  import Panel from '../components/Panel.vue';
  import Waste from '../components/Waste.vue';
  import {
    DisplayType,
    resetSettings,
    resetSettingsMessages,
    resetState,
  } from '../settings';
  import { useRouter } from 'vue-router';
  import {
    authFailure,
    checkSession,
    hasConfirmedUserSession,
    hasConfirmedUserSessionWithPreferences,
    hasUserSession,
  } from '../data';
  const router = useRouter();

  authFailure.subscribe(() => {
    resetState();
    resetSettings();
    resetSettingsMessages();
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
  <div class="page">
    <Panel></Panel>
    <Waste :small="true" :type="DisplayType.recommended"> </Waste>
  </div>
</template>
