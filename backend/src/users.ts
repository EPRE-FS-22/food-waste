import { hash, verify } from 'argon2';
import { generateFrontendLink } from './index.js';
import type { StringSetting, UserInfoPrivate } from './model';
import { getSettingsCollection, getUsersCollection } from './data.js';
import { makeId } from './id.js';
import { base64Encode } from './base64.js';
import { mailAddress, sendMail } from './mailer.js';
import { timeOutCaptchaAndResponse } from './spamPrevention.js';
import 'dotenv/config';
import { APP_NAME, EMAIL_REGEX } from './constants.js';
import { getCoords } from './geo.js';
import { validateId } from './validateId.js';

export const checkEmail = (email?: string): boolean =>
  !!email &&
  !!email.match(EMAIL_REGEX) &&
  email.toLowerCase() !== mailAddress?.toLowerCase();

export const hashPassword = async (password: string) => {
  return await hash(password);
};

const listStrings = (items: string[]): string => {
  if (items.length) {
    if (items.length === 1) {
      return items[0];
    } else if (items.length === 2) {
      return items[0] + ' and ' + items[1];
    } else {
      return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
    }
  }
  return '';
};

const listChanges = (changes: { [key: string]: unknown }): [string, number] => {
  const filteredChanges = Object.keys(changes).filter((key) => changes[key]);
  return [listStrings(filteredChanges), filteredChanges.length];
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

export const changeUserInfo = async (
  userId: string,
  password: string,
  newPassword?: string,
  locationCity?: string,
  exactLocation?: string
) => {
  if (!newPassword && !locationCity && !exactLocation) {
    return false;
  }

  const usersCollection = await getUsersCollection();

  const registeredUser = await usersCollection.findOne({
    customId: userId,
    identityConfirmed: true,
    infosSet: true,
  });
  if (!registeredUser || !registeredUser.hash) {
    return false;
  }

  if (await verifyPassword(registeredUser.hash, password)) {
    const passwordHashed = newPassword ? await hashPassword(newPassword) : '';

    let locationCityCoords: [number, number] | null = null;

    if (locationCity) {
      locationCityCoords = await getCoords(locationCity);
    }

    if (!locationCityCoords && !newPassword && !exactLocation) {
      return false;
    }

    await usersCollection.updateOne(
      {
        customId: userId,
      },
      {
        $set: {
          ...(passwordHashed ? { hash: passwordHashed } : {}),
          ...(locationCityCoords ? { locationCity } : {}),
          ...(locationCityCoords ? { locationCityCoords } : {}),
          ...(exactLocation ? { exactLocation } : {}),
        },
        $currentDate: { changedDate: true },
      }
    );

    const [changesString, changesNumber] = listChanges({
      password: passwordHashed,
      'approximate location': locationCity,
      'exact address': exactLocation,
    });

    const body = `Hello ${registeredUser.name}

Thank your for using the ${APP_NAME} App.

Your ${changesString} ${changesNumber > 0 ? 'have' : 'has'} been changed.

If this was not you use the site to reset it: ${generateFrontendLink(
      '/login'
    )}`;
    await sendMail(registeredUser.email, APP_NAME + ' account changed', body);

    return true;
  }

  return false;
};

export const setUserInfoInternal = async (
  userId: string,
  code: string,
  newPassword: string,
  name: string,
  dateOfBirth: Date,
  locationCity: string,
  exactLocation: string
) => {
  if (
    !newPassword ||
    !name ||
    !dateOfBirth ||
    !locationCity ||
    !exactLocation
  ) {
    return { success: false };
  }

  const usersCollection = await getUsersCollection();

  const registeredUser = await usersCollection.findOne({
    customId: userId,
    $or: [{ identityConfirmed: false }, { infosSet: false }],
  });
  if (
    !registeredUser ||
    !registeredUser.resetHash ||
    !registeredUser.resetExpiration
  ) {
    return { success: false };
  }

  if (registeredUser.resetExpiration.getTime() < Date.now()) {
    await usersCollection.updateOne(
      {
        customId: userId,
      },
      {
        $unset: { resetHash: true, resetExpiration: true },
      }
    );
    return { success: false };
  }

  if (code && (await verifyPassword(registeredUser.resetHash, code))) {
    const passwordHashed = newPassword ? await hashPassword(newPassword) : '';

    const locationCityCoords = await getCoords(locationCity);

    if (!locationCityCoords) {
      return { success: false };
    }

    if (
      (
        await usersCollection.updateOne(
          {
            customId: userId,
          },
          {
            $set: {
              hash: passwordHashed,
              name,
              dateOfBirth,
              locationCity,
              locationCityCoords,
              exactLocation,
              identityConfirmed: true,
              infosSet: true,
            },
            $unset: { resetHash: true, resetExpiration: true },
            $currentDate: { changedDate: true },
          }
        )
      ).modifiedCount > 0
    ) {
      return {
        success: true,
        passwordHashed,
        locationCityCoords,
        previousName: registeredUser.name,
        email: registeredUser.email,
      };
    }
  }
  return { success: false };
};

export const setUserInfo = async (
  userId: string,
  code: string,
  newPassword: string,
  name: string,
  dateOfBirth: Date,
  locationCity: string,
  exactLocation: string,
  idImageBase64: string
) => {
  if (
    !newPassword ||
    !name ||
    !dateOfBirth ||
    !locationCity ||
    !exactLocation ||
    !idImageBase64
  ) {
    return false;
  }

  if (dateOfBirth.getTime() >= Date.now() - 1000 * 60 * 60 * 24 * 365 * 18) {
    return false;
  }

  const identityConfirmed = await validateId(idImageBase64);

  if (identityConfirmed) {
    const result = await setUserInfoInternal(
      userId,
      code,
      newPassword,
      name,
      dateOfBirth,
      locationCity,
      exactLocation
    );
    if (result.success && result.email) {
      const [changesString, changesNumber] = listChanges({
        password: result.passwordHashed,
        name,
        'date of birth': dateOfBirth,
        'approximate location': result.locationCityCoords,
        'exact address': exactLocation,
        identification: identityConfirmed,
      });

      const body = `Hello ${result.email}

  Thank your for using the ${APP_NAME} App.

  Your ${changesString} ${changesNumber > 0 ? 'have' : 'has'} been set.

  If this was not you contact our support via our site: ${generateFrontendLink(
    '/login'
  )}`;
      await sendMail(result.email, APP_NAME + ' account set', body);

      return true;
    }
  }
  return false;
};

export const resetUserInfo = async (
  userId: string,
  code: string,
  newPassword?: string,
  locationCity?: string,
  exactLocation?: string
) => {
  if (!newPassword && !locationCity && !exactLocation) {
    return false;
  }

  const usersCollection = await getUsersCollection();

  const registeredUser = await usersCollection.findOne({
    customId: userId,
    identityConfirmed: true,
    infosSet: true,
  });
  if (
    !registeredUser ||
    !registeredUser.resetHash ||
    !registeredUser.resetExpiration
  ) {
    return false;
  }

  if (registeredUser.resetExpiration.getTime() < Date.now()) {
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
    const passwordHashed = newPassword ? await hashPassword(newPassword) : '';

    let locationCityCoords: [number, number] | null = null;

    if (locationCity) {
      locationCityCoords = await getCoords(locationCity);
    }

    if (!locationCityCoords && !newPassword && !exactLocation) {
      return false;
    }

    await usersCollection.updateOne(
      {
        customId: userId,
      },
      {
        $set: {
          ...(passwordHashed ? { hash: passwordHashed } : {}),
          ...(locationCityCoords ? { locationCity } : {}),
          ...(locationCityCoords ? { locationCityCoords } : {}),
          ...(exactLocation ? { exactLocation } : {}),
        },
        $unset: { resetHash: true, resetExpiration: true },
        $currentDate: { changedDate: true },
      }
    );

    const [changesString, changesNumber] = listChanges({
      password: passwordHashed,
      'approximate location': locationCityCoords,
      'exact address': exactLocation,
    });

    const body = `Hello ${registeredUser.name}

Thank your for using the ${APP_NAME} App.

Your ${changesString} ${changesNumber > 0 ? 'have' : 'has'} been changed.

If this was not you use the site to reset it: ${generateFrontendLink(
      '/login'
    )}`;
    await sendMail(registeredUser.email, APP_NAME + ' account changed', body);

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
  infosSet?: boolean;
  identityConfirmed?: boolean;
  preferencesSet?: boolean;
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

  if (registeredUser.verifyExpiration.getTime() < Date.now()) {
    await usersCollection.deleteOne({
      customId: userId,
    });
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
      infosSet: registeredUser.infosSet,
      identityConfirmed: registeredUser.identityConfirmed,
      preferencesSet: registeredUser.preferencesSet,
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

  const link = generateFrontendLink(
    `/link?id=${userId}&code=${base64Encode(passwordNew)}`
  );

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

export const registerOrEmailLoginInternal = async (
  email: string,
  stay = false,
  isRegister = true,
  populated = false
) => {
  const lowercaseEmail = email.toLocaleLowerCase();

  const usersCollection = await getUsersCollection();

  const registeredUser = await usersCollection.findOne({
    email: lowercaseEmail,
  });
  if (isRegister) {
    if (registeredUser) {
      if (
        registeredUser.verifyDate ||
        !registeredUser.verifyExpiration ||
        registeredUser.verifyExpiration.getTime() < Date.now()
      ) {
        return { success: false };
      } else {
        await usersCollection.deleteOne({
          email: lowercaseEmail,
        });
        return { success: false };
      }
    }
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
      email: lowercaseEmail,
      verifyHash: passwordHashed,
      verifyExpiration: new Date(Date.now() + 1000 * 60 * 60 * 24),
      verifyStay: stay,
      registerDate: new Date(),
      identityConfirmed: false,
      infosSet: false,
      preferencesSet: false,
      populated,
      showPopulated: true,
    });
    await usersCollection.deleteMany({
      email: lowercaseEmail,
      verifyExpiration: { $lte: new Date() },
      verifyHash: { $exists: true },
      verifyDate: { $exists: false },
    });
  } else {
    await usersCollection.updateOne(
      {
        email: lowercaseEmail,
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
  return {
    success: userId ? true : false,
    userId: userId ? userId : undefined,
    passwordNew: passwordNew ? passwordNew : undefined,
  };
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
    const result = await registerOrEmailLoginInternal(email, stay, isRegister);

    if (result.success && result.userId && result.passwordNew) {
      const body = isRegister
        ? `Welcome to the ${APP_NAME} app.

To confirm your account just press the following link within the next 24 hours: ${generateFrontendLink(
            '/login?register=true&id=' +
              result.userId +
              '&code=' +
              base64Encode(result.passwordNew)
          )}

If you did not request this email, simply ignore it.`
        : `Welcome back to the ${APP_NAME} App.

To log in just press the following link within the next hour: ${generateFrontendLink(
            '/login?id=' +
              result.userId +
              '&code=' +
              base64Encode(result.passwordNew)
          )}

If you did not request this email, simply ignore it.`;

      await sendMail(
        email,
        APP_NAME + ' ' + (isRegister ? 'Verification' : 'Login'),
        body
      );
      return { success: true };
    }

    return { success: false };
  });
};

export const deletePopulatedUsers = async () => {
  const usersCollection = await getUsersCollection();

  await usersCollection.deleteMany({
    populated: true,
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

  const lowercaseEmail = email.toLocaleLowerCase();

  return await timeOutCaptchaAndResponse(ip, captchaToken, async () => {
    const usersCollection = await getUsersCollection();

    const user = await usersCollection.findOne({
      email: lowercaseEmail,
    });
    if (user && user.hash) {
      const result = await verifyPassword(user.hash, password);
      if (result) {
        if (
          (
            await usersCollection.updateOne(
              { customId: user.customId },
              {
                $currentDate: {
                  lastLogin: true,
                },
              }
            )
          ).modifiedCount > 0
        ) {
          return {
            success: true,
            userId: user.customId,
            infosSet: user.infosSet,
            identityConfirmed: user.identityConfirmed,
            preferencesSet: user.preferencesSet,
          };
        }
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

  if (user) {
    return user.name ?? user.email;
  }
  return '';
};

export const getUserInfo = async (
  userId: string
): Promise<UserInfoPrivate | null> => {
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
      return {
        name: 'Admin',
        infosSet: false,
        identityConfirmed: false,
        preferencesSet: false,
        showPopulated: true,
      };
    }
  }

  if (user) {
    return {
      name: user.name ?? user.email,
      dateOfBirth: user.dateOfBirth,
      locationCity: user.locationCity,
      locationCityCoords: user.locationCityCoords,
      exactLocation: user.exactLocation,
      identityConfirmed: user.identityConfirmed,
      infosSet: user.infosSet,
      preferencesSet: user.preferencesSet,
      showPopulated: user.showPopulated,
    };
  }
  return null;
};

export const userPreferencesSet = async (userId: string) => {
  const usersCollection = await getUsersCollection();

  return (
    (
      await usersCollection.updateOne(
        {
          customId: userId,
        },
        {
          $set: { preferencesSet: true },
        }
      )
    ).modifiedCount > 0
  );
};

export const sendUserMail = async (
  userId: string,
  subject: string,
  body: string,
  html?: string
) => {
  const usersCollection = await getUsersCollection();

  const user = await usersCollection.findOne({
    customId: userId,
  });

  if (user) {
    await sendMail(user.email, subject, body, html);
  }

  return false;
};
