<script setup lang="ts">
  import Panel from '../components/Panel.vue';
  import Waste from '../components/Waste.vue';
  import { DisplayType, resetState } from '../settings';
  import { useRouter } from 'vue-router';
  import { authFailure, checkSession } from '../data';
  const router = useRouter();

  authFailure.subscribe(() => {
    resetState();
    router.push('/login');
  });

  checkSession(true);
</script>

<template>
  <div class="page">
    <Panel></Panel>
    <Waste :small="true" :type="DisplayType.available"> </Waste>
  </div>
</template>
