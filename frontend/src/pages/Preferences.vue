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

  const city = ref('');
  const dishPreferences = ref([] as DishPreference[]);
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

  watch(city, async () => {
    try {
      if (
        city.value &&
        !dishPreferences.value.find((item) => item.dish === city.value)
      ) {
        const result = await addDishPreference(city.value, true);
        if (result) {
          resetState();
          dishPreferences.value = result;
          city.value = '';
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
    <div
      v-for="(dishPreference, index) in dishPreferences"
      :key="index"
      class="preference"
    >
      <p class="preferences-list-text">{{ dishPreference.dish }}</p>
      <span
        v-if="dishPreferences.length > 1"
        class="icon icon-trash"
        @click="deletePreferences(dishPreference.dish)"
      >
      </span>
    </div>
    <SearchWiki
      v-model="city"
      name="city"
      placeholder="Pizza"
      class="field city preferences-item"
      :maxlength="200"
    ></SearchWiki>
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

  .preferences-item {
    margin: 0.5rem;
  }

  .preferences-list-text {
    font-size: 1.5rem;
  }

  .preference {
    display: flex;

    .icon {
      margin-top: 30px;
      cursor: pointer;
    }
  }

  .field {
    height: 1rem;
    font-size: 1rem;
    line-height: 1rem;
    width: 90%;
    max-width: 40vh;
    max-width: calc((40 * (100vh - var(--vh-offset, 0px)) / 100));
    padding: 0.25rem;
    border: solid 0.1rem rgb(179, 179, 179);
    border-radius: 1rem;
    box-shadow: 0 0.125rem 0.125rem rgba(0, 0, 0, 0.3);
  }
</style>
