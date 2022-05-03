import type { AppRouter } from '../../backend/src/router';
import { createWSClient, wsLink } from '@trpc/client/links/wsLink';
import { createTRPCClient } from '@trpc/client';
import type { Dish, DishInfo } from '../../backend/src/model';
import { Subject } from 'rxjs';

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

let loggingOut = true;
let sessionExpires =
  parseInt(localStorage.getItem('sessionExpires') ?? '') ?? 0;
let sessionUserId = localStorage.getItem('sessionUserId') ?? '';
let sessionId = localStorage.getItem('session') ?? '';
let isAdmin = localStorage.getItem('admin') === 'true';

export const isLoggingOut = () => {
  return loggingOut;
};

export const hasSession = (admin = false) => {
  return (
    !!sessionId && sessionExpires > new Date().getTime() && (!admin || isAdmin)
  );
};

export const hasUserSession = () => {
  return hasSession() && !isAdmin;
};

export const authFailure = new Subject<void>();

export const inLogin = new Subject<boolean>();

let dishesPreviousIndex = 0;
let dishesIndex = 0;
let dishesDate = new Date();
let dishes: Dish[] = [];

export const getAvailableDishes = async (next = false) => {
  try {
    if (!next) {
      if (dishes && dishesDate.getTime() > Date.now() - 1000 * 60 * 1) {
        return dishes;
      }
      dishesIndex = dishesPreviousIndex;
    }
    const data = await client.query('getAvailableDishes', {});
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

export const getRecommendedDishes = async (next = false) => {
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

export const addDish = async (dish: string, slots: number, date: Date) => {
  try {
    if (!hasSession()) {
      authFailure.next();
      return false;
    }
    const result = await client.mutation('addDish', {
      dish,
      slots,
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
        localStorage.setItem('session', '');
        localStorage.setItem('sessionUserId', '');
        localStorage.setItem('sessionExpires', '');
        localStorage.setItem('admin', '');
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
    if (result.success && result.sessionId) {
      sessionId = result.sessionId;
      isAdmin = !!result.admin;
    } else {
      sessionId = '';
      isAdmin = false;
    }
    sessionExpires = new Date().getTime() + 1000 * 60 * 60 * 23.5;
    if (sessionId) {
      sessionUserId = result.userId ?? '';
      localStorage.setItem('sessionUserId', sessionUserId);
      localStorage.setItem('session', sessionId);
      localStorage.setItem('sessionExpires', sessionExpires.toString());
      localStorage.setItem('admin', isAdmin ? 'true' : '');
    }
    return {
      success: result.success,
      admin: result.admin,
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
    } else {
      sessionId = '';
      isAdmin = false;
    }
    sessionExpires = new Date().getTime() + 1000 * 60 * 60 * 23.5;
    if (sessionId) {
      sessionUserId = userId ?? '';
      localStorage.setItem('sessionUserId', sessionUserId);
      localStorage.setItem('session', sessionId);
      localStorage.setItem('sessionExpires', sessionExpires.toString());
      localStorage.setItem('admin', isAdmin ? 'true' : '');
    }
    return {
      success: result.success,
      admin: result.admin,
      code: result.code,
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const reset = async (
  code: string,
  newPassword?: string,
  name?: string
) => {
  try {
    if (!sessionUserId) {
      return false;
    }
    const result = await client.mutation('reset', {
      userId: sessionUserId,
      password: newPassword || undefined,
      name: name || undefined,
      code,
      sessionId,
    });
    return result;
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const change = async (
  password: string,
  newPassword?: string,
  name?: string
) => {
  try {
    if (!sessionUserId) {
      return false;
    }
    const result = await client.mutation('change', {
      userId: sessionUserId,
      password,
      newPassword: newPassword || undefined,
      name: name || undefined,
      sessionId,
    });
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
    localStorage.setItem('sessionUserId', '');
    localStorage.setItem('session', '');
    localStorage.setItem('sessionExpires', '');
    localStorage.setItem('admin', '');
    loggingOut = false;
  } catch (e) {
    console.error(e);
    throw e;
  }
};
