<script setup lang="ts">
  import { useRouter } from 'vue-router';
  import { APP_NAME } from '../../../backend/src/constants';
  import { logOut } from '../data';
  import {
    loggedIn,
    resetSettings,
    resetSettingsMessages,
    resetState,
    userLoggedIn,
  } from '../settings';

  const router = useRouter();

  let buttonDisabled = false;

  const logOutOnclick = async () => {
    try {
      if (!buttonDisabled) {
        buttonDisabled = true;
        await logOut();
        buttonDisabled = false;
        resetState();
        resetSettings();
        resetSettingsMessages();
        router.push('/');
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const mailToUs = () => {
    location.href = `mailto:info@mll.one?&subject=${APP_NAME} Website`;
  };
</script>

<template>
  <div class="footer">
    <a
      v-if="$router.currentRoute.value.path === '/login'"
      href="https://mll.one/"
      class="subtitle footer-item"
      >Hosted by MllOne</a
    >
    <a v-else href="https://www.pexels.com" class="subtitle footer-item"
      >Photos by Pexels</a
    >
    <router-link
      v-if="$router.currentRoute.value.path === '/'"
      :to="loggedIn ? (userLoggedIn ? '/user' : '/admin') : '/login'"
      class="action-link footer-item"
      >{{
        loggedIn ? (userLoggedIn ? 'User menu' : 'Admin panel') : 'Log in'
      }}</router-link
    >
    <div
      v-else-if="$router.currentRoute.value.path === '/login' && loggedIn"
      to="/"
      class="action-link footer-item"
      @click="logOutOnclick()"
    >
      Log out
    </div>
    <router-link
      v-else-if="$router.currentRoute.value.path !== '/login'"
      to="/login"
      class="action-link footer-item"
      >Account</router-link
    >
    <a class="contact footer-item" @click="mailToUs()">Contact</a>
  </div>
</template>

<style scoped lang="scss">
  .footer {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-end;
    height: 3vh;
    height: calc((3 * (100vh - var(--vh-offset, 0px)) / 100));
  }

  .footer-item {
    padding: 0.5% 1rem;
    font-weight: bold;
    font-size: 2vh;
    font-size: calc((2 * (100vh - var(--vh-offset, 0px)) / 100));
    line-height: 3vh;
    line-height: calc((3 * (100vh - var(--vh-offset, 0px)) / 100));
    color: unset;
    text-decoration: none;
    cursor: pointer;
  }

  .subtitle,
  .contact {
    flex: 1;
    cursor: pointer;
  }

  .subtitle {
    text-align: left;
  }

  .action-link {
    text-align: center;
  }

  .contact {
    text-align: right;
  }

  @media (min-aspect-ratio: 3/1) {
    .footer {
      height: 5vh;
      height: calc((5 * (100vh - var(--vh-offset, 0px)) / 100));
    }

    .footer-item {
      font-size: 3.333vh;
      font-size: calc((3.333 * (100vh - var(--vh-offset, 0px)) / 100));
      line-height: 5vh;
      line-height: calc((5 * (100vh - var(--vh-offset, 0px)) / 100));
    }
  }

  @media (max-aspect-ratio: 1/1) {
    .footer {
      display: flex;
      height: 3vw;
    }

    .footer-item {
      font-size: 2vw;
      line-height: 3vw;
    }
  }

  @media (max-aspect-ratio: 9/16) {
    .footer {
      height: 5vw;
    }

    .footer-item {
      padding: 0.5% 0.5rem;
      font-size: 3.333vw;
      line-height: 5vw;

      &:first-child {
        padding-left: 1rem;
      }

      &:last-child {
        padding-right: 1rem;
      }
    }
  }
</style>
