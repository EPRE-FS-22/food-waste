import * as trpc from '@trpc/server';
import { z } from 'zod';
import superjson from 'superjson';
import { TRAIN_INTERVAL } from './constants.js';
import { makeId } from './id.js';
import {
  createLoginLink,
  loginUser,
  registerOrEmailLogin,
  verifyUserEmail,
  verifyAdminPassword,
  getUserInfo,
  setUserInfo,
  changeUserInfo,
  resetUserInfo,
} from './users.js';
import { Context } from './context.js';
import {
  acceptDishEvent,
  addDish,
  addDishEvent,
  addDishPreference,
  getAvailableDish,
  getAvailableDishes,
  getDishPreferences,
  getMyDish,
  getMyDishes,
  getRecommendedDishes,
  getSignedUpDish,
  getSignedUpDishes,
  removeDish,
  removeDishEvent,
  removeDishPreference,
  train,
  unacceptDishEvent,
} from './dishes.js';
import { searchWiki } from './wiki.js';
import {
  deletePopulatedData,
  disableAutoPopulate,
  enableAutoPopulate,
  getAutoPopulate,
  populateWithData,
  startAutoPopulate,
} from './populate.js';
import { getPicture, getPictures } from './pictures.js';

let adminSessions: {
  [key: string]: { expirationDate: Date; ip: string; adminId: string };
} = {};

const sessions: {
  [key: string]: {
    expirationDate: Date;
    userId: string;
    ip?: string;
    identityConfirmed?: boolean;
    infosSet?: boolean;
    preferencesSet?: boolean;
  };
} = {};

const addSession = (
  ip: string,
  userId: string,
  stay = false,
  isAdmin = false,
  identityConfirmed = false,
  infosSet = false,
  preferencesSet = false
) => {
  let sessionId = '';
  if (!userId) {
    return '';
  }
  if (isAdmin) {
    do {
      sessionId = makeId(20);
    } while (adminSessions[sessionId]);
    adminSessions[sessionId] = {
      expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      ip,
      adminId: userId,
    };
  } else {
    do {
      sessionId = makeId(20);
    } while (sessions[sessionId]);
    sessions[sessionId] = {
      expirationDate: new Date(
        Date.now() + 1000 * 60 * 60 * 24 * (stay ? 90 : 1)
      ),
      ip: stay ? undefined : ip,
      userId,
      identityConfirmed,
      infosSet,
      preferencesSet,
    };
  }
  Object.keys(sessions).forEach((id) => {
    if (sessions[id].expirationDate.getTime() < Date.now()) {
      delete sessions[id];
    }
  });
  Object.keys(adminSessions).forEach((id) => {
    if (adminSessions[id].expirationDate.getTime() < Date.now()) {
      delete adminSessions[id];
    }
  });
  return sessionId;
};

const verifySession = (
  sessionId: string,
  ip: string,
  userId: string,
  admin = false
) => {
  if (!userId) {
    return false;
  }
  if (admin) {
    const session = adminSessions[sessionId];
    return (
      session &&
      session.ip === ip &&
      session.expirationDate.getTime() > Date.now() &&
      session.adminId === userId
    );
  } else {
    const session = sessions[sessionId];
    return (
      session &&
      (!session.ip || session.ip === ip) &&
      session.expirationDate.getTime() > Date.now() &&
      session.userId === userId
    );
  }
};

const getSessionData = (sessionId: string) => {
  const session = sessions[sessionId];
  if (session) {
    return {
      identityConfirmed: session.identityConfirmed,
      infosSet: session.infosSet,
      preferencesSet: session.preferencesSet,
    };
  }
  return null;
};

const getConfirmedSession = (sessionId: string, ip: string, userId: string) => {
  if (verifySession(sessionId, ip, userId)) {
    const sessionData = getSessionData(sessionId);
    if (sessionData && sessionData.identityConfirmed && sessionData.infosSet) {
      return sessionData;
    }
  }
  return null;
};

const isConfirmedSessionWithPreferences = (
  sessionId: string,
  ip: string,
  userId: string
) => {
  if (verifySession(sessionId, ip, userId)) {
    const sessionData = getSessionData(sessionId);
    if (
      sessionData &&
      sessionData.identityConfirmed &&
      sessionData.infosSet &&
      sessionData.preferencesSet
    ) {
      return true;
    }
  }
  return false;
};

const updateSessionData = (
  sessionId: string,
  identityConfirmed = false,
  infosSet = false,
  preferencesSet = false
) => {
  if (sessions[sessionId]) {
    sessions[sessionId].identityConfirmed = identityConfirmed;
    sessions[sessionId].infosSet = infosSet;
    sessions[sessionId].preferencesSet = preferencesSet;
  }
};

const deleteSessions = (
  sessionId: string,
  ip: string,
  userId: string,
  all = false,
  admin = false
) => {
  if (!userId) {
    return false;
  }
  if (verifySession(sessionId, ip, userId, admin)) {
    if (admin) {
      if (all) {
        adminSessions = {};
      } else {
        delete adminSessions[sessionId];
      }
      return true;
    } else {
      if (all) {
        Object.keys(sessions).forEach((id) => {
          const session = sessions[id];
          if (session.userId === userId) {
            delete sessions[id];
          }
        });
      } else {
        delete sessions[sessionId];
      }
    }
  }
  return false;
};

const getIp = (ctx: Context): string => {
  if (!ctx) {
    throw new Error('Could not get context to get IP');
  }
  const ip = ctx.req.socket.remoteAddress;
  if (!ip) {
    throw new Error('Could not get IP');
  }
  return ip;
};

const internalServerError = (e: unknown) => {
  console.error(e);
  process.exitCode = 1;
  return new Error('Internal server error');
};

export const appRouter = trpc
  .router()
  .transformer(superjson)
  .query('getAvailableDishes', {
    input: z.object({
      userId: z.string().nonempty().length(20).optional(),
      sessionId: z.string().length(20).optional(),
      start: z.number().nonnegative().optional(),
      locationCity: z.string().nonempty().max(100).optional(),
      dateStart: z.date().optional(),
      dateEnd: z.date().optional(),
      locationRangeSize: z.number().nonnegative().max(200).optional(),
      ageRangeSize: z.number().nonnegative().max(200).optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        if (input.userId && input.sessionId) {
          const ip = getIp(ctx as Context);
          if (verifySession(input.sessionId, ip, input.userId)) {
            return await getAvailableDishes(
              input.userId,
              input.start,
              undefined,
              input.locationCity,
              input.dateStart,
              input.dateEnd,
              input.locationRangeSize,
              input.ageRangeSize
            );
          }
          return false;
        } else {
          return await getAvailableDishes(
            undefined,
            input.start,
            undefined,
            input.locationCity,
            input.dateStart,
            input.dateEnd,
            input.locationRangeSize,
            input.ageRangeSize
          );
        }
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .query('getRecommendedDishes', {
    input: z.object({
      userId: z.string().nonempty().length(20),
      sessionId: z.string().length(20),
      previousIds: z.array(z.string().nonempty().length(20)).optional(),
      locationCity: z.string().nonempty().max(100).optional(),
      dateStart: z.date().optional(),
      dateEnd: z.date().optional(),
      locationRangeSize: z.number().nonnegative().max(200).optional(),
      ageRangeSize: z.number().nonnegative().max(200).optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (
          isConfirmedSessionWithPreferences(input.sessionId, ip, input.userId)
        ) {
          return await getRecommendedDishes(
            input.userId,
            input.previousIds,
            undefined,
            input.locationCity,
            input.dateStart,
            input.dateEnd,
            input.locationRangeSize,
            input.ageRangeSize
          );
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .query('getMyDishes', {
    input: z.object({
      userId: z.string().nonempty().length(20),
      sessionId: z.string().length(20),
      start: z.number().nonnegative().optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (
          isConfirmedSessionWithPreferences(input.sessionId, ip, input.userId)
        ) {
          return await getMyDishes(input.userId, 6, input.start);
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .query('getSignedUpDishes', {
    input: z.object({
      userId: z.string().nonempty().length(20),
      sessionId: z.string().length(20),
      start: z.number().nonnegative().optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (
          isConfirmedSessionWithPreferences(input.sessionId, ip, input.userId)
        ) {
          return await getSignedUpDishes(input.userId, 6, input.start);
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .query('getAvailableDish', {
    input: z.object({
      userId: z.string().nonempty().length(20),
      sessionId: z.string().length(20),
      dishId: z.string().length(20),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (
          isConfirmedSessionWithPreferences(input.sessionId, ip, input.userId)
        ) {
          return await getAvailableDish(input.dishId, input.userId);
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .query('getMyDish', {
    input: z.object({
      userId: z.string().nonempty().length(20),
      sessionId: z.string().length(20),
      dishId: z.string().length(20),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (
          isConfirmedSessionWithPreferences(input.sessionId, ip, input.userId)
        ) {
          return await getMyDish(input.dishId, input.userId);
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .query('getSignedUpDish', {
    input: z.object({
      userId: z.string().nonempty().length(20),
      sessionId: z.string().length(20),
      dishEventId: z.string().length(20),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (
          isConfirmedSessionWithPreferences(input.sessionId, ip, input.userId)
        ) {
          return await getSignedUpDish(input.dishEventId, input.userId);
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .query('getUserInfo', {
    input: z.object({
      userId: z.string().nonempty().length(20),
      sessionId: z.string().length(20),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.userId)) {
          const info = await getUserInfo(input.userId);
          if (info) {
            updateSessionData(
              input.sessionId,
              info.identityConfirmed,
              info.infosSet,
              info.preferencesSet
            );
            return info;
          }
        }
        return null;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .query('getDishPreferences', {
    input: z.object({
      userId: z.string().nonempty().length(20),
      sessionId: z.string().length(20),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        const sessionData = getConfirmedSession(
          input.sessionId,
          ip,
          input.userId
        );
        if (sessionData) {
          const dishPreferences = await getDishPreferences(input.userId);
          if (!sessionData.preferencesSet && dishPreferences.length > 0) {
            updateSessionData(input.sessionId, true, true, true);
          }
          return dishPreferences;
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .query('getLoginLink', {
    input: z.object({
      userId: z.string().nonempty().length(20),
      sessionId: z.string().length(20),
      stay: z.boolean().optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (getConfirmedSession(input.sessionId, ip, input.userId)) {
          return await createLoginLink(input.userId, input.stay);
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .query('searchWiki', {
    input: z.object({
      searchText: z.string().nonempty().max(100),
      sessionId: z.string().length(20),
      userId: z.string().length(20),
      limit: z.number().nonnegative().min(1).max(50).default(15),
      lengthLimit: z.number().nonnegative().min(1).max(100).default(50),
      onlyCoords: z.boolean().optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.userId)) {
          return await searchWiki(
            input.searchText,
            input.limit,
            !!input.onlyCoords
          );
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .query('getPicture', {
    input: z.object({
      searchText: z.string().nonempty().max(50),
    }),
    async resolve({ input }) {
      try {
        const result = await getPicture(input.searchText);
        if (result) {
          return result;
        }
        return '';
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .query('getPictures', {
    input: z.object({
      searchTexts: z.array(z.string().nonempty().max(50)).nonempty().max(6),
    }),
    async resolve({ input }) {
      try {
        const result = await getPictures(input.searchTexts);
        if (result.length) {
          return result;
        }
        return [];
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .query('getAutoPopulate', {
    input: z.object({
      sessionId: z.string().length(20),
      userId: z.string().length(20),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.userId, true)) {
          return await getAutoPopulate();
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('register', {
    input: z.object({
      email: z.string().email().nonempty().max(200),
      captchaToken: z.string().nonempty().max(10000).optional(),
      stay: z.boolean().optional(),
    }),
    async resolve({
      input,
      ctx,
    }): Promise<{ success: boolean; showCaptcha: boolean; nextTry: Date }> {
      try {
        const ip = getIp(ctx as Context);
        const result = await registerOrEmailLogin(
          input.email,
          ip,
          input.captchaToken,
          input.stay
        );
        return {
          success: result.success,
          showCaptcha: result.showCaptcha,
          nextTry: result.nextTry,
        };
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('emailLogin', {
    input: z.object({
      email: z.string().email().nonempty().max(200),
      captchaToken: z.string().nonempty().max(10000).optional(),
      stay: z.boolean().optional(),
    }),
    async resolve({ input, ctx }): Promise<{
      success: boolean;
      showCaptcha: boolean;
      nextTry: Date;
      admin?: boolean;
    }> {
      try {
        const ip = getIp(ctx as Context);
        return await registerOrEmailLogin(
          input.email,
          ip,
          input.captchaToken,
          input.stay,
          false
        );
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('verify', {
    input: z.object({
      userId: z.string().nonempty().length(20),
      code: z.string().nonempty().length(15),
    }),
    async resolve({ input, ctx }): Promise<{
      success: boolean;
      userId?: string;
      sessionId?: string;
      admin?: boolean;
      code?: string;
      infosSet?: boolean;
      identityConfirmed?: boolean;
      preferencesSet?: boolean;
    }> {
      try {
        const result = await verifyUserEmail(input.userId, input.code);
        if (result.success) {
          const ip = getIp(ctx as Context);
          const sessionId = addSession(
            ip,
            input.userId,
            result.stay,
            result.admin,
            result.identityConfirmed,
            result.infosSet,
            result.preferencesSet
          );
          return {
            success: result.success,
            userId: input.userId,
            sessionId,
            admin: result.admin,
            code: result.resetCode,
            infosSet: result.infosSet,
            identityConfirmed: result.identityConfirmed,
            preferencesSet: result.preferencesSet,
          };
        }
        return { success: false };
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('setUserInfo', {
    input: z.object({
      userId: z.string().nonempty().length(20),
      code: z.string().nonempty().length(15),
      sessionId: z.string().length(20),
      password: z.string().nonempty().max(20),
      name: z.string().nonempty().max(200),
      dateOfBirth: z.date(),
      locationCity: z.string().nonempty().max(100),
      exactLocation: z.string().nonempty().max(1000),
      idBase64: z.string().nonempty().max(10000000),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.userId)) {
          const result = await setUserInfo(
            input.userId,
            input.code,
            input.password,
            input.name,
            input.dateOfBirth,
            input.locationCity,
            input.exactLocation,
            input.idBase64
          );
          if (result) {
            updateSessionData(input.sessionId, true, true);
            return await getUserInfo(input.userId);
          }
        }
        return null;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('resetUserInfo', {
    input: z.object({
      userId: z.string().nonempty().length(20),
      code: z.string().nonempty().length(15),
      sessionId: z.string().length(20),
      password: z.string().nonempty().max(20).optional(),
      locationCity: z.string().nonempty().max(100).optional(),
      exactLocation: z.string().nonempty().max(1000).optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (getConfirmedSession(input.sessionId, ip, input.userId)) {
          const result = await resetUserInfo(
            input.userId,
            input.code,
            input.password,
            input.locationCity,
            input.exactLocation
          );

          if (result) {
            const userInfo = await getUserInfo(input.userId);
            updateSessionData(
              input.sessionId,
              true,
              true,
              userInfo ? userInfo.preferencesSet : false
            );
            return userInfo;
          }
        }
        return null;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('changeUserInfo', {
    input: z.object({
      userId: z.string().nonempty().length(20),
      sessionId: z.string().length(20),
      password: z.string().nonempty().max(20),
      newPassword: z.string().nonempty().max(20).optional(),
      locationCity: z.string().nonempty().max(100).optional(),
      exactLocation: z.string().nonempty().max(1000).optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (getConfirmedSession(input.sessionId, ip, input.userId)) {
          const result = await changeUserInfo(
            input.userId,
            input.password,
            input.newPassword,
            input.locationCity,
            input.exactLocation
          );

          if (result) {
            const userInfo = await getUserInfo(input.userId);
            updateSessionData(
              input.sessionId,
              true,
              true,
              userInfo ? userInfo.preferencesSet : false
            );
            return userInfo;
          }
        }
        return null;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('login', {
    input: z.object({
      email: z.string().email().nonempty().max(200).optional(),
      password: z.string().nonempty().max(20),
      captchaToken: z.string().nonempty().max(10000).optional(),
      stay: z.boolean().optional(),
    }),
    async resolve({ input, ctx }): Promise<{
      success: boolean;
      sessionId?: string;
      showCaptcha: boolean;
      nextTry: Date;
      admin?: boolean;
      userId?: string;
      infosSet?: boolean;
      identityConfirmed?: boolean;
      preferencesSet?: boolean;
    }> {
      try {
        const ip = getIp(ctx as Context);
        const result = input.email
          ? await loginUser(input.email, input.password, ip, input.captchaToken)
          : await verifyAdminPassword(input.password, ip, input.captchaToken);
        if (result.success && result.userId) {
          if (result.admin) {
            const sessionId = addSession(ip, result.userId, input.stay, true);
            return {
              success: true,
              sessionId,
              showCaptcha: result.showCaptcha,
              nextTry: result.nextTry,
              admin: true,
              userId: result.userId,
              identityConfirmed: result.identityConfirmed,
              infosSet: result.infosSet,
              preferencesSet: result.preferencesSet,
            };
          } else {
            const sessionId = addSession(
              ip,
              result.userId,
              input.stay,
              false,
              result.identityConfirmed,
              result.infosSet,
              result.preferencesSet
            );
            return {
              success: true,
              sessionId,
              showCaptcha: result.showCaptcha,
              nextTry: result.nextTry,
              userId: result.userId,
              identityConfirmed: result.identityConfirmed,
              infosSet: result.infosSet,
              preferencesSet: result.preferencesSet,
            };
          }
        }
        return {
          success: false,
          showCaptcha: result.showCaptcha,
          nextTry: result.nextTry,
        };
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('addDish', {
    input: z.object({
      dish: z.string().nonempty().max(50),
      sessionId: z.string().length(20),
      userId: z.string().length(20),
      slots: z.number().min(1).max(10).int(),
      date: z.date(),
      locationCity: z.string().nonempty().max(100).optional(),
      exactLocation: z.string().nonempty().max(1000).optional(),
      dishDescription: z.string().nonempty().max(1000).optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (getConfirmedSession(input.sessionId, ip, input.userId)) {
          const dishId = await addDish(
            input.dish,
            input.userId,
            input.slots,
            input.date,
            input.locationCity,
            input.exactLocation,
            input.dishDescription
          );
          return dishId;
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('removeDish', {
    input: z.object({
      dishId: z.string().length(20),
      sessionId: z.string().length(20),
      userId: z.string().length(20),
      admin: z.boolean().optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (input.admin) {
          if (verifySession(input.sessionId, ip, input.userId, true)) {
            return await removeDish(input.dishId);
          }
        } else {
          if (getConfirmedSession(input.sessionId, ip, input.userId)) {
            return await removeDish(input.dishId, input.userId);
          }
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('addDishPreference', {
    input: z.object({
      dish: z.string().nonempty().max(50),
      sessionId: z.string().length(20),
      userId: z.string().length(20),
      likes: z.boolean(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        const sessionData = getConfirmedSession(
          input.sessionId,
          ip,
          input.userId
        );
        if (sessionData) {
          if (
            await addDishPreference(
              input.dish,
              input.userId,
              input.likes,
              !sessionData.preferencesSet
            )
          ) {
            if (!sessionData.preferencesSet) {
              updateSessionData(input.sessionId, true, true, true);
            }
            return await getDishPreferences(input.userId);
          }
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('removeDishPreference', {
    input: z.object({
      dish: z.string().nonempty().max(50),
      sessionId: z.string().length(20),
      userId: z.string().length(20),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (getConfirmedSession(input.sessionId, ip, input.userId)) {
          if (await removeDishPreference(input.dish, input.userId)) {
            return await getDishPreferences(input.userId);
          }
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('addDishEvent', {
    input: z.object({
      dishId: z.string().nonempty().length(20),
      sessionId: z.string().length(20),
      userId: z.string().length(20),
      message: z.string().nonempty().max(200).optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (getConfirmedSession(input.sessionId, ip, input.userId)) {
          return await addDishEvent(input.dishId, input.userId, input.message);
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('removeDishEvent', {
    input: z.object({
      eventId: z.string().length(20),
      sessionId: z.string().length(20),
      userId: z.string().length(20),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (getConfirmedSession(input.sessionId, ip, input.userId)) {
          return await removeDishEvent(input.eventId, input.userId);
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('acceptDishEvent', {
    input: z.object({
      eventId: z.string().nonempty().length(20),
      sessionId: z.string().length(20),
      userId: z.string().length(20),
      response: z.string().nonempty().max(200).optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (getConfirmedSession(input.sessionId, ip, input.userId)) {
          return await acceptDishEvent(
            input.eventId,
            input.userId,
            input.response
          );
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('unacceptDishEvent', {
    input: z.object({
      eventId: z.string().nonempty().length(20),
      sessionId: z.string().length(20),
      userId: z.string().length(20),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (getConfirmedSession(input.sessionId, ip, input.userId)) {
          return await unacceptDishEvent(input.eventId, input.userId);
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('checkSession', {
    input: z.object({
      sessionId: z.string().length(20),
      userId: z.string().nonempty().length(20),
      admin: z.boolean().optional(),
    }),
    resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        return verifySession(input.sessionId, ip, input.userId, input.admin);
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('logout', {
    input: z.object({
      sessionId: z.string().length(20),
      userId: z.string().nonempty().length(20),
      all: z.boolean().optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        return deleteSessions(input.sessionId, ip, input.userId, input.all);
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('populate', {
    input: z.object({
      usersNumber: z.number().nonnegative().min(1).max(100).default(20),
      preferencesPerUser: z.number().nonnegative().min(1).max(10).default(3),
      dishesPerUser: z.number().nonnegative().min(1).max(10).default(5),
      dishEventsPerUser: z.number().nonnegative().min(1).max(10).default(3),
      sessionId: z.string().length(20),
      userId: z.string().length(20),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.userId, true)) {
          return await populateWithData(
            input.usersNumber,
            input.preferencesPerUser,
            input.dishesPerUser,
            input.dishEventsPerUser
          );
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('depopulate', {
    input: z.object({
      sessionId: z.string().length(20),
      userId: z.string().length(20),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.userId, true)) {
          return await deletePopulatedData();
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('setAutoPopulate', {
    input: z.object({
      state: z.boolean(),
      sessionId: z.string().length(20),
      userId: z.string().length(20),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.userId, true)) {
          return await (input.state
            ? enableAutoPopulate()
            : disableAutoPopulate());
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  });

const trainAsync = () => {
  console.log('retraining recommender');
  (async () => {
    try {
      await train();
    } catch (e: unknown) {
      console.error(e);
      process.exitCode = 1;
    }
  })();
};

setInterval(() => {
  trainAsync();
}, TRAIN_INTERVAL);

trainAsync();

startAutoPopulate();

export type AppRouter = typeof appRouter;
