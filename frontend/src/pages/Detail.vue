<script setup lang="ts">
  import { ref } from 'vue';
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
    getMyDish,
    getSignedUpDish,
    clearCaches,
    unacceptDishRequest,
  } from '../data';
  import {
    resetSettings,
    resetSettingsMessages,
    resetState,
  } from '../settings';
  import moment from 'moment';
  const router = useRouter();

  authFailure.subscribe(() => {
    resetState();
    resetSettings();
    resetSettingsMessages();
    router.push('/login');
  });

  const route = useRoute();

  let isMine = false;
  let isPlan = false;

  const currentDish = ref(lastDish.value);

  if (router.currentRoute.value.path.startsWith('/host/')) {
    isMine = true;
    if (currentDish.value && currentDish.value.type !== 'info') {
      currentDish.value = null;
    }
  } else if (router.currentRoute.value.path.startsWith('/plan/')) {
    isPlan = true;
    if (currentDish.value && currentDish.value.type !== 'event') {
      currentDish.value = null;
    }
  } else if (currentDish.value && currentDish.value.type !== 'normal') {
    currentDish.value = null;
  }

  if (!route.params.id || typeof route.params.id != 'string') {
    if (hasUserSession()) {
      router.push('/user');
    } else {
      router.push('/admin');
    }
  } else if (!hasUserSession()) {
    router.push('/admin');
  } else if (!hasConfirmedUserSession()) {
    router.push('/login');
  } else if (!hasConfirmedUserSessionWithPreferences()) {
    router.push('/preferences');
  } else {
    checkSession();
  }
  if (!currentDish.value) {
    (async () => {
      try {
        if (isMine) {
          const result = await getMyDish(route.params.id as string);
          if (result) {
            currentDish.value = { type: 'info', dish: result };
          }
        } else if (isPlan) {
          const result = await getSignedUpDish(route.params.id as string);
          if (result) {
            currentDish.value = { type: 'event', dish: result };
          }
        } else {
          const result = await getAvailableDish(route.params.id as string);
          if (result) {
            currentDish.value = { type: 'normal', dish: result };
          }
        }
        if (!currentDish.value) {
          router.push(isMine || isPlan ? '/plans' : '/user');
        }
      } catch (e) {
        console.error(e);
        throw e;
      }
    })();
  }

  let acceptInProgress = false;

  const acceptOffer = async () => {
    try {
      if (
        !acceptInProgress &&
        currentDish.value &&
        currentDish.value.type === 'normal'
      ) {
        acceptInProgress = true;
        const result = await addDishRequest(currentDish.value.dish.customId);
        if (result) {
          clearCaches(true, true, false, true);
          router.push('/plans');
        }
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const acceptIdsInProgress: string[] = [];

  const acceptNames = async (index: number) => {
    try {
      if (currentDish.value && currentDish.value.type === 'info') {
        const event = currentDish.value.dish.eventRequestsIds[index];
        if (event && !acceptIdsInProgress.includes(event)) {
          acceptIdsInProgress.push(event);
          const result = await acceptDishRequest(event);
          if (result) {
            clearCaches(false, false, true, false);
            const newDish = await getMyDish(route.params.id as string);
            acceptIdsInProgress.splice(acceptIdsInProgress.indexOf(event), 1);
            if (newDish) {
              currentDish.value = { type: 'info', dish: newDish };
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const unacceptNames = async (index: number) => {
    try {
      if (currentDish.value && currentDish.value.type === 'info') {
        console.log(currentDish.value.dish.eventIds);
        const event = currentDish.value.dish.eventIds[index];
        if (event && !acceptIdsInProgress.includes(event)) {
          acceptIdsInProgress.push(event);
          const result = await unacceptDishRequest(event);
          if (result) {
            clearCaches(false, false, true, false);
            const newDish = await getMyDish(route.params.id as string);
            acceptIdsInProgress.splice(acceptIdsInProgress.indexOf(event), 1);
            if (newDish) {
              currentDish.value = { type: 'info', dish: newDish };
            }
          }
        }
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
        <h1>{{ currentDish.dish.dish }}</h1>
        <div class="description-section">
          <h4>Description</h4>
          <p>{{ currentDish.dish.dishDescription }}</p>
        </div>
        <p class="info-section">
          Hosted by
          {{
            currentDish.type !== 'info'
              ? currentDish.dish.name +
                (currentDish.dish.age ? ', ' + currentDish.dish.age : '')
              : 'you'
          }}
        </p>
        <p
          v-if="currentDish.type !== 'info' && currentDish.dish.locationCity"
          class="info-section"
        >
          In {{ currentDish.dish.locationCity }}
        </p>
        <p
          v-if="
            currentDish.type !== 'normal' &&
            (currentDish.type !== 'event' || currentDish.dish.accepted) &&
            currentDish.dish.exactLocation
          "
          class="info-section"
        >
          At {{ currentDish.dish.exactLocation }}
        </p>
        <p class="info-section">
          {{ moment(currentDish.dish.date).format('DD. MM. YYYY HH:MM') }}
        </p>
        <p class="info-section">
          Maximum number of people: {{ currentDish.dish.slots }}
        </p>
        <p class="info-section">
          Current number of people: {{ currentDish.dish.filled }}
        </p>

        <div v-if="currentDish.type === 'normal'" class="button-section">
          <router-link to="/user">
            <span class="icon cancel icon-cancel-circled"></span>
          </router-link>
          <div @click="acceptOffer">
            <span class="icon ok icon-ok-circled"></span>
          </div>
        </div>
        <div v-else-if="currentDish.type === 'info'" class="acceptNames">
          <p v-if="currentDish.dish.participantNames.length > 0">
            Participants:
          </p>
          <div
            v-for="(name, index) in currentDish.dish.participantNames"
            :key="index"
            class="participant"
          >
            <span>{{ name }}</span>
            <div class="button-section">
              <div @click="unacceptNames(index)">
                <span class="icon icon-small cancel icon-cancel-circled"></span>
              </div>
            </div>
          </div>
          <template v-if="currentDish.dish.slots == currentDish.dish.filled">
            <p>Your event is full</p>
          </template>
          <template v-else>
            <p v-if="currentDish.dish.participantRequestsNames.length > 0">
              People's requests to join:
            </p>
            <div
              v-for="(name, index) in currentDish.dish.participantRequestsNames"
              :key="index"
              class="participant"
            >
              <span>{{ name }}</span>
              <div class="button-section">
                <div @click="acceptNames(index)">
                  <span class="icon icon-small ok icon-ok-circled"></span>
                </div>
              </div>
            </div>
          </template>
        </div>
        <div v-else class="info-section">
          {{
            currentDish.dish.accepted
              ? 'Your request was accepted'
              : 'Your request was not yet accepted'
          }}
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
    margin-top: 2.5rem;
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

  .info-section {
    text-align: center;
  }

  .button-section {
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;

    .icon {
      color: #ffffff;
      font-size: 4rem;

      &.icon-small {
        font-size: 2rem;
      }

      &.cancel {
        color: #d81a1af0;
      }

      &.ok {
        color: #1dd81af0;
      }
    }
    cursor: pointer;
  }

  .participant {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
  }
</style>
