<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import type { DishPreference } from '../../../backend/src/model';
  import SearchWiki from '../components/SearchWiki.vue';
  import {
    addDishPreference,
    authFailure,
    checkSession,
    getDishPreferences,
    hasConfirmedUserSession,
    hasUserSession,
    removeDishPreference,
  } from '../data';
  import { resetState } from '../settings';
  const router = useRouter();

  authFailure.subscribe(() => {
    resetState();
    router.push('/login');
  });

  if (!hasUserSession()) {
    router.push('/admin');
  } else if (!hasConfirmedUserSession()) {
    router.push('/login');
  } else {
    checkSession();
  }

  let userInputPreference = ref('');
  let dishPreferences = ref([] as DishPreference[]);
  (async () => {
    try {
      const result = await getDishPreferences();
      if (result) {
        resetState();
        dishPreferences.value = result;
      }
    } catch (e: unknown) {
      console.error(e);
      throw e;
    }
  })();

  watch(userInputPreference, async () => {
    try {
      if (
        userInputPreference.value &&
        !dishPreferences.value.find(
          (item) => item.dish === userInputPreference.value
        )
      ) {
        const result = await addDishPreference(userInputPreference.value, true);
        if (result) {
          resetState();
          dishPreferences.value = result;
        }
      }
    } catch (e: unknown) {
      console.error(e);
      throw e;
    }
  });

  const deletePreferences = async (dish: string) => {
    try {
      const result = await removeDishPreference(dish);
      if (result) {
        dishPreferences.value = result;
      }
    } catch (e: unknown) {
      console.error(e);
      throw e;
    }
  };
</script>

<template>
  <div class="content-base preferences-section">
    <div class="preferences">Set Up Your preferences</div>
    <div class="preferences-list-title">Your Preferences:</div>
    <div v-for="(dishPreference, index) in dishPreferences" :key="index">
      <p class="preferences-list-text">{{ dishPreference.dish }}</p>
      <button
        v-if="dishPreferences.length > 1"
        @click="deletePreferences(dishPreference.dish)"
      >
        delete
      </button>
    </div>
    <SearchWiki v-model="userInputPreference"></SearchWiki>
  </div>
</template>

<style lang="scss">
  .preferences-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 2rem;
  }
  .preferences-list-title {
    font-size: 1.75rem;
  }

  .preferences-list-text {
    font-size: 1.5rem;
  }
</style>
