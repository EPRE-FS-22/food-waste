<script setup lang="ts">
  import { BehaviorSubject } from 'rxjs';
  import { ref } from 'vue';
  import { DisplayData, getPoints, subscribePoints } from '../data';

  const displayData: BehaviorSubject<DisplayData> = subscribePoints();

  const showDishes = ref(true);

  const displayActualData = ref(displayData.value);

  displayData.subscribe((data) => {
    displayActualData.value = data;
  });

  getPoints();
</script>

<template>
  <div class="ranking">
    <div class="ranking-image"></div>
    <div class="ranking-content">
      <input class="subheader" value="SCOREBOARD" />
      <div v-if="displayActualData" class="content">
        <div
          v-for="(data, index) in displayActualData"
          :key="data.dish"
          class="dish"
        >
          <div class="index-container">
            <span class="index"> {{ index + 1 }}. </span>
          </div>
          <span class="name" :class="{ [data.dish]: showDishes }">
            {{ (data.dishString + ' Dish').toUpperCase() }}
          </span>
          <span class="number">
            {{ data.points }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  $vw-scaling-factor: 1.175;

  .ranking {
    position: relative;
    width: calc(100% - 2rem);
    height: calc(85vh - 2rem);
    padding: 1rem;
    margin: 0;
    border: none;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;
    font-family: 'Open Sans', Arial, Helvetica, sans-serif;
  }

  .ranking-image {
    position: absolute;
    top: 1rem;
    left: 1rem;
    padding: 0;
    margin: 0;
    height: calc(100% - 2rem);
    width: 0;
    padding-right: calc(100% - 2rem);
    border: none;
    background-image: url('../assets/polebackground.png');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: 50% 50%;
    object-fit: contain;
  }

  .ranking-content {
    width: calc(76.4vh);
    padding: 2vh;
    margin: 0;
    border: none;
    color: #000000;
    font-size: 4.65vh;
    line-height: 3.875vh;
    z-index: 100;
  }

  .subheader {
    text-align: center;
    font-size: 9.5vh;
    line-height: 10.5vh;
    margin: 0;
    margin-top: 12vh;
    margin-bottom: 4.55vh;
    border: none;
    background: none;
    font-weight: 400;
    width: 100%;
  }

  .dish {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    padding: 1.25vh;
    margin: 0 1.5vh;
    font-weight: bold;
    letter-spacing: 0.4vh;
    transition: transform 0.2s ease-in-out, background-color 0.2s ease-in-out;

    &:hover {
      border-radius: 0.5vh;
      box-shadow: 0 0.5vh 0.5vh rgba(0, 0, 0, 0.3);
      background-color: rgba(223, 223, 223, 0.5);
      transform: scale(1.03);
    }

    .index-container {
      margin: 0;
      padding: 0;
      border: none;
      flex: 1;
    }

    .index {
      margin-left: 2.5vh;
    }

    .name {
      font-weight: 800;
    }

    .number {
      flex: 1;
      text-align: right;
    }
  }

  @media (max-aspect-ratio: 1/1) {
    .ranking {
      height: calc(100% - 15vw - 2rem);
      display: block;
    }
  }

  @media (min-aspect-ratio: 7/8) and (max-aspect-ratio: 1/1) {
    .ranking {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: flex-start;
    }
  }

  @media (max-aspect-ratio: 7/8) {
    .ranking-image {
      height: 0;
      width: calc(100% - 2rem);
      padding-bottom: calc(100% - 2rem);
      padding-right: 0;
    }

    .ranking-content {
      width: 95%;
      padding: 2vw * $vw-scaling-factor;
      position: relative;
      top: 0;
      left: 0;
      right: 0;
      font-size: 4.65vw * $vw-scaling-factor;
      line-height: 3.875vw * $vw-scaling-factor;
    }

    .dish {
      padding: 1.25vw * $vw-scaling-factor;
      margin: 0 1.5vw * $vw-scaling-factor;
      letter-spacing: 0.4vw * $vw-scaling-factor;

      &:hover {
        border-radius: 0.5vw * $vw-scaling-factor;
        box-shadow: 0 0.5vw * $vw-scaling-factor 0.5vw * $vw-scaling-factor
          rgba(0, 0, 0, 0.3);
      }

      .index {
        margin-left: 2.5vw * $vw-scaling-factor;
      }
    }

    .subheader {
      font-size: 9vw * $vw-scaling-factor;
      line-height: 10.5vw * $vw-scaling-factor;
      margin-top: 12vw * $vw-scaling-factor;
      margin-bottom: 4.55vw * $vw-scaling-factor;
    }
  }

  .red {
    color: #ab0200;
  }

  .blue {
    color: #166cc2;
  }

  .purple {
    color: #420082;
  }

  .grey {
    color: #808184;
  }

  .orange {
    color: #ff6228;
  }

  .yellow {
    color: #f6aa00;
  }

  .warning-message {
    opacity: 1;
    transition: opacity 0.3s ease-in-out;

    &.hide {
      opacity: 0;
    }
  }
</style>
