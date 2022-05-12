<script setup lang="ts">
  import { ref, onBeforeUnmount, watch } from 'vue';
  import { DisplayType, loading } from '../settings';
  import {
    getAvailableDishes,
    getMyDishes,
    getPictures,
    getRecommendedDishes,
    getSignedUpDishes,
    lastDish,
  } from '../data';
  import type { DishEvent, DishInfo } from '../../../backend/src/model';
  import { PROMO_DISHES } from '../../../backend/src/constants';
  import { DisplayDish, NormalCurrentDish, PlanDish } from '../model';
  import { useRouter } from 'vue-router';

  const router = useRouter();

  const props = defineProps({
    small: { type: Boolean, default: false },
    type: { type: Number, default: DisplayType.available },
  });

  let dishes = ref([] as NormalCurrentDish[] | PlanDish[]);

  const getDishesPictures = async () => {
    if (!dishes.value.length) {
      return;
    }

    let pictureSearchTexts: string[] = [];

    dishes.value.forEach((item) => {
      pictureSearchTexts.push(item.dish.dish);
    });

    const pictures = await getPictures(pictureSearchTexts);

    if (pictures) {
      dishes.value = dishes.value.map((item, index) => ({
        type: item.type,
        dish: {
          ...item.dish,
          image: pictures[index],
        },
      })) as NormalCurrentDish[] | PlanDish[];
    }
  };

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

  const getDishes = () => {
    (async () => {
      try {
        let success = false;
        switch (props.type) {
          case DisplayType.available:
            const availableResult = await getAvailableDishes();
            if (availableResult) {
              success = true;
              dishes.value = (
                availableResult.length
                  ? availableResult
                  : PROMO_DISHES.map(
                      (item) =>
                        ({
                          promo: true,
                          customId: 'abcdefghijklmnopqrst',
                          dish: item,
                          name: 'John Doe',
                          date: new Date(Date.now() + 1000 * 60 * 60 * 6),
                          slots: 2,
                          filled: 1,
                        } as DisplayDish)
                    )
              ).map((item) => ({ type: 'normal', dish: item }));
            }
            break;

          case DisplayType.recommended:
            const recommendedResult = await getRecommendedDishes();
            if (recommendedResult) {
              success = true;
              dishes.value = (
                recommendedResult.length
                  ? recommendedResult
                  : [...PROMO_DISHES].reverse().map(
                      (item) =>
                        ({
                          promo: true,
                          customId: 'abcdefghijklmnopqrst',
                          dish: item,
                          name: 'John Doe',
                          date: new Date(Date.now() + 1000 * 60 * 60 * 6),
                          slots: 2,
                          filled: 1,
                        } as DisplayDish)
                    )
              ).map((item) => ({ type: 'normal', dish: item }));
            }
            break;

          case DisplayType.plans:
            const myAndSignedUpResult = (await Promise.all([
              getMyDishes(),
              getSignedUpDishes(),
            ])) as [false | DishInfo[], false | DishEvent[]];
            if (myAndSignedUpResult[0] && myAndSignedUpResult[1]) {
              success = true;
              dishes.value = (
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
            }
            break;
        }
        if (success) {
          await getDishesPictures();
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

  const interval = setInterval(() => {
    if (props.type !== DisplayType.recommended) {
      getDishes();
    }
  }, 1000 * 60 * 1);

  onBeforeUnmount(() => {
    loading.value = true;
    clearInterval(interval);
  });
</script>

<template>
  <div v-if="!dishes.length" class="content-base no-content">
    Nothing to see here
  </div>
  <div v-else class="content-base content" :class="{ small: !!small }">
    <div
      v-for="(data, index) in dishes"
      :key="data.dish.customId"
      class="dish"
      :class="{
        ['dish-' + (index + 1)]: true,
      }"
      :style="{
        backgroundImage: data.dish.image ? 'url(' + data.dish.image + ')' : '',
      }"
      @click="clickDish(index)"
    >
      <div class="name">
        {{ data.dish.dish }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .no-content {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    font-size: 2rem;
  }
  .content {
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

  .name {
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
</style>
