import type { AppRouter } from '../../backend/src/router';
import { createWSClient, wsLink } from '@trpc/client/links/wsLink';
import { createTRPCClient } from '@trpc/client';
import type { Dish, DishInfo, UserInfoPrivate } from '../../backend/src/model';
import { ReplaySubject, Subject } from 'rxjs';
import type { DisplayDish } from './model';
//import { searchWikiJs } from '../../backend/src/dishes';

const protocol = import.meta.env.VITE_FOOD_WASTE_PROTOCOL ?? 'ws';
const host = import.meta.env.VITE_FOOD_WASTE_BACKEND_HOST ?? 'localhost';
const port = import.meta.env.VITE_FOOD_WASTE_BACKEND_PORT ?? '3330';

const wsClient = createWSClient({
  url: protocol + '://' + host + ':' + port + '/',
});

const client = createTRPCClient<AppRouter>({
  links: [
    wsLink({
      client: wsClient,
    }),
  ],
});

let loggingOut = false;
let sessionExpires =
  parseInt(localStorage.getItem('sessionExpires') ?? '') ?? 0;
let sessionId = localStorage.getItem('session') ?? '';
let isAdmin = localStorage.getItem('admin') === 'true';
let sessionUserId = localStorage.getItem('sessionUserId') ?? '';
let identityConfirmed = !!localStorage.getItem('identityConfirmed') ?? false;
let infosSet = !!localStorage.getItem('infosSet') ?? false;
let preferencesSet = !!localStorage.getItem('preferencesSet') ?? false;

let setCode = '';
let setExpired = 0;

let userInfo: UserInfoPrivate | null = null;

export const isLoggingOut = () => {
  return loggingOut;
};

export const hasSession = (admin = false) => {
  return !!sessionId && sessionExpires > Date.now() && (!admin || isAdmin);
};

export const hasConfirmedUserSessionWithPreferences = () => {
  return hasConfirmedUserSession() && preferencesSet;
};

export const hasConfirmedUserSession = () => {
  return hasUserSession() && infosSet && identityConfirmed;
};

export const hasUserSession = () => {
  return hasSession() && !isAdmin;
};

export const hasSetCode = () => {
  return !!setCode && setExpired > Date.now();
};

export const checkHasSetCode = async () => {
  (async () => {
    try {
      if (!hasSetCode()) {
        await logOut();
        authFailure.next();
      }
    } catch (e: unknown) {
      console.error(e);
      throw e;
    }
  })();
};

export const clearSetCode = () => {
  setCode = '';
  setExpired = 0;
};

export const authFailure = new Subject<void>();

export const inLogin = new Subject<boolean>();

let dishesPreviousIndex = 0;
let dishesIndex = 0;
let dishesDate = new Date();
let dishes: Dish[] = [];

export const getAvailableDishes = async (
  locationCity?: string,
  dateStart?: Date,
  dateEnd?: Date,
  locationRangeSize?: number,
  ageRangeSize?: number,
  next = false
) => {
  try {
    if (!next) {
      if (dishes && dishesDate.getTime() > Date.now() - 1000 * 60 * 1) {
        return dishes;
      }
      dishesIndex = dishesPreviousIndex;
    }
    const data = await client.query('getAvailableDishes', {
      locationCity,
      dateStart: dateStart ? dateStart.getTime() : undefined,
      dateEnd: dateEnd ? dateEnd.getTime() : undefined,
      start: dishesIndex,
      locationRangeSize,
      ageRangeSize,
    });
    if (data) {
      dishesPreviousIndex = dishesIndex;
      dishesIndex += data.length;
      dishesDate = new Date();
      dishes = data;
      return data;
    } else {
      authFailure.next();
      return false;
    }
  } catch (e) {
    console.error(e);
    throw e;
  }
};

let recommendedDishesPrevious: Dish[] = [];
let recommendedDishesDate = new Date();
let recommendedDishes: Dish[] = [];

export const getRecommendedDishes = async (
  locationCity?: string,
  dateStart?: Date,
  dateEnd?: Date,
  locationRangeSize?: number,
  ageRangeSize?: number,
  next = false
) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    if (!next) {
      if (
        recommendedDishes &&
        recommendedDishesDate.getTime() > Date.now() - 1000 * 60 * 5
      ) {
        return recommendedDishes;
      }
    }
    const data = await client.query('getRecommendedDishes', {
      sessionId,
      userId: sessionUserId,
      previousIds: recommendedDishesPrevious.map((dish) => dish.customId),
      locationCity,
      dateStart: dateStart ? dateStart.getTime() : undefined,
      dateEnd: dateEnd ? dateEnd.getTime() : undefined,
      locationRangeSize,
      ageRangeSize,
    });
    if (data) {
      recommendedDishesPrevious = recommendedDishes;
      recommendedDishesDate = new Date();
      recommendedDishes = data;
      return data;
    } else {
      authFailure.next();
      return false;
    }
  } catch (e) {
    console.error(e);
    throw e;
  }
};

let myDishesDate = new Date();
let myDishes: DishInfo[] = [];

export const getMyDishes = async () => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    if (myDishes && myDishesDate.getTime() > Date.now() - 1000 * 60 * 1) {
      return myDishes;
    }
    const data = await client.query('getMyDishes', {
      sessionId,
      userId: sessionUserId,
    });
    if (data) {
      myDishesDate = new Date();
      myDishes = data;
      return data;
    } else {
      authFailure.next();
      return false;
    }
  } catch (e) {
    console.error(e);
    throw e;
  }
};

let signedUpDishesDate = new Date();
let signedUpDishes: Dish[] = [];

export const getSignedUpDishes = async () => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    if (
      signedUpDishes &&
      signedUpDishesDate.getTime() > Date.now() - 1000 * 60 * 1
    ) {
      return signedUpDishes;
    }
    const data = await client.query('getSignedUpDishes', {
      sessionId,
      userId: sessionUserId,
    });
    if (data) {
      signedUpDishesDate = new Date();
      signedUpDishes = data;
      return data;
    } else {
      authFailure.next();
      return false;
    }
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const getDishPreferences = async () => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    const data = await client.query('getDishPreferences', {
      sessionId,
      userId: sessionUserId,
    });
    if (data) {
      return data;
    } else {
      authFailure.next();
      return false;
    }
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const addDish = async (
  dish: string,
  slots: number,
  date: Date,
  dishDescription?: string
) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    const result = await client.mutation('addDish', {
      dish,
      slots,
      dishDescription,
      sessionId: sessionId,
      userId: sessionUserId,
      date: date.getTime(),
    });
    if (!result) {
      authFailure.next();
      return false;
    }
    return result;
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

export const removeDish = async (dishId: string) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    const result = await client.mutation('removeDish', {
      dishId,
      sessionId: sessionId,
      userId: sessionUserId,
    });
    if (!result) {
      authFailure.next();
      return false;
    }
    return result;
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

export const addDishPreference = async (dish: string, likes: boolean) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    const result = await client.mutation('addDishPreference', {
      dish,
      likes,
      sessionId: sessionId,
      userId: sessionUserId,
    });
    if (!result) {
      authFailure.next();
      return false;
    } else {
      preferencesSet = true;
    }
    return result;
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

export const removeDishPreference = async (dish: string) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    const result = await client.mutation('removeDishPreference', {
      dish,
      sessionId: sessionId,
      userId: sessionUserId,
    });
    if (!result) {
      authFailure.next();
      return false;
    }
    return result;
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

export const addDishRequest = async (dishId: string, message?: string) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    const result = await client.mutation('addDishEvent', {
      dishId,
      message,
      sessionId: sessionId,
      userId: sessionUserId,
    });
    if (!result) {
      authFailure.next();
      return false;
    }
    return result;
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

export const removeDishRequest = async (eventId: string) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    const result = await client.mutation('removeDishEvent', {
      eventId,
      sessionId: sessionId,
      userId: sessionUserId,
    });
    if (!result) {
      authFailure.next();
      return false;
    }
    return result;
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

export const acceptDishRequest = async (eventId: string, response?: string) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    const result = await client.mutation('acceptDishEvent', {
      eventId,
      response,
      sessionId: sessionId,
      userId: sessionUserId,
    });
    if (!result) {
      authFailure.next();
      return false;
    }
    return result;
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

export const unacceptDishRequest = async (eventId: string) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    const result = await client.mutation('unacceptDishEvent', {
      eventId,
      sessionId: sessionId,
      userId: sessionUserId,
    });
    if (!result) {
      authFailure.next();
      return false;
    }
    return result;
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

export const checkSession = (admin = false) => {
  (async () => {
    try {
      if (!hasSession(admin)) {
        authFailure.next();
        return;
      }
      const data = await client.mutation('checkSession', {
        sessionId,
        userId: sessionUserId,
        admin: admin || isAdmin || undefined,
      });
      if (!data) {
        sessionId = '';
        sessionUserId = '';
        isAdmin = false;
        sessionExpires = 0;
        identityConfirmed = false;
        infosSet = false;
        preferencesSet = false;
        localStorage.setItem('session', '');
        localStorage.setItem('sessionUserId', '');
        localStorage.setItem('sessionExpires', '');
        localStorage.setItem('admin', '');
        localStorage.setItem('identityConfirmed', '');
        localStorage.setItem('infosSet', '');
        localStorage.setItem('preferencesSet', '');
        authFailure.next();
      }
    } catch (e: unknown) {
      console.error(e);
      throw e;
    }
  })();
};

export const register = async (email: string, captchaToken?: string) => {
  try {
    const result = await client.mutation('register', { email, captchaToken });
    return {
      success: result.success,
      showCaptcha: result.showCaptcha,
      nextTry: new Date(result.nextTry),
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const emailLogIn = async (email: string, captchaToken?: string) => {
  try {
    const result = await client.mutation('emailLogin', { email, captchaToken });
    return {
      success: result.success,
      showCaptcha: result.showCaptcha,
      nextTry: new Date(result.nextTry),
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const logIn = async (
  password: string,
  email?: string,
  captchaToken?: string
) => {
  try {
    const result = await client.mutation('login', {
      password,
      email,
      captchaToken,
    });
    console.log(result);
    if (result.success && result.sessionId) {
      sessionId = result.sessionId;
      isAdmin = !!result.admin;
      sessionUserId = result.userId ?? '';
      sessionExpires = Date.now() + 1000 * 60 * 60 * 23.5;
      identityConfirmed = !!result.identityConfirmed;
      infosSet = !!result.infosSet;
      preferencesSet = !!result.preferencesSet;
    }

    if (sessionId) {
      localStorage.setItem('sessionUserId', sessionUserId);
      localStorage.setItem('session', sessionId);
      localStorage.setItem('sessionExpires', sessionExpires.toString());
      localStorage.setItem('admin', isAdmin ? 'true' : '');
      localStorage.setItem(
        'identityConfirmed',
        identityConfirmed ? 'true' : ''
      );
      localStorage.setItem('infosSet', infosSet ? 'true' : '');
      localStorage.setItem('preferencesSet', preferencesSet ? 'true' : '');
    }
    return {
      success: result.success,
      admin: result.admin,
      identityConfirmed: result.identityConfirmed,
      infosSet: result.infosSet,
      preferencesSet: result.preferencesSet,
      showCaptcha: result.showCaptcha,
      nextTry: new Date(result.nextTry),
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const verify = async (userId: string, code: string) => {
  try {
    const result = await client.mutation('verify', {
      userId,
      code,
    });
    if (result.success && result.sessionId) {
      sessionId = result.sessionId;
      isAdmin = !!result.admin;
      sessionExpires = Date.now() + 1000 * 60 * 60 * 23.5;
      sessionUserId = userId ?? '';
      identityConfirmed = !!result.identityConfirmed;
      infosSet = !!result.infosSet;
      preferencesSet = !!result.preferencesSet;
      if (!identityConfirmed || !infosSet) {
        setCode = result.code ?? '';
        setExpired = Date.now() + 1000 * 60 * 25 ?? 0;
      }
    }

    if (sessionId) {
      localStorage.setItem('sessionUserId', sessionUserId);
      localStorage.setItem('session', sessionId);
      localStorage.setItem('sessionExpires', sessionExpires.toString());
      localStorage.setItem('admin', isAdmin ? 'true' : '');
      localStorage.setItem(
        'identityConfirmed',
        identityConfirmed ? 'true' : ''
      );
      localStorage.setItem('infosSet', infosSet ? 'true' : '');
      localStorage.setItem('preferencesSet', preferencesSet ? 'true' : '');
    }
    return {
      success: result.success,
      admin: result.admin,
      identityConfirmed: result.identityConfirmed,
      infosSet: result.infosSet,
      preferencesSet: result.preferencesSet,
      code: result.code,
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const set = async (
  newPassword: string,
  name: string,
  age: number,
  locationCity: string,
  exactLocation: string,
  idBase64: string
) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    if (!hasSetCode()) {
      await logOut();
      authFailure.next();
      return false;
    }

    const result = await client.mutation('setUserInfo', {
      userId: sessionUserId,
      password: newPassword,
      name,
      age,
      locationCity,
      exactLocation,
      code: setCode,
      sessionId,
      idBase64,
    });

    if (result) {
      userInfo = result;
      identityConfirmed = !!userInfo.identityConfirmed;
      infosSet = !!userInfo.infosSet;
      preferencesSet = !!userInfo.preferencesSet;
      localStorage.setItem(
        'identityConfirmed',
        identityConfirmed ? 'true' : ''
      );
      localStorage.setItem('infosSet', infosSet ? 'true' : '');
      localStorage.setItem('preferencesSet', preferencesSet ? 'true' : '');
      clearSetCode();
    }
    return result;
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const reset = async (
  newPassword?: string,
  locationCity?: string,
  exactLocation?: string
) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    if (!hasSetCode()) {
      await logOut();
      authFailure.next();
      return false;
    }

    const result = await client.mutation('resetUserInfo', {
      userId: sessionUserId,
      password: newPassword || undefined,
      locationCity: locationCity || undefined,
      exactLocation: exactLocation || undefined,
      code: setCode,
      sessionId,
    });

    if (result) {
      userInfo = result;
      identityConfirmed = !!userInfo.identityConfirmed;
      infosSet = !!userInfo.infosSet;
      preferencesSet = !!userInfo.preferencesSet;
      localStorage.setItem(
        'identityConfirmed',
        identityConfirmed ? 'true' : ''
      );
      localStorage.setItem('infosSet', infosSet ? 'true' : '');
      localStorage.setItem('preferencesSet', preferencesSet ? 'true' : '');
      clearSetCode();
    }
    return result;
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const change = async (
  password: string,
  newPassword?: string,
  locationCity?: string,
  exactLocation?: string
) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }

    const result = await client.mutation('changeUserInfo', {
      userId: sessionUserId,
      password,
      newPassword: newPassword || undefined,
      locationCity: locationCity || undefined,
      exactLocation: exactLocation || undefined,
      sessionId,
    });

    if (result) {
      userInfo = result;
      identityConfirmed = !!userInfo.identityConfirmed;
      infosSet = !!userInfo.infosSet;
      preferencesSet = !!userInfo.preferencesSet;
      localStorage.setItem(
        'identityConfirmed',
        identityConfirmed ? 'true' : ''
      );
      localStorage.setItem('infosSet', infosSet ? 'true' : '');
      localStorage.setItem('preferencesSet', preferencesSet ? 'true' : '');
    }
    return result;
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const getUserInfo = async () => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }

    if (userInfo) {
      return userInfo;
    }

    const result = await client.query('getUserInfo', {
      userId: sessionUserId,
      sessionId,
    });

    if (result) {
      userInfo = result;
      identityConfirmed = !!userInfo.identityConfirmed;
      infosSet = !!userInfo.infosSet;
      preferencesSet = !!userInfo.preferencesSet;
      localStorage.setItem(
        'identityConfirmed',
        identityConfirmed ? 'true' : ''
      );
      localStorage.setItem('infosSet', infosSet ? 'true' : '');
      localStorage.setItem('preferencesSet', preferencesSet ? 'true' : '');
      if (identityConfirmed && infosSet) {
        clearSetCode();
      }
    }
    return result;
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const logOut = async () => {
  try {
    loggingOut = true;
    await client.mutation('logout', { sessionId, userId: sessionUserId });
    sessionId = '';
    sessionUserId = '';
    isAdmin = false;
    sessionExpires = 0;
    identityConfirmed = false;
    infosSet = false;
    preferencesSet = false;
    localStorage.setItem('sessionUserId', '');
    localStorage.setItem('session', '');
    localStorage.setItem('sessionExpires', '');
    localStorage.setItem('admin', '');
    localStorage.setItem('identityConfirmed', '');
    localStorage.setItem('infosSet', '');
    localStorage.setItem('preferencesSet', '');
    loggingOut = false;
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const searchWikiJs = async (searchText: string) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    const result = await client.mutation('searchWikiJs', {
      searchText,
      sessionId,
      userId: sessionUserId,
    });
    return result;
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

export const lastDish: ReplaySubject<DisplayDish> = new ReplaySubject();
