import { hash, verify } from 'argon2';
import { frontendHost } from './index.js';
import type { StringSetting } from './model';
import { getSettingsCollection, getUsersCollection } from './data.js';
import { makeId } from './id.js';
import { base64Decode, base64Encode } from './base64.js';
import { sendMail } from './mailer.js';
import { timeOutCaptchaAndResponse } from './spamPrevention.js';
import { EMAIL_ENDING } from './constants.js';

const frontendPath = process.env.FOOD_WASTE_FRONTEND_PATH ?? '/#';
const frontendProtocol = process.env.FOOD_WASTE_FRONTEND_PROTOCOL ?? 'http://';

export const checkEmail = (email?: string): boolean =>
  !!email && email.endsWith(EMAIL_ENDING);

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
  email: string,
  password: string,
  newPassword?: string,
  name?: string
) => {
  if (!newPassword && !name) {
    return false;
  }

  if (!checkEmail(email)) {
    return false;
  }

  const usersCollection = await getUsersCollection();

  const registeredUser = await usersCollection.findOne({ email });
  if (!registeredUser || !registeredUser.hash) {
    return false;
  }

  if (await verifyPassword(registeredUser.hash, password)) {
    const passwordHashed = newPassword ? hashPassword(newPassword) : '';

    await usersCollection.updateOne(
      {
        email,
      },
      {
        ...(passwordHashed ? { hashPassword: passwordHashed } : {}),
        ...(name ? { name } : {}),
        $currentDate: { changedDate: true },
      }
    );
    return email;
  }

  return false;
};

export const setPasswordOrName = async (
  email: string,
  code: string,
  newPassword?: string,
  name?: string
) => {
  if (!newPassword && !name) {
    return false;
  }

  if (!checkEmail(email)) {
    return false;
  }

  const usersCollection = await getUsersCollection();

  const registeredUser = await usersCollection.findOne({ email });
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
        email,
      },
      {
        $unset: { resetHash: true, resetExpiration: true },
      }
    );
    return false;
  }

  const codeDecoded = base64Decode(code);
  if (
    codeDecoded &&
    (await verifyPassword(codeDecoded, registeredUser.resetHash))
  ) {
    const passwordHashed = newPassword ? hashPassword(newPassword) : '';

    await usersCollection.updateOne(
      {
        email,
      },
      {
        ...(passwordHashed ? { hashPassword: passwordHashed } : {}),
        ...(name ? { name } : {}),
        $unset: { resetHash: true, resetExpiration: true },
        $currentDate: { changedDate: true },
      }
    );
    return email;
  } else {
    return false;
  }
};

export const verifyUserEmail = async (
  emailEncoded: string,
  code: string
): Promise<{ success: boolean; email?: string; stay?: boolean }> => {
  const email = base64Decode(emailEncoded);

  if (!checkEmail(email)) {
    return { success: false };
  }

  const usersCollection = await getUsersCollection();

  const registeredUser = await usersCollection.findOne({ email });
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
        email,
      },
      {
        $unset: { verifyHash: true, verifyExpiration: true, verifyStay: true },
      }
    );
    return { success: false };
  }

  const codeDecoded = base64Decode(code);
  if (
    codeDecoded &&
    (await verifyPassword(codeDecoded, registeredUser.verifyHash))
  ) {
    const passwordNew = makeId(15);
    const passwordHashed = await hashPassword(passwordNew);
    await usersCollection.updateOne(
      {
        email,
      },
      {
        resetHash: passwordHashed,
        resetExpiration: new Date(Date.now() + 1000 * 60 * 30),
        $unset: { verifyHash: true, verifyExpiration: true, verifyStay: true },
        $currentDate: {
          lastLogin: true,
          ...(registeredUser.verifyDate ? {} : { verifyDate: true }),
        },
      }
    );
    return { success: true, email, stay: !!registeredUser.verifyStay };
  } else {
    return { success: false };
  }
};

export const createLoginLink = async (email: string, stay = false) => {
  if (!checkEmail(email)) {
    return false;
  }

  const usersCollection = await getUsersCollection();

  const registeredUser = await usersCollection.findOne({ email });
  if (!registeredUser) {
    return false;
  }

  const passwordNew = makeId(15);
  const passwordHashed = await hashPassword(passwordNew);

  const link = `${
    frontendProtocol + frontendHost + frontendPath
  }/link?email=${base64Encode(email)}&code=${base64Encode(passwordNew)}`;

  await usersCollection.updateOne(
    {
      email,
    },
    {
      verifyHash: passwordHashed,
      verifyExpiration: new Date(Date.now() + 1000 * 60 * 30),
      verifyStay: stay,
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
    if (!!registeredUser?.verifyDate === isRegister) {
      return { success: false };
    }

    const passwordNew = makeId(15);
    const passwordHashed = await hashPassword(passwordNew);
    if (isRegister) {
      await usersCollection.insertOne({
        email,
        verifyHash: passwordHashed,
        verifyExpiration: new Date(Date.now() + 1000 * 60 * 60 * 24),
        verifyStay: stay,
        registerDate: new Date(),
      });
      await usersCollection.deleteMany({
        email,
        verifyExpiration: { $lte: new Date() },
        $exists: { verifyHash: true, hashPassword: false },
      });
    } else {
      await usersCollection.updateOne(
        {
          email,
        },
        {
          verifyHash: passwordHashed,
          verifyExpiration: new Date(Date.now() + 1000 * 60 * 60),
          verifyStay: stay,
          $currentDate: { lastChanged: true },
        }
      );
    }

    const body = isRegister
      ? `Welcome to the Food Waste app.

  To confirm your account just press the following link within the next 24 hours: ${
    frontendProtocol + frontendHost + frontendPath
  }/login?register=true&email=${base64Encode(email)}&code=${base64Encode(
          passwordNew
        )}

  If you did not request this email, simply ignore it.`
      : `Welcome back to the Food Waste App.

  To log in just press the following link within the next hour: ${
    frontendProtocol + frontendHost + frontendPath
  }/login?email=${base64Encode(email)}&code=${base64Encode(passwordNew)}

  If you did not request this email, simply ignore it.`;

    await sendMail(
      email,
      'Food Waste ' + (isRegister ? 'Verification' : 'Login'),
      body
    );
    return { success: true };
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
    if (hashedPasswordObject) {
      const result = await verifyPassword(hashedPasswordObject.value, password);
      if (result) {
        return { success: true, admin: true };
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
        return { success: true };
      }
    }
    return { success: false };
  });
};
