<script setup lang="ts">
  import { ref } from 'vue';
  import {
    clearCaches,
    depopulate,
    hasSession,
    populate,
    refreshDishes,
  } from '../data';
  import {
    loggedIn,
    userLoggedIn,
    settings,
    settingsMessages,
  } from '../settings';
  import SearchWiki from './SearchWiki.vue';
  const populateOnClick = async () => {
    try {
      if (hasSession(true)) {
        buttonDisabled.value = true;
        const result = await populate();
        clearCaches(true, false, false, false);
        buttonDisabled.value = false;
        refreshDishes.next();
        if (result) {
          alert('Success');
        } else {
          alert('Error');
        }
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const depopulateOnClick = async () => {
    try {
      if (hasSession(true)) {
        buttonDisabled.value = true;
        const result = await depopulate();
        clearCaches(true, false, false, false);
        buttonDisabled.value = false;
        refreshDishes.next();
        if (result) {
          alert('Success');
        } else {
          alert('Error');
        }
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };
  const buttonDisabled = ref(false);
</script>

<template>
  <div class="panel">
    <div v-if="loggedIn && !userLoggedIn">
      <button
        class="populate-button"
        :disabled="buttonDisabled"
        @click="populateOnClick()"
      >
        Populate
      </button>
      <button
        class="populate-button"
        :disabled="buttonDisabled"
        @click="depopulateOnClick()"
      >
        Depopulate
      </button>
    </div>
    <div class="location-range-container input-container">
      <label for="location-range"
        >Location range{{
          settingsMessages.locationRangeSize
            ? ': ' + settingsMessages.locationRangeSize
            : settingsMessages.locationRangeSize
        }}</label
      >
      <input
        id="location-range"
        v-model="settings.locationRangeSize"
        type="number"
        name="location-range"
        placeholder="10"
        :class="{
          warning:
            !settings.locationRangeSize || settingsMessages.locationRangeSize,
        }"
      />
    </div>
    <div class="age-range-container input-container">
      <label for="age-range"
        >Age range{{
          settingsMessages.ageRangeSize
            ? ': ' + settingsMessages.ageRangeSize
            : settingsMessages.ageRangeSize
        }}</label
      >
      <input
        id="age-range"
        v-model="settings.ageRangeSize"
        type="number"
        name="age-range"
        placeholder="10"
        :class="{
          warning: !settings.ageRangeSize || settingsMessages.ageRangeSize,
        }"
      />
    </div>
    <div class="date-start-container input-container">
      <label for="date-start"
        >Date from{{
          settingsMessages.dateStart
            ? ': ' + settingsMessages.dateStart
            : settingsMessages.dateStart
        }}</label
      >
      <div class="date-inner-container">
        <input
          id="date-start"
          v-model="settings.dateStart"
          type="datetime-local"
          name="date-start"
          placeholder="Date"
          :class="{
            warning: !settings.dateStart || settingsMessages.dateStart,
          }"
        />
      </div>
    </div>
    <div class="date-end-container input-container">
      <label for="date-end"
        >Date to{{
          settingsMessages.dateEnd
            ? ': ' + settingsMessages.dateEnd
            : settingsMessages.dateEnd
        }}</label
      >
      <div class="date-inner-container">
        <input
          id="date-end"
          v-model="settings.dateEnd"
          type="datetime-local"
          name="date-end"
          placeholder="Date"
          :class="{
            warning: !settings.dateEnd || settingsMessages.dateEnd,
          }"
        />
      </div>
    </div>
    <div class="location-city-container input-container">
      <label for="location-city"
        >City{{
          settingsMessages.locationCity
            ? ': ' + settingsMessages.locationCity
            : settingsMessages.locationCity
        }}</label
      >
      <SearchWiki
        id="city"
        v-model="settings.locationCity"
        :only-coords="true"
        name="city"
        placeholder="Zug"
        class="field city panel-item"
        :maxlength="100"
        :previous-value="settings.previousLocationCity"
      ></SearchWiki>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .panel {
    display: flex;
    flex-direction: row;
    justify-content: center;
    width: calc(100% - 1rem);
    height: calc(15vh - 1rem);
    height: calc((15 * (100vh - var(--vh-offset, 0px)) / 100) - 1rem);
    padding: 0.5rem;
    margin: 0;
    border: none;

    .populate-button {
      display: block;
      box-sizing: border-box;
      margin-left: none;
      margin-right: none;
      margin-top: 0;
      margin-bottom: 0.6rem;
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

    .input-container {
      display: flex;
      flex-direction: column;
      width: 25%;
      padding: 0.5rem;
      font-size: 3vh;
      font-size: calc((3 * (100vh - var(--vh-offset, 0px)) / 100));
      line-height: 3vh;
      line-height: calc((3 * (100vh - var(--vh-offset, 0px)) / 100));

      label {
        margin-left: 0.5vh;
        margin-left: calc((0.5 * (100vh - var(--vh-offset, 0px)) / 100));
        font-weight: bold;
      }

      > * {
        margin-top: 1vh;
        margin-top: calc((1 * (100vh - var(--vh-offset, 0px)) / 100));
      }

      > *:first-child {
        margin-top: 0;
      }

      input {
        height: 2vh;
        height: calc((2 * (100vh - var(--vh-offset, 0px)) / 100));
        font-size: 2vh;
        font-size: calc((2 * (100vh - var(--vh-offset, 0px)) / 100));
        line-height: 2vh;
        line-height: calc((2 * (100vh - var(--vh-offset, 0px)) / 100));
        width: 90%;
        padding: 0.5vh;
        padding: calc((0.5 * (100vh - var(--vh-offset, 0px)) / 100));
        margin: 0.5vh;
        margin: calc((0.5 * (100vh - var(--vh-offset, 0px)) / 100));
        margin-top: 1.5vh;
        margin-top: calc((3 * (100vh - var(--vh-offset, 0px)) / 100));
        border: solid 0.2vh rgb(179, 179, 179);
        border: solid calc((0.2 * (100vh - var(--vh-offset, 0px)) / 100))
          rgb(179, 179, 179);
        border-radius: 2vh;
        border-radius: calc((2 * (100vh - var(--vh-offset, 0px)) / 100));
        box-shadow: 0 0.125rem 0.125rem rgba(0, 0, 0, 0.3);

        &.warning {
          border: solid 0.3vh rgb(194, 0, 0);
          border: solid calc((0.3 * (100vh - var(--vh-offset, 0px)) / 100))
            rgb(194, 0, 0);
        }

        &#date {
          margin: 0;
          margin-top: 0;
        }
      }

      .date-inner-container {
        margin: 0.5vh;
        margin: calc((0.5 * (100vh - var(--vh-offset, 0px)) / 100));
        margin-top: 1.5vh;
        margin-top: calc((1.5 * (100vh - var(--vh-offset, 0px)) / 100));
        padding: 0;
        border: none;
      }
    }
  }

  @media (max-aspect-ratio: 1/1) {
    .panel {
      padding: 0.125rem;
      width: calc(100% - 0.25rem);
      height: calc(15vw - 1rem);

      .input-container {
        padding: 0.1rem;
        font-size: 3vw;
        line-height: 3vw;

        label {
          margin-left: 0.5vw;
        }

        > * {
          margin-top: 1vw;
        }

        > *:first-child {
          margin-top: 0;
        }

        input {
          height: 2vw;
          font-size: 2vw;
          line-height: 2vw;
          padding: 0.5vw;
          margin: 0.5vw;
          margin-top: 1.5vw;
          border: solid 0.2vw rgb(179, 179, 179);
          border-radius: 2vw;

          &.warning {
            border: solid 0.3vw rgb(194, 0, 0);
          }

          &#date {
            margin: 0;
            margin-top: 0;
          }
        }

        .date-inner-container {
          margin: 0.5vw;
          margin-top: 1.5vw;
        }
      }
    }
  }
</style>
