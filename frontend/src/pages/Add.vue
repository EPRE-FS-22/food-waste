<script setup lang="ts">
  import { useRouter } from 'vue-router';
  import {
    authFailure,
    checkSession,
    hasConfirmedUserSession,
    hasConfirmedUserSessionWithPreferences,
    hasUserSession,
  } from '../data';
  import SearchWiki from '../components/SearchWiki.vue';
  import { ref } from 'vue';
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

  const personNr = ref(1);
  const description = ref('');

  const addInvite = () => {
    console.log('addInvite');
  };
</script>

<template>
  <div class="add">
    <label class="label name-label add-item" for="name"
      >Search your Dish
    </label>
    <SearchWiki></SearchWiki>
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
