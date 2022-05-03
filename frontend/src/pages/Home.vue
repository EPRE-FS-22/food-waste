<script setup lang="ts">
  import { DisplayType } from '../settings';
  import Waste from '../components/Waste.vue';
  import { hasSession, isLoggingOut } from '../data';
  import { useRouter } from 'vue-router';
  const router = useRouter();

  if (!isLoggingOut() && hasSession()) {
    router.push('/user');
  }
</script>

<template>
  <div class="page">
    <Waste :small="false" :type="DisplayType.available"> </Waste>
  </div>
</template>
