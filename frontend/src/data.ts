import type { AppRouter } from '../../backend/src/router';
import { createWSClient, wsLink } from '@trpc/client/links/wsLink';
import { createTRPCClient } from '@trpc/client';
import { COLORS } from './constants';
import type { PointsCategory, PointsWithStats } from '../../backend/src/model';
import { BehaviorSubject, Subject } from 'rxjs';

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

let points: PointsWithStats[] = Object.keys(COLORS).map((item) => ({
  color: item as keyof typeof COLORS,
  points: 0,
  lastChanged: new Date(0),
  categories: [],
}));

export interface DisplayColor {
  color: string;
  colorString: string;
  currentColor: string;
  previousColor: string;
  points: number;
  relativePercentage: number;
  currentPercentage: number;
  badgeString: string;
  badgeClass?: string;
  categories: PointsCategory[];
  image?: string;
}

export type DisplayData = DisplayColor[];

const placesStrings = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

const lastString = '';

const scale = 2.1;
const maxGrowScale = 1.5;

let previousMaxIndex = 0;

const randomOrder: { [key: string]: number } = {};

let sessionExpires =
  parseInt(localStorage.getItem('sessionExpires') ?? '') ?? 0;
let sessionEmail = localStorage.getItem('sessionEmail') ?? '';
let sessionId = localStorage.getItem('session') ?? '';
let isAdmin = localStorage.getItem('admin') === 'true';

export const hasSession = (admin = false) => {
  return (
    !!sessionId && sessionExpires > new Date().getTime() && (!admin || isAdmin)
  );
};

export const hasModifiableSession = () => {
  return hasSession() && sessionEmail;
};

const processData = (data: PointsWithStats[], zero = false): DisplayData => {
  const highestPoints = Math.max(...data.map((item) => item.points));

  let pointsMaxIndex = scale * highestPoints;
  if (previousMaxIndex) {
    if (pointsMaxIndex < previousMaxIndex * maxGrowScale) {
      pointsMaxIndex = previousMaxIndex;
    } else {
      pointsMaxIndex = pointsMaxIndex / maxGrowScale;
    }
  }

  previousMaxIndex = pointsMaxIndex;

  if (!pointsMaxIndex) {
    pointsMaxIndex = 1;
  }

  const dataNormalizedArray: {
    color: string;
    relative: number;
    points: number;
    categories: PointsCategory[];
  }[] = data.map((item) => ({
    color: item.color,
    relative: item.points / pointsMaxIndex,
    points: item.points,
    categories: item.categories,
  }));

  dataNormalizedArray.sort((a, b) => {
    if (a.points < b.points) {
      return 1;
    }
    if (a.points > b.points) {
      return -1;
    }
    const previousRandom = randomOrder[a.color + '-' + b.color];
    if (previousRandom) {
      return 0;
    }
    const previousReverseRandom = randomOrder[b.color + '-' + a.color];
    if (previousReverseRandom) {
      return 0;
    }
    const random = Math.random();
    randomOrder[a.color + '-' + b.color] = random;
    if (random < 0.5) {
      return 0;
    } else {
      return -1;
    }
  });

  let previousScore = -1;
  let previousPlaceString = '';

  const displayData: DisplayData = dataNormalizedArray.map((item, index) => {
    let badgeString = '';
    let badgeClass = '';
    if (item.points === previousScore) {
      badgeString = previousPlaceString;
    } else {
      if (
        lastString &&
        (item.points === 0 ||
          index === dataNormalizedArray.length - 1 ||
          !dataNormalizedArray
            .slice(index)
            .find((searchItem) => searchItem.points < item.points))
      ) {
        previousPlaceString = lastString;
      } else {
        previousPlaceString = placesStrings[index] ?? '';
      }
      badgeString = previousPlaceString;
      previousScore = item.points;
    }

    if (placesStrings[0] === previousPlaceString) {
      badgeClass = 'first';
    } else if (placesStrings[1] === previousPlaceString) {
      badgeClass = 'second';
    } else if (placesStrings[2] === previousPlaceString) {
      badgeClass = 'third';
    } else if (lastString && lastString === previousPlaceString) {
      badgeClass = 'last';
    }

    const previousColor = zero
      ? item.color
      : dataSubject.value[index]?.color ?? item.color;
    const returnObject: DisplayColor = {
      color: item.color,
      colorString: item.color.charAt(0).toUpperCase() + item.color.slice(1),
      currentColor: previousColor,
      previousColor,
      points: item.points,
      relativePercentage: item.relative * 100,
      currentPercentage: zero
        ? 0
        : dataSubject.value.find((prevItem) => prevItem.color === item.color)
            ?.currentPercentage ?? 0,
      badgeString,
      badgeClass,
      categories: item.categories.sort((a, b) => b.amount - a.amount),
    };
    return returnObject;
  });

  return displayData;
};

export const zeroData = processData(points, true);

const dataSubject = new BehaviorSubject(zeroData);

export const authFailure = new Subject<void>();

export const inLogin = new Subject<boolean>();

const getLatestTimestamp = (data: PointsWithStats[]) => {
  return Math.max(...data.map((item) => new Date(item.lastChanged).getTime()));
};

const isDataNewer = (data: PointsWithStats[]) => {
  return getLatestTimestamp(data) > getLatestTimestamp(points);
};

export const getPoints = async () => {
  try {
    const data = await client.query('getPoints');
    if (isDataNewer(data)) {
      points = data;
      const displayData = processData(points);
      dataSubject.next(displayData);
    }
    return dataSubject.value;
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const addPoints = async (
  color: string,
  number: number,
  date?: Date,
  owner?: string,
  reason?: string
) => {
  try {
    if (!hasSession(true)) {
      authFailure.next();
    }
    const data = await client.mutation('addPoints', {
      color,
      number,
      sessionId: sessionId,
      date: date ? date.getTime() : undefined,
      owner: owner || undefined,
      reason: reason || undefined,
    });
    if (!data) {
      authFailure.next();
      return;
    }
    if (isDataNewer(data)) {
      points = data;
      const displayData = processData(points);
      dataSubject.next(displayData);
    }
    return dataSubject.value;
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
        sessionId: sessionId,
        email: sessionEmail || undefined,
        admin: admin || isAdmin || undefined,
      });
      if (!data) {
        sessionId = '';
        sessionEmail = '';
        isAdmin = false;
        sessionExpires = 0;
        localStorage.setItem('session', '');
        localStorage.setItem('sessionEmail', '');
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

export const subscribePoints = () => {
  (async () => {
    try {
      await client.subscription('onPointsChanged', undefined, {
        onNext: (data) => {
          if (data.type === 'data') {
            const newData = data.data;
            if (isDataNewer(newData)) {
              points = newData;
              const displayData = processData(points);
              dataSubject.next(displayData);
            }
          }
        },
      });
    } catch (e) {
      console.error(e);
      throw e;
    }
  })();
  return dataSubject;
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
      sessionEmail = email ?? '';
      localStorage.setItem('sessionEmail', sessionEmail);
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

export const verify = async (email: string, code: string) => {
  try {
    const result = await client.mutation('verify', {
      email,
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
      sessionEmail = email ?? '';
      localStorage.setItem('sessionEmail', sessionEmail);
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
    if (!sessionEmail) {
      return false;
    }
    const result = await client.mutation('reset', {
      email: sessionEmail,
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
    if (!sessionEmail) {
      return false;
    }
    const result = await client.mutation('change', {
      email: sessionEmail,
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
    await client.mutation('logout', { sessionId });
    sessionId = '';
    sessionEmail = '';
    isAdmin = false;
    sessionExpires = 0;
    localStorage.setItem('sessionEmail', '');
    localStorage.setItem('session', '');
    localStorage.setItem('sessionExpires', '');
    localStorage.setItem('admin', '');
  } catch (e) {
    console.error(e);
    throw e;
  }
};
