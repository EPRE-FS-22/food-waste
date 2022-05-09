<script setup lang="ts">
  import {
    loggedIn,
    userLoggedIn,
    userConfirmed,
    userConfirmedWithPreferences,
  } from '../settings';
</script>

<template>
  <div class="header">
    <router-link to="/" class="header-container">
      <img src="../assets/logofullwhite.png" class="logo" />
    </router-link>
    <div class="right-hand-buttons">
      <router-link
        v-if="$router.currentRoute.value.path === '/' && !loggedIn"
        to="/login"
        class="view-toggle"
      >
        Log in / Sign up
      </router-link>
      <router-link
        v-if="$router.currentRoute.value.path === '/' && loggedIn"
        :to="userLoggedIn ? '/user' : '/admin'"
        class="view-toggle"
      >
        {{ userLoggedIn ? 'User menu' : 'Admin panel' }}
      </router-link>
      <router-link
        v-if="
          $router.currentRoute.value.path === '/login' ||
          $router.currentRoute.value.path === '/admin'
        "
        :to="userLoggedIn ? '/user' : '/'"
        class="view-toggle"
      >
        Back
      </router-link>
      <router-link
        v-if="
          ($router.currentRoute.value.path === '/login' ||
            $router.currentRoute.value.path === '/user' ||
            $router.currentRoute.value.path === '/add' ||
            $router.currentRoute.value.path === '/plans' ||
            $router.currentRoute.value.path.startsWith('/detail/')) &&
          userConfirmed
        "
        to="/preferences"
        class="view-toggle"
      >
        Preferences
      </router-link>
      <router-link
        v-if="
          $router.currentRoute.value.path === '/preferences' &&
          !userConfirmedWithPreferences
        "
        to="/login"
        class="view-toggle"
      >
        Account
      </router-link>
      <router-link
        v-if="
          ($router.currentRoute.value.path === '/user' ||
            $router.currentRoute.value.path === '/add' ||
            $router.currentRoute.value.path === '/preferences' ||
            $router.currentRoute.value.path.startsWith('/detail/')) &&
          userConfirmedWithPreferences
        "
        to="/plans"
        class="view-toggle"
      >
        Plans
      </router-link>
      <router-link
        v-if="
          ($router.currentRoute.value.path === '/plans' ||
            $router.currentRoute.value.path === '/add' ||
            $router.currentRoute.value.path === '/preferences' ||
            $router.currentRoute.value.path.startsWith('/detail/')) &&
          userConfirmedWithPreferences
        "
        to="/user"
        class="view-toggle"
      >
        Discover
      </router-link>
      <router-link
        v-if="
          ($router.currentRoute.value.path === '/user' ||
            $router.currentRoute.value.path === '/plans' ||
            $router.currentRoute.value.path === '/preferences') &&
          userConfirmedWithPreferences
        "
        to="/add"
        class="view-toggle"
      >
        Invite
      </router-link>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .header {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
    height: 12vh;
    height: calc((12 * (100vh - var(--vh-offset, 0px)) / 100));
  }

  .header-container {
    width: min-content;
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    color: unset;
    text-decoration: none;
  }

  .right-hand-buttons {
    display: flex;
    flex-direction: row;
  }

  .logo {
    margin-left: 3.5vh;
    margin-left: calc((3.5 * (100vh - var(--vh-offset, 0px)) / 100));
    margin-right: 3.5vh;
    margin-right: calc((3.5 * (100vh - var(--vh-offset, 0px)) / 100));
    height: 10vh;
    height: calc((10 * (100vh - var(--vh-offset, 0px)) / 100));
    cursor: pointer;
  }

  .view-toggle {
    display: block;
    box-sizing: border-box;
    margin-left: auto;
    margin-right: 0.75rem;
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

  @media (min-aspect-ratio: 3/1) {
    .header {
      height: 16vh;
      height: calc((16 * (100vh - var(--vh-offset, 0px)) / 100));
    }

    .logo {
      margin-left: 2.333vh;
      margin-left: calc((2.333 * (100vh - var(--vh-offset, 0px)) / 100));
      margin-right: 2.333vh;
      margin-right: calc((2.333 * (100vh - var(--vh-offset, 0px)) / 100));
      height: 13.333vh;
      height: calc((13.333 * (100vh - var(--vh-offset, 0px)) / 100));
    }
  }

  @media (max-aspect-ratio: 1/1) {
    .header {
      height: 12vw;
    }

    .logo {
      margin-left: 1.75vw;
      margin-right: 1.75vw;
      height: 10vw;
    }

    .view-toggle {
      height: 1.7rem;
      font-size: 0.8rem;
      line-height: 0.8rem;
      padding: 0.35rem;
    }
  }

  @media (max-aspect-ratio: 9/16) {
    .header {
      height: 16vw;
    }

    .logo {
      margin-left: 2.333vw;
      margin-right: 2.333vw;
      height: 13.333vw;
    }
  }
</style>
