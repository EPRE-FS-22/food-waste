<script setup lang="ts">
  import { BehaviorSubject, ReplaySubject } from 'rxjs';
  import { onUpdated, ref } from 'vue';
  import moment from 'moment';
  import { loading, secret, settings } from '../settings';
  import {
    addPoints,
    DisplayData,
    getPoints,
    subscribePoints,
    zeroData,
  } from '../data';

  const props = defineProps({ allowEdit: { type: Boolean, default: false } });

  const displayData: BehaviorSubject<DisplayData> = subscribePoints();

  let dishAnimations = ref(false);
  let firstNonZero = true;

  let updated = false;
  const updatedSubject = new ReplaySubject<void>();

  const currentActiveColor = ref('');

  const currentActiveColorDelayed = ref('');

  const currentActiveColorAnimation = ref('');

  const colorFocus = (color: string, active: boolean) => {
    if (active) {
      if (currentActiveColor.value !== color) {
        currentActiveColor.value = color;
        setTimeout(() => (currentActiveColorDelayed.value = color), 100);
        setTimeout(() => (currentActiveColorAnimation.value = color), 400);
      }
    } else {
      if (currentActiveColor.value === color) {
        currentActiveColor.value = '';
        setTimeout(() => (currentActiveColorDelayed.value = ''), 100);
        setTimeout(() => (currentActiveColorAnimation.value = ''), 400);
      }
    }
  };

  onUpdated(() => {
    if (!updated) {
      updated = true;
      updatedSubject.next();
    }
  });

  const fullyDisplayData = () => {
    displayActualData.value.forEach((actualData) => {
      actualData.currentPercentage = actualData.relativePercentage;
      actualData.currentColor = actualData.color;
    });
    setTimeout(() => (dishAnimations.value = false), 300);
  };

  const waitDisplayData = () => {
    setTimeout(() => {
      if (firstNonZero) {
        firstNonZero = false;
        displayActualData.value.forEach((actualData) => {
          actualData.currentColor = actualData.color;
        });
      } else {
        dishAnimations.value = true;
      }
    });
    setTimeout(fullyDisplayData, 10);
  };

  const animateDisplayData = () => {
    if (updated) {
      waitDisplayData();
    } else {
      updatedSubject.subscribe(() => waitDisplayData());
    }
  };

  const displayActualData = ref(displayData.value);

  displayData.subscribe((data) => {
    loading.value = false;
    displayActualData.value = data;
    if (data !== zeroData) {
      animateDisplayData();
    }
  });

  const pressedColor = ref('red');

  const errorMessage = ref('');
  const displayErrorMessage = ref(false);

  getPoints();

  let secretCounter = 0;

  const addPointToColor = async (color: string) => {
    try {
      if (!!props.allowEdit) {
        if (
          !settings.value.amount ||
          isNaN(settings.value.amount) ||
          typeof settings.value.amount !== 'number'
        ) {
          if (!displayErrorMessage.value) {
            setTimeout(() => (displayErrorMessage.value = true), 10);
          }
          errorMessage.value = 'Please enter a valid amount.';
        } else if (
          !settings.value.date ||
          isNaN(moment(settings.value.date).toDate().getTime())
        ) {
          if (!displayErrorMessage.value) {
            setTimeout(() => (displayErrorMessage.value = true), 10);
          }
          errorMessage.value = 'Please enter a valid date.';
        } else if (
          !settings.value.reason &&
          (errorMessage.value !==
            'Please enter a reason. Press again to send anyway.' ||
            pressedColor.value !== color)
        ) {
          if (!displayErrorMessage.value) {
            setTimeout(() => (displayErrorMessage.value = true), 10);
          }
          errorMessage.value =
            'Please enter a reason. Press again to send anyway.';
        } else {
          if (displayErrorMessage.value) {
            displayErrorMessage.value = false;
            setTimeout(() => (errorMessage.value = ''), 300);
          }
          await addPoints(
            color,
            settings.value.amount || 0,
            settings.value.date
              ? moment(settings.value.date).toDate()
              : undefined,
            settings.value.owner,
            settings.value.reason
          );
          if (!settings.value.keepAmount) {
            settings.value.amount = 1;
          }
          if (!settings.value.keepDate) {
            const currentDate = moment(new Date()).format('YYYY-MM-DDThh:mm');
            settings.value.date = currentDate;
          }
          if (!settings.value.keepOwner) {
            settings.value.owner = '';
          }
          if (!settings.value.keepReason) {
            settings.value.reason = '';
          }
        }
        pressedColor.value = color;
      } else {
        if (color === 'orange') {
          secretCounter++;
          if (secretCounter >= 10) {
            secret.value = true;
          }
        }
      }
    } catch (e) {
      throw e;
    }
  };
</script>

<template>
  <div v-if="displayActualData" class="content" :class="{ small: !!allowEdit }">
    <div
      v-for="(data, index) in displayActualData"
      :key="data.color"
      class="dish"
      :class="{
        [data.previousColor]: true,
        [data.currentColor + '-force']: true,
        animation: dishAnimations,
        clickable: !!allowEdit,
        ['dish-' + (index + 1)]: true,
      }"
      @click="addPointToColor(data.color)"
      @focusin="colorFocus(data.color, true)"
      @focusout="colorFocus(data.color, false)"
      @mouseover="colorFocus(data.color, true)"
      @mouseout="colorFocus(data.color, false)"
    >
      <div class="points-container">
        <span
          v-if="errorMessage"
          class="warning-message"
          :class="{
            hide: !displayErrorMessage || pressedColor !== data.color,
          }"
        >
          {{ errorMessage }}
        </span>
        <div
          class="points"
          style="height: 0%; transition: height 1s ease-in-out"
          :style="{ height: data.currentPercentage + '%' }"
        ></div>
      </div>
      <div v-if="secret" class="categories-wrapper">
        <div
          class="categories-inner-wrapper"
          :class="{
            show:
              currentActiveColorDelayed === data.color ||
              currentActiveColorAnimation === data.color,
          }"
        >
          <div
            class="categories"
            :class="{ active: currentActiveColorDelayed === data.color }"
          >
            <div
              v-for="category in data.categories"
              :key="category.name"
              class="category"
            >
              <span class="category-name"> {{ category.name }} </span>
              <span class="category-number"> {{ category.amount }} </span>
            </div>
          </div>
        </div>
      </div>
      <div class="name">
        {{ data.colorString }}
        <div class="score">
          <span class="number">
            {{ data.points }}
          </span>
          <span class="badge" :class="[data.badgeClass]">
            {{ data.badgeString }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .content {
    display: grid;
    grid-template-rows: 1fr 1fr;
    grid-template-columns: 1fr 1fr 1fr;
    width: calc(100% - 1rem);
    height: calc(85vh - 1rem);
    padding: 0.5rem;
    margin: 0;
    border: none;

    .categories-wrapper {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      width: 100%;
      height: 0;

      .categories-inner-wrapper {
        position: absolute;
        left: 10%;
        right: 10%;
        bottom: 0.05rem;
        max-height: 6rem;
        overflow-y: visible;
        display: none;
      }
      .categories {
        padding: 0.25rem;
        background-color: rgba(32, 32, 32, 0.95);
        border: 0.025rem solid rgba(0, 0, 0, 0.5);
        border-radius: 1rem;
        box-shadow: 0 1rem 1rem rgba(0, 0, 0, 0.3);
        transition: opacity 0.3s ease-in-out;
        opacity: 0;
        font-size: 1rem;
        line-height: 1rem;
        .category {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          margin: 0.35rem;
        }
      }
    }

    &.small {
      height: calc(70vh - 1rem);
    }
  }

  .dish {
    position: relative;
    background-color: rgb(238, 238, 238);
    height: auto;
    width: auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin: 0.5rem;
    border: 0.025rem solid rgba(0, 0, 0, 0.5);
    border-radius: 1rem;
    box-shadow: 0 1rem 1rem rgba(0, 0, 0, 0.3);
    transition: transform 0.2s ease-in-out;
    overflow: visible;

    &.dish-1,
    &.dish-2,
    &.dish-3 {
      .categories-wrapper .categories-inner-wrapper {
        max-height: 5.5rem;
      }
    }

    &.animation {
      transition: transform 0.2s ease-in-out, background-color 0.2s ease-in-out;
    }

    &.red-force {
      background-color: #ab0200;
    }

    &.blue-force {
      background-color: #166cc2;
    }

    &.purple-force {
      background-color: #420082;
    }

    &.grey-force {
      background-color: #808184;
    }

    &.orange-force {
      background-color: #ff6228;
    }

    &.yellow-force {
      background-color: #f6aa00;
    }

    &.clickable {
      cursor: pointer;
    }

    .categories-wrapper .categories-inner-wrapper.show {
      display: block;
    }

    &:hover,
    &:active,
    &:focus {
      color: #e6e6e6;
      transform: scale(1.03);

      .categories-wrapper .categories-inner-wrapper {
        display: block;

        .categories.active {
          opacity: 1;
        }
      }
    }
  }

  @media (max-aspect-ratio: 1/1) {
    .content {
      height: calc(100vh - 15vw - 1rem);

      &.small {
        height: calc(100vh - 28vw - 1rem);
      }
    }
  }

  @media (min-aspect-ratio: 7/2) {
    .content {
      grid-template-rows: 1fr;
      grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
      grid-template-areas: 'a b c d e f';

      .dish {
        .categories-wrapper .categories-inner-wrapper {
          max-height: 2.25rem;
        }
      }
    }
  }

  @media (max-aspect-ratio: 1/1) {
    .content {
      grid-template-rows: 1fr 1fr 1fr;
      grid-template-columns: 1fr 1fr;
      grid-template-areas: 'a b' 'c d' 'e f';

      .dish {
        .categories-wrapper .categories-inner-wrapper {
          max-height: 6rem;
        }

        &.dish-1,
        &.dish-2 {
          .categories-wrapper .categories-inner-wrapper {
            max-height: 4rem;
          }
        }
      }
    }
  }

  @media (max-aspect-ratio: 4/9) {
    .content {
      grid-template-rows: 1fr 1fr 1fr 1fr 1fr 1fr;
      grid-template-columns: 1fr;
      grid-template-areas: 'a' 'b' 'c' 'd' 'e' 'f';

      .dish {
        .categories-wrapper .categories-inner-wrapper {
          max-height: 6rem;
        }
        &:first-child {
          .categories-wrapper .categories-inner-wrapper {
            max-height: 2.5rem;
          }
        }
      }
    }
  }

  .red {
    background-color: #ab0200;
  }

  .blue {
    background-color: #166cc2;
  }

  .purple {
    background-color: #420082;
  }

  .grey {
    background-color: #808184;
  }

  .orange {
    background-color: #ff6228;
  }

  .yellow {
    background-color: #f6aa00;
  }

  .points-container {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0;
    margin: 0;
    height: 100%;
    border: none;
    border-radius: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    overflow: hidden;

    .warning-message {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      margin: 0;
      width: calc(100% - 2rem);
      text-align: center;
      height: calc(100% - 2rem);
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 1rem;
      background-color: rgba(184, 0, 0, 0.7);
      border-radius: 1rem;
      z-index: 50;
      opacity: 1;
      transition: opacity 0.3s ease-in-out;

      &.hide {
        opacity: 0;
      }
    }

    .points {
      background-color: #d3d3d3;
      opacity: 0.35;
      padding: 0;
      margin: 0;
      border: none;
    }
  }

  .name,
  .score {
    text-align: center;
    padding: 0;
    margin: 0;
    border: none;
  }

  .name {
    margin-left: 5%;
    margin-right: 5%;
    font-weight: normal;
    font-size: 2rem;
  }

  .score {
    margin-top: 0.25rem;
    font-weight: bold;
    font-size: 1.5rem;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
  }

  .badge {
    background-color: #606060;
    padding: 0.25rem;
    font-size: 0.7rem;
    line-height: 1rem;
    border-radius: 0.6rem;
    margin: 0.1rem;
    margin-left: 0.35rem;
    border: none;
    box-shadow: 0 0.125rem 0.125rem rgba(0, 0, 0, 0.3);
  }

  .badge.first {
    background-color: #ffd700;
    color: #0f0f0f;
  }

  .badge.second {
    background-color: #c0c0c0;
    color: #0f0f0f;
  }

  .badge.third {
    background-color: #cd7f32;
    color: #0f0f0f;
  }

  .badge.last {
    background-color: #871010;
  }
</style>
