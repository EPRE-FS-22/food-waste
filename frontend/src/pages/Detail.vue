<script setup lang="ts">
  import { useRoute } from 'vue-router';

  const route = useRoute();

  var title = 'Pizza';

  var description =
    'I bought too much flour, so I opened this offer. I expect 2 person who could eat with me.';

  var personCount = 2;
  console.log(route.params.id);
</script>

<template>
  <div class="content-base detail">
    <div class="detail-margin">
      <h1>{{ title }}</h1>
      <div class="description-section">
        <h4>Description</h4>
        <p>{{ description }}</p>
      </div>
      <p style="text-align: center">Number of people: {{ personCount }}</p>
      <div class="button-section">
        <router-link to="/">
          <img src="../assets/icons8-cancel-128.png" />
        </router-link>
        <router-link to="/">
          <img src="../assets/icons8-check-circle-128.png" />
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .detail {
    overflow-y: auto;
    .detail-margin {
      margin: 10%;
    }
  }

  .description-section {
    h4 {
      margin-left: 10px;
      margin-right: 10px;
    }
    p {
      margin-left: 10px;
      margin-right: 10px;
    }
    border: 2px solid white;
    border-radius: 20px;
    margin-bottom: 80px;
  }

  .button-section {
    text-align: center;
  }
</style>
