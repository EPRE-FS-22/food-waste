<script setup lang="ts">
  import { ref, onBeforeUnmount, watch, onUnmounted } from 'vue';
  import {
    DisplayType,
    loading,
    resetSettingsMessages,
    settings,
    settingsMessages,
  } from '../settings';
  import {
    clearCaches,
    getAvailableDishes,
    getMyDishes,
    getRecommendedDishes,
    getSignedUpDishes,
    getUserInfo,
    goBackMyDishes,
    goBackSignedUpDishes,
    hasSession,
    hasUserSession,
    lastDish,
    refreshDishes,
  } from '../data';
  import type { DishEvent, DishInfo } from '../../../backend/src/model';
  import { NormalCurrentDish, PlanDish } from '../model';
  import { useRouter } from 'vue-router';
  import moment from 'moment';

  const router = useRouter();

  const props = defineProps({
    small: { type: Boolean, default: false },
    type: { type: Number, default: DisplayType.available },
  });

  let dishes = ref([] as NormalCurrentDish[] | PlanDish[]);

  const clickDish = (index: number) => {
    const item = dishes.value[index];
    lastDish.next(item);
    if (props.type === DisplayType.plans) {
      if (item.type === 'info') {
        router.push('/host/' + item.dish.customId);
      } else {
        router.push('/plan/' + item.dish.customId);
      }
    } else {
      router.push('/detail/' + item.dish.customId);
    }
  };

  let timeoutId = 0;
  let requestOngoing = false;

  let ignoreNextChange = false;

  const notOnFirstPage = ref(false);

  watch(settings, () => {
    if (ignoreNextChange) {
      ignoreNextChange = false;
    } else if (
      props.type === DisplayType.recommended ||
      (props.type === DisplayType.available && hasSession(true))
    ) {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (requestOngoing) {
        return;
      }
      timeoutId = window.setTimeout(() => {
        timeoutId = 0;
        getDishes(false, true);
      }, 1000);
    }
  });

  onUnmounted(() => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  });

  const getDishes = (next = false, reset = false) => {
    (async () => {
      try {
        let success = false;
        let locationCityChecked: undefined | string = undefined;
        let dateStartChecked: undefined | Date = undefined;
        let dateEndChecked: undefined | Date = undefined;
        let locationRangeSizeChecked: undefined | number = undefined;
        let ageRangeSizeChecked: undefined | number = undefined;

        resetSettingsMessages();

        if (
          props.type === DisplayType.recommended ||
          (props.type === DisplayType.available && hasSession(true))
        ) {
          let fail = false;
          if (!settings.previousLocationCity) {
            if (hasUserSession()) {
              const userInfo = await getUserInfo();
              if (userInfo && userInfo.locationCity) {
                settings.locationCity = userInfo.locationCity;
                settings.previousLocationCity = userInfo.locationCity;
                ignoreNextChange = true;
              }
            }
          }
          if (settings.locationCity) {
            if (settings.locationCity !== settings.previousLocationCity) {
              locationCityChecked = settings.locationCity;
            } else {
            }
          } else if (hasUserSession()) {
            settingsMessages.locationCity = 'Please enter a valid city.';
            fail = true;
          }
          if (!settings.dateStart) {
            settings.dateStart = moment(
              new Date(Date.now() + 1000 * 60 * 60 * 3)
            ).format('YYYY-MM-DDTHH:MM');
            ignoreNextChange = true;
          }
          const startDate = moment(settings.dateStart).toDate();
          if (startDate && !Number.isNaN(startDate.getTime())) {
            if (startDate.getTime() > Date.now() + 1000 * 60) {
              dateStartChecked = startDate;
            } else {
              settingsMessages.dateStart =
                'Please enter a date later than now.';
              fail = true;
            }
          } else {
            settingsMessages.dateStart = 'Please enter a valid date.';
            fail = true;
          }
          if (!settings.dateEnd) {
            settings.dateEnd = moment(
              new Date(Date.now() + 1000 * 60 * 60 * 36)
            ).format('YYYY-MM-DDTHH:MM');
            ignoreNextChange = true;
          }
          const endDate = moment(settings.dateEnd).toDate();
          if (endDate && !Number.isNaN(endDate.getTime())) {
            if (
              (!startDate && endDate.getTime() > Date.now() + 1000 * 60) ||
              (startDate && endDate.getTime() > startDate.getTime())
            ) {
              dateEndChecked = endDate;
            } else {
              settingsMessages.dateEnd =
                'Please enter a date later than the start date and later than now';
              fail = true;
            }
          } else {
            settingsMessages.dateEnd = 'Please enter a valid date.';
            fail = true;
          }
          if (settings.locationRangeSize > 0) {
            if (settings.locationRangeSize <= 200) {
              locationRangeSizeChecked = settings.locationRangeSize;
            } else {
              settingsMessages.locationRangeSize =
                'The range cannot be bigger than 200';
              fail = true;
            }
          } else {
            settingsMessages.locationRangeSize =
              'The range must be larger than 0';
            fail = true;
          }
          if (settings.ageRangeSize > 0) {
            if (settings.ageRangeSize <= 200) {
              ageRangeSizeChecked = settings.ageRangeSize;
            } else {
              settingsMessages.ageRangeSize =
                'The range cannot be bigger than 200';
              fail = true;
            }
          } else {
            settingsMessages.ageRangeSize = 'The range must be larger than 0';
            fail = true;
          }
          if (fail) {
            return;
          }
        }
        requestOngoing = true;
        switch (props.type) {
          case DisplayType.available:
            if (reset) {
              clearCaches(true, false, false, false);
            }
            const availableResult = hasSession(true)
              ? await getAvailableDishes(
                  locationCityChecked,
                  dateStartChecked,
                  dateEndChecked,
                  locationRangeSizeChecked,
                  ageRangeSizeChecked,
                  next
                )
              : await getAvailableDishes(
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  next
                );
            if (availableResult) {
              success = true;
              dishes.value = availableResult.map((item) => ({
                type: 'normal',
                dish: item,
              }));
            }
            break;

          case DisplayType.recommended:
            if (reset) {
              clearCaches(true, true, false, false);
            }
            const recommendedResult = await getRecommendedDishes(
              locationCityChecked,
              dateStartChecked,
              dateEndChecked,
              locationRangeSizeChecked,
              ageRangeSizeChecked,
              next
            );
            if (recommendedResult) {
              success = true;
              dishes.value = recommendedResult.map((item) => ({
                type: 'normal',
                dish: item,
              }));
            }
            break;

          case DisplayType.plans:
            if (reset) {
              clearCaches(false, false, true, true);
            }
            const myAndSignedUpResult = (await Promise.all([
              getMyDishes(next),
              getSignedUpDishes(next),
            ])) as [false | DishInfo[], false | DishEvent[]];
            if (myAndSignedUpResult[0] && myAndSignedUpResult[1]) {
              success = true;
              const plans = (
                [
                  ...myAndSignedUpResult[0].map((item) => ({
                    type: 'info',
                    dish: item,
                  })),
                  ...myAndSignedUpResult[1].map((item) => ({
                    type: 'event',
                    dish: item,
                  })),
                ] as PlanDish[]
              ).sort((a, b) => {
                return b.dish.date.getTime() - a.dish.date.getTime();
              });

              if (plans.length > 6) {
                let myTooMany = 0;
                let signedUpTooMany = 0;
                plans.slice(6).forEach((item) => {
                  if (item.type === 'info') {
                    myTooMany++;
                  } else {
                    signedUpTooMany++;
                  }
                });

                if (myTooMany) {
                  goBackMyDishes(myTooMany);
                }

                if (signedUpTooMany) {
                  goBackSignedUpDishes(signedUpTooMany);
                }
              }

              dishes.value = plans.slice(0, 6);
            }
            break;
        }
        requestOngoing = false;
        if (success) {
          if (next) {
            if (!reset) {
              notOnFirstPage.value = true;
            }
            resetInterval();
          }

          if (reset) {
            notOnFirstPage.value = false;
          }

          if (loading.value) {
            loading.value = false;
          }
        }
      } catch (e) {
        console.error(e);
        throw e;
      }
    })();
  };

  getDishes();

  watch(
    () => props.type,
    (newType, prevType) => {
      if (newType !== prevType) {
        getDishes();
      }
    }
  );

  let intervalCounter = 0;
  let intervalId = 0;

  const resetInterval = () => {
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalCounter = 0;
    }
    intervalId = window.setInterval(() => {
      if (props.type !== DisplayType.recommended) {
        getDishes();
      } else if (intervalCounter % 5 === 0) {
        getDishes();
      }
      intervalCounter++;
    }, 1000 * 60 * 2);

    refreshDishes.subscribe(() => {
      getDishes();
    });
  };

  resetInterval();

  refreshDishes.subscribe(() => {
    getDishes();
  });

  onBeforeUnmount(() => {
    loading.value = true;
    if (intervalId) {
      window.clearInterval(intervalId);
    }
  });
</script>

<template>
  <div
    v-if="!dishes.length"
    class="content-base no-content"
    :class="{ small: !!small }"
  >
    Nothing to see here
    <button class="paging-button reset-button" @click="getDishes(false, true)">
      <span class="icon button-icon icon-cw"></span>
    </button>
  </div>
  <div v-else class="content-base content-wrapper" :class="{ small: !!small }">
    <div class="content">
      <div
        v-for="(data, index) in dishes"
        :key="data.dish.customId"
        class="dish"
        :class="{
          ['dish-' + (index + 1)]: true,
        }"
        :style="{
          backgroundImage: data.dish.image
            ? 'url(' + data.dish.image + ')'
            : '',
        }"
        @click="clickDish(index)"
      >
        <div class="name">
          {{ data.dish.dish }}
        </div>
        <div class="dish-date">
          {{ moment(data.dish.date).format('DD. MM. YYYY HH:MM') }}
        </div>
        <div class="dish-city">
          {{ data.dish.locationCity }}
        </div>
        <div
          v-if="data.type === 'info'"
          class="icon corner-icon icon-home"
        ></div>
        <div
          v-if="data.type === 'event' && !data.dish.accepted"
          class="icon corner-icon icon-question-circle-o"
        ></div>
        <div
          v-if="data.type === 'event' && data.dish.accepted"
          class="icon corner-icon icon-ok-circled2"
        ></div>
      </div>
    </div>
    <button class="paging-button reset-button" @click="getDishes(false, true)">
      <span class="icon button-icon icon-cw"></span>
    </button>
    <button
      v-if="dishes.length >= 6"
      class="paging-button next-button"
      @click="getDishes(true)"
    >
      <span class="icon button-icon icon-right-open"></span>
    </button>
  </div>
</template>

<style scoped lang="scss">
  .no-content {
    position: relative;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    font-size: 2rem;
  }

  .button-icon {
    color: #000000;
    margin: 0;
    padding: 0;
    border: none;
    font-size: 1.25rem;
  }

  .paging-button {
    position: absolute;
    bottom: 2rem;
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
    cursor: pointer;
    z-index: 200;

    &.reset-button {
      left: 2rem;
    }

    &.next-button {
      right: 2rem;

      .button-icon {
        font-size: 1rem;
        margin-left: 0.25rem;
        margin-right: 0.05rem;
      }
    }
  }

  .content-wrapper {
    position: relative;
  }

  .content {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: 1fr 1fr;
    grid-template-columns: 1fr 1fr 1fr;
  }

  .dish {
    position: relative;
    background-color: rgb(171, 171, 171);
    height: auto;
    width: auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin: 0.5rem;
    border: none;
    border-radius: 1rem;
    box-shadow: 0 1rem 1rem rgba(0, 0, 0, 0.3);
    transition: transform 0.2s ease-in-out;
    overflow: visible;
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center;

    &:hover,
    &:active,
    &:focus {
      color: #e6e6e6;
      transform: scale(1.03);
    }

    &::before {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      background-color: rgb(42, 42, 42);
      opacity: 0.3;
      border-radius: 1rem;
      content: '';
    }

    .corner-icon {
      position: absolute;
      bottom: 0.5rem;
      left: 0.5rem;
      font-size: 1.25rem;
    }
  }

  @media (min-aspect-ratio: 7/2) {
    .content {
      grid-template-rows: 1fr;
      grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
      grid-template-areas: 'a b c d e f';
    }
  }

  @media (max-aspect-ratio: 1/1) {
    .content {
      grid-template-rows: 1fr 1fr 1fr;
      grid-template-columns: 1fr 1fr;
      grid-template-areas: 'a b' 'c d' 'e f';
    }
  }

  @media (max-aspect-ratio: 4/9) {
    .content {
      grid-template-rows: 1fr 1fr 1fr 1fr 1fr 1fr;
      grid-template-columns: 1fr;
      grid-template-areas: 'a' 'b' 'c' 'd' 'e' 'f';
    }
  }

  .name,
  .dish-date,
  .dish-city {
    text-align: center;
    padding: 0;
    margin: 0;
    border: none;
    z-index: 1;
    margin-left: 5%;
    margin-right: 5%;
    font-weight: normal;
    font-size: 2rem;
  }

  .dish-date,
  .dish-city {
    font-size: 1.25rem;
  }
</style>
