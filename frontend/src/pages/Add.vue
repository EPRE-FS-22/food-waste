<script setup lang="ts">
  import { useRouter } from 'vue-router';
  import {
    addDish,
    authFailure,
    checkSession,
    clearCaches,
    getUserInfo,
    hasConfirmedUserSession,
    hasConfirmedUserSessionWithPreferences,
    hasUserSession,
  } from '../data';
  import SearchWiki from '../components/SearchWiki.vue';
  import { ref } from 'vue';
  import moment from 'moment';
  import {
    resetSettings,
    resetSettingsMessages,
    resetState,
  } from '../settings';
  const router = useRouter();

  authFailure.subscribe(() => {
    resetState();
    resetSettings();
    resetSettingsMessages();
    router.push('/login');
  });

  const inProgress = ref(false);

  const previousCity = ref('');
  const city = ref('');
  const cityMessage = ref('');
  const previousLocation = ref('');
  const location = ref('');
  const locationMessage = ref('');
  const dish = ref('');
  const dishMessage = ref('');
  const personNr = ref(1);
  const personNrMessage = ref('');
  const description = ref('');
  const descriptionMessage = ref('');
  const dateOfEvent = ref(null as Date | null);
  const dateOfEventMessage = ref('');

  if (!hasUserSession()) {
    router.push('/admin');
  } else if (!hasConfirmedUserSession()) {
    router.push('/login');
  } else if (!hasConfirmedUserSessionWithPreferences()) {
    router.push('/preferences');
  } else {
    checkSession();
    (async () => {
      try {
        const userInfo = await getUserInfo();
        if (userInfo) {
          if (!city.value && userInfo.locationCity) {
            previousCity.value = userInfo.locationCity;
            city.value = userInfo.locationCity;
          }
          if (!location.value && userInfo.exactLocation) {
            previousLocation.value = userInfo.exactLocation;
            location.value = userInfo.exactLocation;
          }
        }
      } catch (e) {
        console.error(e);
        throw e;
      }
    })();
  }

  const addInvite = async () => {
    try {
      dishMessage.value = '';
      personNrMessage.value = '';
      descriptionMessage.value = '';
      dateOfEventMessage.value = '';
      let date: Date | null = null;
      if (dateOfEvent.value) {
        date = moment(dateOfEvent.value).toDate();
      }
      if (
        !(
          dish.value === '' ||
          personNr.value <= 0 ||
          description.value === '' ||
          !date ||
          isNaN(date.getTime()) ||
          date.getTime() < Date.now() ||
          city.value === '' ||
          location.value === ''
        )
      ) {
        inProgress.value = true;
        const result = await addDish(
          dish.value,
          personNr.value,
          date,
          city.value === previousCity.value ? undefined : city.value,
          location.value === previousLocation.value
            ? undefined
            : location.value,
          description.value
        );
        if (result) {
          clearCaches(false, false, true, false);
          router.push('/plans');
        }
      } else {
        if (!date || isNaN(date.getTime()) || date.getTime() < Date.now()) {
          dateOfEventMessage.value =
            'Please set Correct Date & it must be in the future';
        }
        if (dish.value === '') {
          dishMessage.value =
            "Search text is not correct (don't forget to choose from the List)";
        }
        if (description.value === '') {
          descriptionMessage.value = 'Description is missing';
        }
        if (personNr.value <= 0) {
          personNrMessage.value =
            'Number of people is incorrect, set 1 or higher';
        }
        if (!city.value) {
          cityMessage.value =
            'Please enter your city, find a city for which a dropdown appears and pick one of the options, it may take some time for the dropdown to appear';
        }
        if (!location.value) {
          locationMessage.value = 'Please enter your address';
        }
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };
</script>

<template>
  <div class="content-base add">
    <div class="add-margin">
      <label class="label name-label add-item" for="name"
        >Search your Dish (Select from shown List){{
          dishMessage ? ': ' + dishMessage : ''
        }}<br />
      </label>
      <SearchWiki
        id="dish"
        v-model="dish"
        name="dish"
        placeholder="Pizza"
        class="field dish add-item"
        :maxlength="50"
        @keyup.enter="addInvite()"
      ></SearchWiki>
      <label class="label name-label add-item" for="name"
        >How many people?{{ personNrMessage ? ': ' + personNrMessage : ''
        }}<br />
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
        @keyup.enter="addInvite()"
      />

      <label class="label date-of-birth-label" for="date-of-event"
        >Please enter the Date{{
          dateOfEventMessage ? ': ' + dateOfEventMessage : ''
        }}<br />
      </label>
      <input
        id="date-of-event"
        v-model="dateOfEvent"
        type="datetime-local"
        class="field date-of-event"
        name="date-of-event"
        placeholder="20.06.2022"
        @keyup.enter="addInvite()"
      />

      <label class="label name-label add-item" for="name"
        >Short Description{{
          descriptionMessage ? ': ' + descriptionMessage : ''
        }}<br />
      </label>
      <textarea
        id="description"
        v-model="description"
        class="textarea name add-item"
        name="description"
        placeholder="Hello..."
        maxlength="200"
      ></textarea>

      <label class="label city-label add-item" for="city"
        >Please enter the city you live in{{
          cityMessage ? ': ' + cityMessage : ''
        }}
      </label>
      <SearchWiki
        id="city"
        v-model="city"
        :only-coords="true"
        name="city"
        placeholder="Zug"
        class="field city add-item"
        :maxlength="100"
        :previous-value="previousCity"
        @keyup.enter="addInvite()"
      ></SearchWiki>
      <label class="label location-label add-item" for="location"
        >Please enter your exact address{{
          locationMessage ? ': ' + locationMessage : ''
        }}
      </label>
      <input
        id="location"
        v-model="location"
        type="text"
        class="field location add-item"
        name="location"
        placeholder="Teststrasse 1, 6300 Zug"
        maxlength="1000"
        @keyup.enter="addInvite()"
      />
      <button class="invite-button" :disabled="inProgress" @click="addInvite()">
        Invite Now
      </button>
    </div>
  </div>
</template>

<style lang="scss">
  .add {
    overflow-y: auto;
  }

  .add-margin {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
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
