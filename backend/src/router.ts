import * as trpc from '@trpc/server';
import { z } from 'zod';
import { COLORS, REFRESH_INTERVAL } from './constants.js';
import { Subject } from 'rxjs';
import type { PointsWithStats } from './model';
import { makeId } from './id.js';
import { addPoints, getPointsWithStats } from './points.js';
import {
  changePasswordOrName,
  createLoginLink,
  loginUser,
  registerOrEmailLogin,
  setPasswordOrName,
  verifyUserEmail,
  verifyAdminPassword,
} from './users.js';
import { Context } from './context.js';

let dataChanged = false;
const dataChangedEvent = new Subject<PointsWithStats[]>();

let adminSessions: {
  [key: string]: { expirationDate: Date; ip: string; email?: string };
} = {};

const sessions: {
  [key: string]: { expirationDate: Date; email: string; ip?: string };
} = {};

const addSession = (
  ip: string,
  email?: string,
  stay = false,
  isAdmin = false
) => {
  let sessionId = '';
  if (isAdmin) {
    do {
      sessionId = makeId(20);
    } while (adminSessions[sessionId]);
    adminSessions[sessionId] = {
      expirationDate: new Date(new Date().getTime() + 1000 * 60 * 60 * 24),
      ip,
    };
  } else if (email) {
    do {
      sessionId = makeId(20);
    } while (sessions[sessionId]);
    sessions[sessionId] = {
      expirationDate: new Date(
        new Date().getTime() + 1000 * 60 * 60 * 24 * (stay ? 90 : 1)
      ),
      ip: stay ? undefined : ip,
      email,
    };
  } else {
    return '';
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
  email?: string,
  admin = false
) => {
  if (admin) {
    const session = adminSessions[sessionId];
    return session && session.ip === ip && session.expirationDate > new Date();
  } else if (email) {
    const session = sessions[sessionId];
    return (
      session &&
      (!session.ip || session.ip === ip) &&
      session.expirationDate > new Date() &&
      session.email === email
    );
  }
  return false;
};

const deleteSessions = (
  sessionId: string,
  ip: string,
  email?: string,
  all = false,
  admin = false
) => {
  if (verifySession(sessionId, ip, email, admin)) {
    if (admin) {
      if (all) {
        adminSessions = {};
      } else {
        delete adminSessions[sessionId];
      }
      return true;
    } else if (email) {
      if (all) {
        Object.keys(sessions).forEach((id) => {
          const session = sessions[id];
          if (session.email === email) {
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
  .subscription('onPointsChanged', {
    resolve() {
      return new trpc.Subscription<PointsWithStats[]>((emit) => {
        const onPointsIncrease = (data: PointsWithStats[]) => {
          emit.data(data);
        };

        const sub = dataChangedEvent.subscribe((data: PointsWithStats[]) => {
          onPointsIncrease(data);
        });

        return () => {
          sub.unsubscribe();
        };
      });
    },
  })
  .query('getPoints', {
    async resolve() {
      try {
        return await getPointsWithStats();
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .query('getLoginLink', {
    input: z.object({
      email: z.string().email().nonempty().max(200),
      sessionId: z.string().length(20),
      stay: z.boolean().optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.email)) {
          return await createLoginLink(input.email, input.stay);
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
      emailEncoded: z.string().email().nonempty().max(1000),
      code: z.string().nonempty().max(1000),
    }),
    async resolve({
      input,
      ctx,
    }): Promise<{ success: boolean; email?: string; sessionId?: string }> {
      try {
        const result = await verifyUserEmail(input.emailEncoded, input.code);
        if (result.success && result.email) {
          const ip = getIp(ctx as Context);
          const sessionId = addSession(ip, result.email, result.stay);
          return { success: result.success, email: result.email, sessionId };
        }
        return { success: false };
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('reset', {
    input: z.object({
      email: z.string().email().nonempty().max(200),
      code: z.string().nonempty().max(1000),
      sessionId: z.string().length(20),
      password: z.string().nonempty().max(20).optional(),
      name: z.string().nonempty().max(200).optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.email)) {
          return await setPasswordOrName(
            input.email,
            input.code,
            input.password,
            input.name
          );
        }
        return false;
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('change', {
    input: z.object({
      email: z.string().email().nonempty().max(200),
      sessionId: z.string().length(20),
      password: z.string().nonempty().max(20),
      newPassword: z.string().nonempty().max(20).optional(),
      name: z.string().nonempty().max(200).optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (verifySession(input.sessionId, ip, input.email)) {
          return await changePasswordOrName(
            input.email,
            input.password,
            input.newPassword,
            input.name
          );
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
    }> {
      try {
        const ip = getIp(ctx as Context);
        const result = input.email
          ? await loginUser(input.email, input.password, ip, input.captchaToken)
          : await verifyAdminPassword(input.password, ip, input.captchaToken);
        if (result.success) {
          if (result.admin) {
            const sessionId = addSession(ip, undefined, input.stay, true);
            return {
              success: true,
              sessionId,
              showCaptcha: result.showCaptcha,
              nextTry: result.nextTry,
              admin: true,
            };
          } else {
            const sessionId = addSession(ip, input.email, input.stay);
            return {
              success: true,
              sessionId,
              showCaptcha: result.showCaptcha,
              nextTry: result.nextTry,
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
  .mutation('addPoints', {
    input: z.object({
      color: z.string().nonempty().max(20),
      number: z.number().min(-1000).max(1000).int(),
      sessionId: z.string().length(20),
      date: z.number().nonnegative().optional(),
      owner: z.string().nonempty().max(100).optional(),
      reason: z.string().nonempty().max(1000).optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        if (
          Object.keys(COLORS).includes(input.color) &&
          verifySession(input.sessionId, ip, undefined, true)
        ) {
          let date = input.date ? new Date(input.date) : undefined;
          if (date && isNaN(date.getTime())) {
            date = undefined;
          }

          const points = await addPoints(
            input.color as keyof typeof COLORS,
            input.number,
            date,
            input.owner,
            input.reason
          );
          dataChanged = true;
          return points;
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
      admin: z.boolean().optional(),
    }),
    resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        return verifySession(input.sessionId, ip, undefined, input.admin);
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  })
  .mutation('logout', {
    input: z.object({
      sessionId: z.string().length(20),
      email: z.string().email().nonempty().max(200).optional(),
      all: z.boolean().optional(),
    }),
    async resolve({ input, ctx }) {
      try {
        const ip = getIp(ctx as Context);
        return deleteSessions(input.sessionId, ip, input.email, input.all);
      } catch (e: unknown) {
        throw internalServerError(e);
      }
    },
  });

setInterval(async () => {
  try {
    if (dataChanged) {
      dataChanged = false;
      dataChangedEvent.next(await getPointsWithStats());
    }
  } catch (e: unknown) {
    throw internalServerError(e);
  }
}, REFRESH_INTERVAL);

export type AppRouter = typeof appRouter;
