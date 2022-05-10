<script setup lang="ts">
  import { useRouter } from 'vue-router';
  import {
    addDish,
    authFailure,
    checkSession,
    hasConfirmedUserSession,
    hasConfirmedUserSessionWithPreferences,
    hasUserSession,
  } from '../data';
  import SearchWiki from '../components/SearchWiki.vue';
  import { ref } from 'vue';
  import moment from 'moment';
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
  } else if (!hasConfirmedUserSessionWithPreferences()) {
    router.push('/preferences');
  } else {
    checkSession();
  }

  const userInputEvent = ref('');
  const personNr = ref(1);
  const description = ref('');
  const dateOfEvent = ref(null as Date | null);

  const addInvite = async () => {
    let date: Date | null = null;
    console.log(personNr.value);
    if (dateOfEvent.value) {
      date = moment(dateOfEvent.value).toDate();
    }
    if (
      !(
        userInputEvent.value === '' ||
        personNr.value === null ||
        description.value === '' ||
        !date ||
        isNaN(date.getTime())
      )
    ) {
      try {
        const result = await addDish(
          userInputEvent.value,
          personNr.value,
          date,
          description.value
        );
        console.log(result);
        router.push('/user');
      } catch (e: unknown) {
        console.error(e);
        throw e;
      }
    } else {
      if (!date || isNaN(date.getTime())) {
        console.log('date error');
      }
      if (userInputEvent.value === '') {
        console.log('userinput');
      }
      if (description.value === '') {
        console.log('description');
      }
      if (personNr.value === null) {
        console.log('personNr');
      }
      console.log('error');
    }
  };
</script>

<template>
  <div class="add">
    <label class="label name-label add-item" for="name"
      >Search your Dish
    </label>
    <SearchWiki v-model="userInputEvent"></SearchWiki>
    <label class="label name-label add-item" for="name"
      >How many Persons?
    </label>
    <input
      id="personNr"
      v-model="personNr"
      type="number"
      class="field name add-item"
      name="personNr"
      placeholder="1"
      maxlength="2"
      min="1"
      max="20"
    />

    <label class="label date-of-birth-label" for="date-of-event"
      >Please enter the Date
    </label>
    <input
      id="date-of-event"
      v-model="dateOfEvent"
      type="date"
      class="field date-of-event"
      name="date-of-event"
      placeholder="20.06.2022"
    />

    <label class="label name-label add-item" for="name"
      >Short Description
    </label>
    <textarea
      id="description"
      v-model="description"
      type="text"
      class="textarea name add-item"
      name="description"
      placeholder="Hello..."
      maxlength="200"
    />
    <button class="invite-button" @click="addInvite()">Invite Now</button>
  </div>
</template>

<style lang="scss">
  .add {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    overflow-y: auto;
    margin-bottom: 100px;
  }

  .add-item {
    margin: 0.5rem;
  }

  .label {
    font-size: 1.2rem;
    line-height: 1.2rem;
    padding: 0;
    text-align: center;
    font-weight: bold;

    .label-button {
      font-size: 1.1rem;
      font-weight: normal;
      line-height: 1.2rem;
      color: rgb(226, 226, 226);
      text-decoration: underline;
      padding: 0;
      margin: 0;
      margin-top: 0.5rem;
      cursor: pointer;

      &.label-button-solo {
        margin: 0;
      }
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

  .textarea {
    font-size: 1rem;
    line-height: 1rem;
    width: 70%;
    padding: 0.25rem;
    border: solid 0.1rem rgb(179, 179, 179);
    border-radius: 1rem;
    box-shadow: 0 0.125rem 0.125rem rgba(0, 0, 0, 0.3);
  }

  .invite-button {
    box-sizing: border-box;
    height: 2.1rem;
    font-size: 1rem;
    line-height: 1rem;
    font-weight: bold;
    padding: 0.45rem;
    background-color: #ffffff;
    border: solid 0.1rem rgb(179, 179, 179);
    border-radius: 1rem;
    box-shadow: 0 0.125rem 0.125rem rgba(0, 0, 0, 0.3);
    text-decoration: none;
    color: #000000;
  }
</style>
