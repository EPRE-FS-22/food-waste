<script setup lang="ts">
  import Waste from '../components/Waste.vue';
  import Ranking from '../components/Ranking.vue';
  import { ranking } from '../settings';
</script>

<template>
  <div class="page">
    <Ranking v-if="ranking" :allow-edit="false"> </Ranking>
    <Waste v-else :allow-edit="false"> </Waste>
  </div>
</template>
