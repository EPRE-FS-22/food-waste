<script setup lang="ts">
  import { ref } from 'vue';
  import type { DisplayDish } from '../model';
  import { useRoute, useRouter } from 'vue-router';
  import {
    authFailure,
    checkSession,
    hasUserSession,
    lastDish,
    addDishRequest,
  } from '../data';
  const router = useRouter();

  authFailure.subscribe(() => {
    router.push('/login');
  });

  if (!hasUserSession()) {
    router.push('/admin');
  }
  checkSession();

  const route = useRoute();

  const currentDish = ref(null as null | DisplayDish);

  lastDish.subscribe((item) => {
    console.log(item);
    currentDish.value = item;
  });

  const description =
    'I bought too much flour, so I opened this offer. I expect 2 person who could eat with me.';

  const personCount = 2;
  console.log(route.params.id);

  const acceptOffer = () => {
    addDishRequest(route.params.id.toString());
  };
</script>

<template>
  <div class="content-base detail">
    <template v-if="currentDish">
      <div class="detail-margin">
        <h1>{{ currentDish.dish }}</h1>
        <div class="description-section">
          <h4>Description</h4>
          <p>{{ description }}</p>
        </div>
        <p style="text-align: center">Number of people: {{ personCount }}</p>
        <div class="button-section">
          <router-link to="/">
            <img src="../assets/icons8-cancel-128.png" />
          </router-link>
          <div @click="acceptOffer">
            <img src="../assets/icons8-check-circle-128.png" />
          </div>
        </div>
      </div>
    </template>
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
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
