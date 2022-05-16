<script setup lang="ts">
  import moment from 'moment';
  import { onUnmounted, ref } from 'vue';
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

  let showModal = ref(false);

  const clickModal = () => {
    showModal.value = !showModal.value;
  };

  const eventListener = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      showModal.value = false;
    }
  };

  window.addEventListener('keyup', eventListener);

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

  onUnmounted(() => {
    window.removeEventListener('keyup', eventListener);
  });
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
    <button
      class="showModal-button"
      :class="{
        warning:
          !settings.dateStart ||
          settingsMessages.dateStart ||
          !settings.dateEnd ||
          settingsMessages.dateEnd ||
          !settings.locationCity ||
          settingsMessages.locationCity ||
          !settings.locationRangeSize ||
          settingsMessages.locationRangeSize ||
          !settings.ageRangeSize ||
          settingsMessages.ageRangeSize,
      }"
      @click="clickModal()"
    >
      {{
        (settings.locationCity ? settings.locationCity + ' | ' : '') +
        moment(settings.dateStart).format('DD. MM. YYYY HH:MM') +
        ' - ' +
        moment(settings.dateEnd).format('DD. MM. YYYY HH:MM')
      }}
      <span class="icon icon-pencil"></span>
    </button>
    <Transition name="modal">
      <div v-if="showModal" class="modal-mask">
        <div class="modal-wrapper">
          <div class="modal-container">
            <div class="modal-container-inner">
              <div class="modal-header">
                <slot name="header">Search Settings</slot>
              </div>
              <div class="modal-body">
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
                    :class="
                      'city panel-item' +
                      (!settings.locationCity || settingsMessages.locationCity
                        ? ' warning'
                        : '')
                    "
                    :maxlength="100"
                  ></SearchWiki>
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
                        !settings.locationRangeSize ||
                        settingsMessages.locationRangeSize,
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
                        warning:
                          !settings.dateStart || settingsMessages.dateStart,
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
                      warning:
                        !settings.ageRangeSize || settingsMessages.ageRangeSize,
                    }"
                  />
                </div>
              </div>
              <div class="modal-footer">
                <button class="modal-default-button" @click="clickModal()">
                  <span class="icon button-icon icon-cancel"></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
  .showModal-button {
    margin: 0;
    min-height: 2.1rem;
    height: min-content;
    font-size: 1rem;
    line-height: 1.5rem;
    font-weight: bold;
    padding: 0.15rem;
    padding-left: 0.45rem;
    padding-right: 0.45rem;
    background-color: #ffffff;
    border: solid 0.1rem rgb(179, 179, 179);
    border-radius: 1rem;
    box-shadow: 0 0.125rem 0.125rem rgba(0, 0, 0, 0.3);
    text-decoration: none;
    color: #000000;

    &.warning {
      border: solid 0.3vh rgb(194, 0, 0);
      border: solid calc((0.3 * (100vh - var(--vh-offset, 0px)) / 100))
        rgb(194, 0, 0);
    }
  }
  .modal-mask {
    position: fixed;
    z-index: 9998;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: table;
    transition: opacity 0.3s ease;
  }

  .modal-wrapper {
    display: table-cell;
    vertical-align: middle;
  }

  .modal-container {
    width: 70%;
    height: 90%;
    margin: 0px auto;
    padding: 0;
    background-color: gray;
    border-radius: 1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.33);
    transition: all 0.3s ease;
    overflow-y: auto;
  }

  .modal-container-inner {
    width: auto;
    height: auto;
    padding: 20px 30px;
    overflow-y: auto;
  }

  .modal-header {
    margin-top: 0.5rem;
    font-size: 2rem;
  }

  .modal-body {
    margin: 20px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .modal-default-button {
    float: right;
    height: 2.1rem;
    font-size: 1rem;
    line-height: 1rem;
    font-weight: bold;
    padding: 0;
    background-color: #ffffff;
    border: solid 0.1rem rgb(179, 179, 179);
    border-radius: 1rem;
    box-shadow: 0 0.125rem 0.125rem rgba(0, 0, 0, 0.3);
    text-decoration: none;
    color: #000000;
  }

  .modal-enter-from {
    opacity: 0;
  }

  .modal-leave-to {
    opacity: 0;
  }

  .modal-enter-from .modal-container,
  .modal-leave-to .modal-container {
    -webkit-transform: scale(1.1);
    transform: scale(1.1);
  }
  .panel {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    width: calc(100% - 1rem);
    height: calc(10vh - 1rem);
    height: calc((10 * (100vh - var(--vh-offset, 0px)) / 100) - 1rem);
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

    .icon {
      color: #000000;
      font-size: 0.85rem;
      margin: 0;
      padding: 0;
      border: none;
      margin-right: -0.2rem;

      &.button-icon {
        font-size: 1.125rem;
      }
    }

    .input-container {
      display: flex;
      flex-direction: column;
      width: 90%;
      padding: 0.5rem;
      font-size: 1.25rem;
      line-height: 1.25rem;

      .searchWiki {
        margin: 0;
        padding: 0;
        border: none;
        width: 100%;
      }

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

      :deep(input) {
        height: 1rem;
        font-size: 1rem;
        line-height: 1rem;
        width: 90%;
        padding: 0.5rem;
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

        &.date {
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

  @media (min-aspect-ratio: 3/1) {
    .panel {
      height: calc(15vh - 1rem);
      height: calc((15 * (100vh - var(--vh-offset, 0px)) / 100) - 1rem);
    }
  }

  @media (max-aspect-ratio: 1/1) {
    .panel {
      padding: 0.125rem;
      width: calc(100% - 0.25rem);
      height: calc(12vw - 1rem);

      .input-container {
        padding: 0.6rem;

        label {
          margin-left: 0.5vw;
        }

        > * {
          margin-top: 1vw;
        }

        > *:first-child {
          margin-top: 0;
        }

        :deep(input) {
          margin: 0.5vw;
          margin-top: 1.5vw;
          border: solid 0.2vw rgb(179, 179, 179);
          border-radius: 2vw;

          &.warning {
            border: solid 0.3vw rgb(194, 0, 0);
          }
        }

        .date-inner-container {
          margin: 0.5vw;
          margin-top: 1.5vw;
        }
      }
    }
  }

  @media (max-aspect-ratio: 9/16) {
    .panel {
      height: calc(25vw - 1rem);
    }
  }
</style>
