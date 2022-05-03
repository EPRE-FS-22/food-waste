<script setup lang="ts">
  import Waste from '../components/Waste.vue';
  import { DisplayType } from '../settings';
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
  <div class="page">
    <Waste :small="false" :type="DisplayType.plans"> </Waste>
  </div>
</template>
