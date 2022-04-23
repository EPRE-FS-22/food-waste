<script setup lang="ts">
  import Panel from '../components/Panel.vue';
  import Waste from '../components/Waste.vue';
  import Ranking from '../components/Ranking.vue';
  import { ranking } from '../settings';
  import { useRouter } from 'vue-router';
  import { authFailure, checkSession } from '../data';
  const router = useRouter();

  authFailure.subscribe(() => {
    router.push('/login');
  });

  checkSession();
</script>

<template>
  <div class="page">
    <Panel v-if="!ranking"> </Panel>
    <Ranking v-if="ranking"> </Ranking>
    <Waste v-else> </Waste>
  </div>
</template>
