import type { AppRouter } from '../../backend/src/router';
import { createTRPCClient } from '@trpc/client';
import type {
  Dish,
  DishEvent,
  DishInfo,
  UserInfoPrivate,
} from '../../backend/src/model';
import { BehaviorSubject, Subject } from 'rxjs';
import type { CurrentDish } from './model';
import superjson from 'superjson';

const protocol = import.meta.env.VITE_FOOD_WASTE_PROTOCOL ?? 'http';
const host = import.meta.env.VITE_FOOD_WASTE_BACKEND_HOST ?? 'localhost';
const port = import.meta.env.VITE_FOOD_WASTE_BACKEND_PORT ?? '3330';

const client = createTRPCClient<AppRouter>({
  url: protocol + '://' + host + ':' + port + '/',
  transformer: superjson,
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
  if (!hasSetCode()) {
    await logOut();
    authFailure.next();
    return false;
  }
  return true;
};

export const clearSetCode = () => {
  setCode = '';
  setExpired = 0;
};

export const authFailure = new Subject<void>();

authFailure.subscribe(() => {
  clearAll();
});

const clearAll = () => {
  clearSetCode();
  clearCaches();
  clearUserInfo();
  clearPictures();
  clearWikiSearches();
  clearLastDish();
};

const clearUserInfo = () => {
  userInfo = null;
};

const clearPictures = () => {
  pictures = {};
};

const clearWikiSearches = () => {
  wikiSearches = {};
};

const clearLastDish = () => {
  lastDish.next(null);
};

export const clearCaches = (
  normal = true,
  recommended = true,
  my = true,
  signedUp = true
) => {
  if (normal) {
    dishesPreviousIndex = 0;
    dishesIndex = 0;
    dishesDate = new Date();
    dishes = [];
  }

  if (recommended) {
    recommendedDishesPrevious = [];
    recommendedDishesDate = new Date();
    recommendedDishes = [];
  }

  if (my) {
    myDishesPreviousIndex = 0;
    myDishesIndex = 0;
    myDishesDate = new Date();
    myDishes = [];
  }

  if (signedUp) {
    signedUpDishesPreviousIndex = 0;
    signedUpDishesIndex = 0;
    signedUpDishesDate = new Date();
    signedUpDishes = [];
  }
};

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
      if (dishes.length && dishesDate.getTime() > Date.now() - 1000 * 60 * 1) {
        return dishes;
      }
      dishesIndex = dishesPreviousIndex;
    }
    const data = await client.query('getAvailableDishes', {
      locationCity,
      dateStart,
      dateEnd,
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

export const getAvailableDish = async (dishId: string) => {
  try {
    if (!hasConfirmedUserSessionWithPreferences()) {
      authFailure.next();
      return false;
    }
    if (dishes.length && dishesDate.getTime() > Date.now() - 1000 * 60 * 1) {
      const dish = dishes.find((item) => item.customId === dishId);
      if (dish) {
        return dish;
      }
    }
    const data = await client.query('getAvailableDish', {
      sessionId,
      userId: sessionUserId,
      dishId,
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
        recommendedDishes.length &&
        recommendedDishesDate.getTime() > Date.now() - 1000 * 60 * 5
      ) {
        return recommendedDishes;
      }
      recommendedDishes = recommendedDishesPrevious;
    }
    const data = await client.query('getRecommendedDishes', {
      sessionId,
      userId: sessionUserId,
      previousIds: recommendedDishes.map((dish) => dish.customId),
      locationCity,
      dateStart,
      dateEnd,
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

let myDishesPreviousIndex = 0;
let myDishesIndex = 0;
let myDishesDate = new Date();
let myDishes: DishInfo[] = [];

export const getMyDishes = async (next = false) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    if (!next) {
      if (
        myDishes.length &&
        myDishesDate.getTime() > Date.now() - 1000 * 60 * 1
      ) {
        return myDishes;
      }
      myDishesIndex = myDishesPreviousIndex;
    }
    const data = await client.query('getMyDishes', {
      sessionId,
      userId: sessionUserId,
      start: myDishesIndex,
    });
    if (data) {
      myDishesPreviousIndex = myDishesIndex;
      myDishesIndex += data.length;
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

export const getMyDish = async (dishId: string) => {
  try {
    if (!hasConfirmedUserSessionWithPreferences()) {
      authFailure.next();
      return false;
    }
    if (
      myDishes.length &&
      myDishesDate.getTime() > Date.now() - 1000 * 60 * 1
    ) {
      const dish = myDishes.find((item) => item.customId === dishId);
      if (dish) {
        return dish;
      }
    }
    const data = await client.query('getMyDish', {
      sessionId,
      userId: sessionUserId,
      dishId,
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

let signedUpDishesPreviousIndex = 0;
let signedUpDishesIndex = 0;
let signedUpDishesDate = new Date();
let signedUpDishes: DishEvent[] = [];

export const getSignedUpDishes = async (next = false) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    if (!next) {
      if (
        signedUpDishes.length &&
        signedUpDishesDate.getTime() > Date.now() - 1000 * 60 * 1
      ) {
        return signedUpDishes;
      }
      signedUpDishesIndex = signedUpDishesPreviousIndex;
    }
    const data = await client.query('getSignedUpDishes', {
      sessionId,
      userId: sessionUserId,
      start: signedUpDishesIndex,
    });
    if (data) {
      signedUpDishesPreviousIndex = signedUpDishesIndex;
      signedUpDishesIndex += data.length;
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

export const getSignedUpDish = async (dishEventId: string) => {
  try {
    if (!hasConfirmedUserSessionWithPreferences()) {
      authFailure.next();
      return false;
    }
    if (
      signedUpDishes.length &&
      signedUpDishesDate.getTime() > Date.now() - 1000 * 60 * 1
    ) {
      const dish = signedUpDishes.find((item) => item.customId === dishEventId);
      if (dish) {
        return dish;
      }
    }
    const data = await client.query('getSignedUpDish', {
      sessionId,
      userId: sessionUserId,
      dishEventId,
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
  locationCity?: string,
  exactLocation?: string,
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
      dishDescription: dishDescription || undefined,
      sessionId: sessionId,
      userId: sessionUserId,
      date,
      locationCity: locationCity || undefined,
      exactLocation: exactLocation || undefined,
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

export const removeDish = async (dishId: string, admin = false) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    const result = await client.mutation('removeDish', {
      dishId,
      sessionId: sessionId,
      userId: sessionUserId,
      admin,
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
      if (userInfo) {
        userInfo.preferencesSet = true;
      }
      preferencesSet = true;
      localStorage.setItem('preferencesSet', preferencesSet ? 'true' : '');
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

export const checkSessionAsync = async (admin = false) => {
  if (!hasSession(admin)) {
    authFailure.next();
    return false;
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
    return false;
  }
  return true;
};

export const checkSession = (admin = false) => {
  (async () => {
    try {
      await checkSessionAsync(admin);
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
      setCode = result.code ?? '';
      setExpired = Date.now() + 1000 * 60 * 25 ?? 0;
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
  dateOfBirth: Date,
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
      dateOfBirth,
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
    clearAll();
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

export const populate = async (
  preferencesPerUser = 3,
  dishesPerUser = 5,
  dishEventsPerUser = 3
) => {
  try {
    if (!hasSession(true)) {
      authFailure.next();
      return false;
    }
    const result = await client.mutation('populate', {
      sessionId: sessionId,
      userId: sessionUserId,
      preferencesPerUser,
      dishesPerUser,
      dishEventsPerUser,
    });
    return result;
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

export const depopulate = async () => {
  try {
    if (!hasSession(true)) {
      authFailure.next();
      return false;
    }
    const result = await client.mutation('depopulate', {
      sessionId: sessionId,
      userId: sessionUserId,
    });
    return result;
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

let wikiSearches: Record<string, string[]> = {};
export const searchWiki = async (
  searchText: string,
  limit = 5,
  onlyCoords = false,
  lengthLimit = 50
) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }

    const queryQuery =
      searchText + ';' + limit + ';' + onlyCoords + ';' + lengthLimit;

    const wikiSearch = wikiSearches[queryQuery];

    if (wikiSearch) {
      return wikiSearch;
    }
    const result = await client.query('searchWiki', {
      searchText,
      sessionId,
      userId: sessionUserId,
      limit,
      onlyCoords,
      lengthLimit,
    });
    if (result) {
      wikiSearches[queryQuery] = result;
      return result;
    }
    return false;
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

let pictures: Record<string, string> = {};

export const getPicture = async (searchText: string) => {
  try {
    if (pictures[searchText]) {
      return pictures[searchText];
    }
    const result = await client.query('getPicture', {
      searchText,
    });
    if (result) {
      pictures[searchText] = result;
      return result;
    }
    return false;
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

export const getPictures = async (searchTexts: string[]) => {
  try {
    if (!searchTexts.length || searchTexts.length > 50) {
      return false;
    }

    const rest = searchTexts.filter((searchText) => !pictures[searchText]);

    if (!rest.length) {
      return searchTexts.map((searchText) => pictures[searchText]);
    }

    const result = await client.query('getPictures', {
      searchTexts: [rest[0], ...rest.slice(1)],
    });
    if (result) {
      return searchTexts.map((searchText) => {
        if (pictures[searchText]) {
          return pictures[searchText] ?? '';
        } else {
          return result[rest.indexOf(searchText)] ?? '';
        }
      });
    }
    return false;
  } catch (e: unknown) {
    console.error(e);
    throw e;
  }
};

export const lastDish: BehaviorSubject<CurrentDish | null> =
  new BehaviorSubject(null as CurrentDish | null);

export const refreshDishes: Subject<void> = new Subject();

let timeoutId = 0;

export const setRefreshTimeout = () => {
  if (timeoutId) {
    window.clearTimeout(timeoutId);
  }
  timeoutId = window.setTimeout(() => {
    timeoutId = 0;
    clearCaches(false, true, false, false);
    refreshDishes.next();
  }, 1000 * 75);
};
