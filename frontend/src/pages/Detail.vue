<script setup lang="ts">
  import { ref } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import {
    authFailure,
    checkSession,
    hasUserSession,
    addDishRequest,
    hasConfirmedUserSession,
    hasConfirmedUserSessionWithPreferences,
    lastDish,
    getAvailableDish,
  } from '../data';
  const router = useRouter();

  authFailure.subscribe(() => {
    router.push('/login');
  });

  const route = useRoute();

  if (!route.params.id || typeof route.params.id != 'string') {
    router.push('/user');
  } else if (!hasUserSession()) {
    router.push('/admin');
  } else if (!hasConfirmedUserSession()) {
    router.push('/login');
  } else if (!hasConfirmedUserSessionWithPreferences()) {
    router.push('/preferences');
  } else {
    checkSession();
  }

  const currentDish = ref(lastDish.value);
  if (!currentDish.value) {
    (async () => {
      try {
        const result = await getAvailableDish(route.params.id as string);
        if (result) {
          currentDish.value = result;
        }
      } catch (e) {
        console.error(e);
        throw e;
      }
    })();
  }

  const description =
    'I bought too much flour, so I opened this offer. I expect 2 person who could eat with me.';

  const personCount = 2;

  const acceptOffer = async () => {
    try {
      const result = await addDishRequest(route.params.id.toString());
      if (result) {
        router.push('/plans');
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
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
          <router-link to="/user">
            <span class="icon cancel icon-cancel-circled"></span>
          </router-link>
          <div @click="acceptOffer">
            <span class="icon ok icon-ok-circled"></span>
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

    .icon {
      color: #ffffff;
      font-size: 4rem;

      &.cancel {
        color: #d81a1af0;
      }

      &.ok {
        color: #1dd81af0;
      }
    }
  }
</style>
