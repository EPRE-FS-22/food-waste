import * as trpc from '@trpc/server';
import { z } from 'zod';
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
} from './users.js';
import { Context } from './context.js';
import {
  acceptDishEvent,
  addDish,
  addDishEvent,
  addDishPreference,
  getAvailableDishes,
  getDishPreferences,
  getMyDishes,
  getRecommendedDishes,
  getSignedUpDishes,
  removeDish,
  removeDishEvent,
  removeDishPreference,
  train,
  unacceptDishEvent,
} from './dishes.js';

let adminSessions: {
  [key: string]: { expirationDate: Date; ip: string; adminId: string };
} = {};

const sessions: {
  [key: string]: { expirationDate: Date; userId: string; ip?: string };
} = {};

const addSession = (
  ip: string,
  userId: string,
  stay = false,
  isAdmin = false
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
      expirationDate: new Date(new Date().getTime() + 1000 * 60 * 60 * 24),
      ip,
      adminId: userId,
    };
  } else {
    do {
      sessionId = makeId(20);
    } while (sessions[sessionId]);
    sessions[sessionId] = {
      expirationDate: new Date(
        new Date().getTime() + 1000 * 60 * 60 * 24 * (stay ? 90 : 1)
      ),
      ip: stay ? undefined : ip,
      userId,
    };
  }
  Object.keys(sessions).forEach((id) => {
    if (sessions[id].expirationDate < new Date()) {
      delete sessions[id];
    }
  });
  Object.keys(adminSessions).forEach((id) => {
    if (adminSessions[id].expirationDate < new Date()) {
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
      session.expirationDate > new Date() &&
      session.adminId === userId
    );
  } else {
    const session = sessions[sessionId];
    return (
      session &&
      (!session.ip || session.ip === ip) &&
      session.expirationDate > new Date() &&
      session.userId === userId
    );
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
  const ip = ctx.req.connection.remoteAddress;
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
  .query('getAvailableDishes', {
    input: z.object({
      userId: z.string().nonempty().length(20).optional(),
      sessionId: z.string().length(20).optional(),
      start: z.number().nonnegative().optional(),
      locationCity: z.string().nonempty().max(100).optional(),
      dateStart: z.number().nonnegative().optional(),
      dateEnd: z.number().nonnegative().optional(),
      locationRangeSize: z.number().nonnegative().max(200).optional(),
      ageRangeSize: z.number().nonnegative().max(200).optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        if (input.userId && input.sessionId) {
          const ip = getIp(ctx as Context);
          if (verifySession(input.sessionId, ip, input.userId)) {
            let dateStart: Date | undefined = undefined;
            if (input.dateStart) {
              const dateStartParsed = new Date(input.dateStart);
              if (dateStartParsed && !isNaN(dateStartParsed.getTime())) {
                dateStart = dateStartParsed;
              }
            }
            let dateEnd: Date | undefined = undefined;
            if (input.dateEnd) {
              const dateEndParsed = new Date(input.dateEnd);
              if (dateEnd && !isNaN(dateEndParsed.getTime())) {
                dateEnd = dateEndParsed;
              }
            }
            return await getAvailableDishes(
              input.userId,
              input.start,
              undefined,
              input.locationCity,
              dateStart,
              dateEnd,
              input.locationRangeSize,
              input.ageRangeSize
            );
          }
          return false;
        } else {
          let dateStart: Date | undefined = undefined;
          if (input.dateStart) {
            const dateStartParsed = new Date(input.dateStart);
            if (dateStartParsed && !isNaN(dateStartParsed.getTime())) {
              dateStart = dateStartParsed;
            }
          }
          let dateEnd: Date | undefined = undefined;
          if (input.dateEnd) {
            const dateEndParsed = new Date(input.dateEnd);
            if (dateEnd && !isNaN(dateEndParsed.getTime())) {
              dateEnd = dateEndParsed;
            }
          }
          return await getAvailableDishes(
            undefined,
            input.start,
            undefined,
            input.locationCity,
            dateStart,
            dateEnd,
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
      dateStart: z.number().nonnegative().optional(),
      dateEnd: z.number().nonnegative().optional(),
      locationRangeSize: z.number().nonnegative().max(200).optional(),
      ageRangeSize: z.number().nonnegative().max(200).optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.userId)) {
          let dateStart: Date | undefined = undefined;
          if (input.dateStart) {
            const dateStartParsed = new Date(input.dateStart);
            if (dateStartParsed && !isNaN(dateStartParsed.getTime())) {
              dateStart = dateStartParsed;
            }
          }
          let dateEnd: Date | undefined = undefined;
          if (input.dateEnd) {
            const dateEndParsed = new Date(input.dateEnd);
            if (dateEnd && !isNaN(dateEndParsed.getTime())) {
              dateEnd = dateEndParsed;
            }
          }
          return await getRecommendedDishes(
            input.userId,
            input.previousIds,
            undefined,
            input.locationCity,
            dateStart,
            dateEnd,
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
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.userId)) {
          return await getMyDishes(input.userId);
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
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.userId)) {
          return await getSignedUpDishes(input.userId);
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
            return info;
          }
        }
        return false;
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
        if (verifySession(input.sessionId, ip, input.userId)) {
          return await getDishPreferences(input.userId);
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
        if (verifySession(input.sessionId, ip, input.userId)) {
          return await createLoginLink(input.userId, input.stay);
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
    }> {
      try {
        const result = await verifyUserEmail(input.userId, input.code);
        if (result.success) {
          const ip = getIp(ctx as Context);
          const sessionId = addSession(ip, input.userId, result.stay);
          return {
            success: result.success,
            userId: input.userId,
            sessionId,
            admin: result.admin,
            code: result.resetCode,
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
      password: z.string().nonempty().max(20).optional(),
      name: z.string().nonempty().max(200).optional(),
      age: z.number().nonnegative().min(18).max(200).optional(),
      locationCity: z.string().nonempty().max(100).optional(),
      exactLocation: z.string().nonempty().max(1000).optional(),
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
            input.age,
            input.locationCity,
            input.exactLocation
          );

          if (result) {
            return await getUserInfo(input.userId);
          }
        }
        return false;
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
      name: z.string().nonempty().max(200).optional(),
      age: z.number().nonnegative().min(18).max(200).optional(),
      locationCity: z.string().nonempty().max(100).optional(),
      exactLocation: z.string().nonempty().max(1000).optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.userId)) {
          const result = await changeUserInfo(
            input.userId,
            input.password,
            input.newPassword,
            input.name,
            input.age,
            input.locationCity,
            input.exactLocation
          );

          if (result) {
            return await getUserInfo(input.userId);
          }
        }
        return false;
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
            };
          } else {
            const sessionId = addSession(ip, result.userId, input.stay);
            return {
              success: true,
              sessionId,
              showCaptcha: result.showCaptcha,
              nextTry: result.nextTry,
              userId: result.userId,
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
      date: z.number().nonnegative(),
      locationCity: z.string().nonempty().max(100).optional(),
      exactLocation: z.string().nonempty().max(1000).optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.userId)) {
          const date = new Date(input.date);
          if (date && !isNaN(date.getTime())) {
            const dishId = await addDish(
              input.dish,
              input.userId,
              input.slots,
              date,
              input.locationCity,
              input.exactLocation
            );
            return dishId;
          }
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
          if (verifySession(input.sessionId, ip, input.userId)) {
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
        if (verifySession(input.sessionId, ip, input.userId)) {
          return await addDishPreference(input.dish, input.userId, input.likes);
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
        if (verifySession(input.sessionId, ip, input.userId)) {
          return await removeDishPreference(input.dish, input.userId);
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
        if (verifySession(input.sessionId, ip, input.userId)) {
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
        if (verifySession(input.sessionId, ip, input.userId)) {
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
        if (verifySession(input.sessionId, ip, input.userId)) {
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
        if (verifySession(input.sessionId, ip, input.userId)) {
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
  });

setInterval(async () => {
  try {
    train();
  } catch (e: unknown) {
    throw internalServerError(e);
  }
}, TRAIN_INTERVAL);

export type AppRouter = typeof appRouter;
