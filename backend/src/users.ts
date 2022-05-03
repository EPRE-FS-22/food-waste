import { hash, verify } from 'argon2';
import { frontendHost, frontendPort } from './index.js';
import type { StringSetting } from './model';
import { getSettingsCollection, getUsersCollection } from './data.js';
import { makeId } from './id.js';
import { base64Encode } from './base64.js';
import { sendMail } from './mailer.js';
import { timeOutCaptchaAndResponse } from './spamPrevention.js';
import 'dotenv/config';
import { EMAIL_REGEX } from './constants.js';

const frontendPath = process.env.FOOD_WASTE_FRONTEND_PATH ?? '/#';
const frontendProtocol = process.env.FOOD_WASTE_FRONTEND_PROTOCOL ?? 'http://';

export const checkEmail = (email?: string): boolean =>
  !!email && !!email.match(EMAIL_REGEX);

export const hashPassword = async (password: string) => {
  return await hash(password);
};

export const verifyPassword = async (hash: string, password: string) => {
  try {
    return await verify(hash, password);
  } catch (err) {
    console.error('Failed verifying password hash');
    console.error(err);
    process.exitCode = 1;
    return false;
  }
};

export const changePasswordOrName = async (
  userId: string,
  password: string,
  newPassword?: string,
  name?: string
) => {
  if (!newPassword && !name) {
    return false;
  }

  const usersCollection = await getUsersCollection();

  const registeredUser = await usersCollection.findOne({ customId: userId });
  if (!registeredUser || !registeredUser.hash) {
    return false;
  }

  if (await verifyPassword(registeredUser.hash, password)) {
    const passwordHashed = newPassword ? await hashPassword(newPassword) : '';

    await usersCollection.updateOne(
      {
        customId: userId,
      },
      {
        $set: {
          ...(passwordHashed ? { hash: passwordHashed } : {}),
          ...(name ? { name } : {}),
        },
        $currentDate: { changedDate: true },
      }
    );
    return true;
  }

  return false;
};

export const setPasswordOrName = async (
  userId: string,
  code: string,
  newPassword?: string,
  name?: string
) => {
  if (!newPassword && !name) {
    return false;
  }

  const usersCollection = await getUsersCollection();

  const registeredUser = await usersCollection.findOne({ customId: userId });
  if (
    !registeredUser ||
    !registeredUser.resetHash ||
    !registeredUser.resetExpiration
  ) {
    return false;
  }

  if (registeredUser.resetExpiration < new Date()) {
    await usersCollection.updateOne(
      {
        customId: userId,
      },
      {
        $unset: { resetHash: true, resetExpiration: true },
      }
    );
    return false;
  }

  if (code && (await verifyPassword(registeredUser.resetHash, code))) {
    const passwordHashed = newPassword ? hashPassword(newPassword) : '';

    await usersCollection.updateOne(
      {
        customId: userId,
      },
      {
        $set: {
          ...(passwordHashed ? { hash: await passwordHashed } : {}),
          ...(name ? { name } : {}),
        },
        $unset: { resetHash: true, resetExpiration: true },
        $currentDate: { changedDate: true },
      }
    );
    return true;
  } else {
    return false;
  }
};

export const verifyUserEmail = async (
  userId: string,
  code: string
): Promise<{
  success: boolean;
  stay?: boolean;
  admin?: boolean;
  resetCode?: string;
}> => {
  const usersCollection = await getUsersCollection();

  const registeredUser = await usersCollection.findOne({ customId: userId });
  if (
    !registeredUser ||
    !registeredUser.verifyHash ||
    !registeredUser.verifyExpiration
  ) {
    return { success: false };
  }

  if (registeredUser.verifyExpiration < new Date()) {
    await usersCollection.updateOne(
      {
        customId: userId,
      },
      {
        $unset: { verifyHash: true, verifyExpiration: true, verifyStay: true },
      }
    );
    return { success: false };
  }

  if (code && (await verifyPassword(registeredUser.verifyHash, code))) {
    const passwordNew = makeId(15);
    const passwordHashed = await hashPassword(passwordNew);
    await usersCollection.updateOne(
      {
        customId: userId,
      },
      {
        $set: {
          resetHash: passwordHashed,
          resetExpiration: new Date(Date.now() + 1000 * 60 * 30),
        },
        $unset: { verifyHash: true, verifyExpiration: true, verifyStay: true },
        $currentDate: {
          lastLogin: true,
          ...(registeredUser.verifyDate ? {} : { verifyDate: true }),
        },
      }
    );
    return {
      success: true,
      stay: !!registeredUser.verifyStay,
      admin: false,
      resetCode: passwordNew,
    };
  } else {
    return { success: false };
  }
};

export const createLoginLink = async (userId: string, stay = false) => {
  const usersCollection = await getUsersCollection();

  const registeredUser = await usersCollection.findOne({ customId: userId });
  if (!registeredUser) {
    return false;
  }

  const passwordNew = makeId(15);
  const passwordHashed = await hashPassword(passwordNew);

  const link = `${
    frontendProtocol +
    frontendHost +
    (frontendPort ? ':' + frontendPort : '') +
    frontendPath
  }/link?id=${userId}&code=${base64Encode(passwordNew)}`;

  await usersCollection.updateOne(
    {
      customId: userId,
    },
    {
      $set: {
        verifyHash: passwordHashed,
        verifyExpiration: new Date(Date.now() + 1000 * 60 * 30),
        verifyStay: stay,
      },
      $currentDate: { lastChanged: true },
    }
  );

  return link;
};

export const registerOrEmailLogin = async (
  email: string,
  ip: string,
  captchaToken?: string,
  stay = false,
  isRegister = true
) => {
  if (!checkEmail(email)) {
    return await timeOutCaptchaAndResponse(ip, captchaToken, undefined, false);
  }

  return await timeOutCaptchaAndResponse(ip, captchaToken, async () => {
    const usersCollection = await getUsersCollection();

    const registeredUser = await usersCollection.findOne({ email });
    if (isRegister) {
      if (
        registeredUser &&
        (registeredUser.verifyDate ||
          !registeredUser.verifyExpiration ||
          registeredUser.verifyExpiration < new Date())
      )
        return { success: false };
    } else {
      if (!registeredUser || !registeredUser.verifyDate) {
        return { success: false };
      }
    }

    let userId = registeredUser?.customId;

    const passwordNew = makeId(15);
    const passwordHashed = await hashPassword(passwordNew);
    if (isRegister) {
      userId = makeId(20);
      await usersCollection.insertOne({
        customId: userId,
        email,
        verifyHash: passwordHashed,
        verifyExpiration: new Date(Date.now() + 1000 * 60 * 60 * 24),
        verifyStay: stay,
        registerDate: new Date(),
      });
      await usersCollection.deleteMany({
        email,
        verifyExpiration: { $lte: new Date() },
        verifyHash: { $exists: true },
        verifyDate: { $exists: false },
      });
    } else {
      await usersCollection.updateOne(
        {
          email,
        },
        {
          $set: {
            verifyHash: passwordHashed,
            verifyExpiration: new Date(Date.now() + 1000 * 60 * 60),
            verifyStay: stay,
          },
          $currentDate: { lastChanged: true },
        }
      );
    }

    if (userId) {
      const body = isRegister
        ? `Welcome to the Food Waste app.

    To confirm your account just press the following link within the next 24 hours: ${
      frontendProtocol +
      frontendHost +
      (frontendPort ? ':' + frontendPort : '') +
      frontendPath
    }/login?register=true&id=${userId}&code=${base64Encode(passwordNew)}

    If you did not request this email, simply ignore it.`
        : `Welcome back to the Food Waste App.

    To log in just press the following link within the next hour: ${
      frontendProtocol +
      frontendHost +
      (frontendPort ? ':' + frontendPort : '') +
      frontendPath
    }/login?id=${userId}&code=${base64Encode(passwordNew)}

    If you did not request this email, simply ignore it.`;

      await sendMail(
        email,
        'Food Waste ' + (isRegister ? 'Verification' : 'Login'),
        body
      );
      return { success: true };
    }

    return { success: false };
  });
};

export const verifyAdminPassword = async (
  password: string,
  ip: string,
  captchaToken?: string
) => {
  return await timeOutCaptchaAndResponse(ip, captchaToken, async () => {
    const settingsCollection = await getSettingsCollection();

    const hashedPasswordObject = (await settingsCollection.findOne({
      key: 'password',
      type: 'string',
    })) as StringSetting | undefined;
    const adminIdObject = (await settingsCollection.findOne({
      key: 'adminId',
      type: 'string',
    })) as StringSetting | undefined;
    if (hashedPasswordObject && adminIdObject) {
      const result = await verifyPassword(hashedPasswordObject.value, password);
      if (result) {
        return { success: true, admin: true, userId: adminIdObject.value };
      }
    }
    return { success: false };
  });
};

export const loginUser = async (
  email: string,
  password: string,
  ip: string,
  captchaToken?: string
) => {
  if (!checkEmail(email)) {
    return await timeOutCaptchaAndResponse(ip, captchaToken, undefined, false);
  }

  return await timeOutCaptchaAndResponse(ip, captchaToken, async () => {
    const usersCollection = await getUsersCollection();

    const user = await usersCollection.findOne({
      email,
    });
    if (user && user.hash) {
      const result = await verifyPassword(user.hash, password);
      if (result) {
        return { success: true, userId: user.customId };
      }
    }
    return { success: false };
  });
};

export const getUserName = async (userId: string): Promise<string> => {
  const usersCollection = await getUsersCollection();

  const user = await usersCollection.findOne({
    customId: userId,
  });

  if (!user) {
    const settingsCollection = await getSettingsCollection();

    const adminIdObject = (await settingsCollection.findOne({
      key: 'adminId',
      type: 'string',
      value: userId,
    })) as StringSetting | undefined;

    if (adminIdObject) {
      return 'Admin';
    }
  }

  if (user && user.name) {
    return user.name;
  }
  return '';
};
