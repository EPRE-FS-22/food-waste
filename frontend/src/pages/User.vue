<script setup lang="ts">
  import Waste from '../components/Waste.vue';
  import Ranking from '../components/Ranking.vue';
  import { ranking } from '../settings';
  import { useRouter } from 'vue-router';
  import { authFailure, checkSession, hasModifiableSession } from '../data';
  const router = useRouter();

  authFailure.subscribe(() => {
    router.push('/login');
  });

  if (!hasModifiableSession()) {
    router.push('/admin');
  }
  checkSession();
</script>

<template>
  <div class="page">
    <Ranking v-if="ranking" :allow-edit="false"> </Ranking>
    <Waste v-else :allow-edit="false"> </Waste>
  </div>
</template>
