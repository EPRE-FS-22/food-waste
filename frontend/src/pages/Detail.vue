<script setup lang="ts">
  import { ref } from 'vue';
  import type { DisplayDish } from '../model';
  import { useRouter, useRoute } from 'vue-router';
  import {
    authFailure,
    checkSession,
    hasUserSession,
    addDishRequest,
    hasConfirmedUserSession,
    hasConfirmedUserSessionWithPreferences,
    lastDish,
    getAvailableDish,
    acceptDishRequest,
    unacceptDishRequest,
  } from '../data';
  const router = useRouter();

  authFailure.subscribe(() => {
    router.push('/login');
  });

  const route = useRoute();

  let isPlan = false;

  if (router.currentRoute.value.path.startsWith('/plan/')) {
    isPlan = true;
  }

  console.log('Plan: ' + isPlan);

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
      if (isPlan) {
        router.push('/plans');
      }
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

  const acceptNames = async () => {
    try {
      console.log('accept');
      const result = await acceptDishRequest(route.params.id.toString());
      console.log(result);
      if (result) {
        router.push('/plans');
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const unacceptNames = async () => {
    try {
      const result = await unacceptDishRequest(route.params.id.toString());
      if (result) {
        router.push('/plans');
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  console.log(currentDish.value);
</script>

<template>
  <div class="content-base detail">
    <template v-if="currentDish">
      <div class="detail-margin">
        <h1>{{ currentDish.dish }}</h1>
        <div class="description-section">
          <h4>Description</h4>
          <p>{{ currentDish.dishDescription }}</p>
        </div>
        <p style="text-align: center">
          Number of people: {{ currentDish.slots }}
        </p>
        <div v-if="!isPlan" class="button-section">
          <router-link to="/user">
            <span class="icon cancel icon-cancel-circled"></span>
          </router-link>
          <div @click="acceptOffer">
            <span class="icon ok icon-ok-circled"></span>
          </div>
        </div>
        <div v-if="isPlan && !currentDish.participantName" class="acceptNames">
          <p v-if="currentDish.participantRequestsNames.length > 0">
            people requests to join:
          </p>
          <div
            v-for="(name, index) in currentDish.participantRequestsNames"
            :key="index"
          >
            <p>{{ name }}</p>
          </div>
          <div class="button-section">
            <div @click="unacceptNames()">
              <span class="icon cancel icon-cancel-circled"></span>
            </div>
            <div @click="acceptNames()">
              <span class="icon ok icon-ok-circled"></span>
            </div>
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

  .acceptNames {
    text-align: center;
    margin-top: 100px;
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
    cursor: pointer;
  }
</style>
