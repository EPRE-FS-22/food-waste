import fakerator from 'fakerator';
import type locationDataType from './locations.json';
import type dishDataType from './dishes.json';
import { readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { getWikiPage } from './wiki.js';
import {
  deletePopulatedUsers,
  registerOrEmailLoginInternal,
  setUserInfoInternal,
  verifyUserEmail,
} from './users.js';
import { mailAddress } from './mailer.js';
import { makeId } from './id.js';
import {
  acceptDishEventInternal,
  addDish,
  addDishEventInternal,
  addDishPreference,
  removePopulatedDishes,
  removePopulatedDishEvents,
  removePopulatedDishPreferences,
} from './dishes.js';
import { getCoords } from './geo.js';
import { getSettingsCollection } from './data.js';
import type { BooleanSetting, DateSetting } from './model';
import { AUTO_POPULATE_INTERVAL } from './constants.js';

let autoPopulate: boolean | undefined = undefined;

export const enableAutoPopulate = async () => {
  if (autoPopulate !== undefined) {
    if (autoPopulate) {
      return true;
    }

    const settingsCollection = await getSettingsCollection();

    const autoPopulateObject = (await settingsCollection.findOne({
      key: 'autoPopulate',
      type: 'boolean',
    })) as BooleanSetting | undefined;
    if (autoPopulateObject) {
      const result =
        (
          await settingsCollection.updateOne(
            {
              key: 'autoPopulate',
              type: 'boolean',
            },
            {
              $set: { value: true },
            }
          )
        ).modifiedCount > 0;

      if (result) {
        autoPopulate = true;
        await startAutoPopulateAsync();
        return true;
      }
    } else {
      const result = (
        await settingsCollection.insertOne({
          key: 'autoPopulate',
          type: 'boolean',
          value: true,
        })
      ).acknowledged;

      if (result) {
        autoPopulate = true;
        await startAutoPopulateAsync();
        return true;
      }
    }
  }
  return false;
};

export const disableAutoPopulate = async () => {
  if (autoPopulate !== undefined) {
    if (!autoPopulate) {
      return true;
    }

    const settingsCollection = await getSettingsCollection();

    const autoPopulateObject = (await settingsCollection.findOne({
      key: 'autoPopulate',
      type: 'boolean',
    })) as BooleanSetting | undefined;
    if (autoPopulateObject) {
      const result =
        (
          await settingsCollection.updateOne(
            {
              key: 'autoPopulate',
              type: 'boolean',
            },
            {
              $set: { value: false },
            }
          )
        ).modifiedCount > 0;

      if (result) {
        autoPopulate = false;
        if (autoPopulateTimeout) {
          clearTimeout(autoPopulateTimeout);
        }
        if (autoPopulateInterval) {
          clearInterval(autoPopulateInterval);
        }
        return true;
      }
    } else {
      const result = (
        await settingsCollection.insertOne({
          key: 'autoPopulate',
          type: 'boolean',
          value: false,
        })
      ).acknowledged;

      if (result) {
        autoPopulate = false;
        if (autoPopulateTimeout) {
          clearTimeout(autoPopulateTimeout);
        }
        if (autoPopulateInterval) {
          clearInterval(autoPopulateInterval);
        }
        return true;
      }
    }
  }
  return false;
};

const getAutoPopulateInternal = async () => {
  if (autoPopulate === undefined) {
    const settingsCollection = await getSettingsCollection();

    const autoPopulateObject = (await settingsCollection.findOne({
      key: 'autoPopulate',
      type: 'boolean',
    })) as BooleanSetting | undefined;

    if (autoPopulateObject) {
      autoPopulate = autoPopulateObject.value;
    } else {
      autoPopulate = false;
    }
  }
  return autoPopulate;
};

export const getAutoPopulate = async () => {
  if (autoPopulate === undefined) {
    return await getAutoPopulateInternal();
  }
  return autoPopulate;
};

const setAutoPopulateDate = async () => {
  if (autoPopulate) {
    const settingsCollection = await getSettingsCollection();

    const autoPopulateDateObject = (await settingsCollection.findOne({
      key: 'autoPopulateDate',
      type: 'date',
    })) as DateSetting | undefined;
    if (autoPopulateDateObject) {
      const result =
        (
          await settingsCollection.updateOne(
            {
              key: 'autoPopulateDate',
              type: 'date',
            },
            {
              $set: { value: new Date() },
            }
          )
        ).modifiedCount > 0;

      if (result) {
        return true;
      }
    } else {
      const result = (
        await settingsCollection.insertOne({
          key: 'autoPopulateDate',
          type: 'date',
          value: new Date(),
        })
      ).acknowledged;

      if (result) {
        return true;
      }
    }
  }
  return false;
};

const getAutoPopulateDate = async () => {
  if (autoPopulate) {
    const settingsCollection = await getSettingsCollection();

    const autoPopulateDateObject = (await settingsCollection.findOne({
      key: 'autoPopulateDate',
      type: 'date',
    })) as DateSetting | undefined;

    if (autoPopulateDateObject) {
      return autoPopulateDateObject.value;
    }
  }
  return null;
};

let autoPopulateTimeout: NodeJS.Timeout | null = null;
let autoPopulateInterval: NodeJS.Timeout | null = null;

const startAutoPopulateAsync = async () => {
  const autoPopulateDate = await getAutoPopulateDate();

  autoPopulateTimeout = setTimeout(
    () =>
      (async () => {
        try {
          console.log('auto populating data...');
          autoPopulateTimeout = null;
          const result = await populateWithData(50, 3, 5, 3);
          console.log(
            'finished auto populating data: ' + (result ? 'success' : 'error')
          );
          await setAutoPopulateDate();
          autoPopulateInterval = setInterval(
            () =>
              (async () => {
                try {
                  console.log('auto populating data...');
                  autoPopulateInterval = null;
                  const result = await populateWithData(50, 3, 5, 3);
                  console.log(
                    'finished auto populating data: ' +
                      (result ? 'success' : 'error')
                  );
                  await setAutoPopulateDate();
                } catch (err) {
                  console.error(
                    typeof err === 'object' && err instanceof Error
                      ? err.stack ?? err
                      : err
                  );
                  process.exitCode = 1;
                }
              })(),
            AUTO_POPULATE_INTERVAL
          );
        } catch (err) {
          console.error(
            typeof err === 'object' && err instanceof Error
              ? err.stack ?? err
              : err
          );
          process.exitCode = 1;
        }
      })(),
    autoPopulateDate
      ? Date.now() - autoPopulateDate.getTime() < AUTO_POPULATE_INTERVAL
        ? AUTO_POPULATE_INTERVAL - (Date.now() - autoPopulateDate.getTime())
        : undefined
      : undefined
  );
};

export const startAutoPopulate = async () => {
  try {
    const doAutoPopulate = await getAutoPopulateInternal();

    if (doAutoPopulate) {
      await startAutoPopulateAsync();
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const locationDataFile = readFileSync(__dirname + '/locations.json', 'utf-8');

let locationDataJSON: typeof locationDataType | null = null;

if (locationDataFile) {
  locationDataJSON = JSON.parse(locationDataFile) as typeof locationDataType;
}

let locations: string[] = [];
if (locationDataJSON) {
  locations = locationDataJSON.cities;
}

const dishDataFile = readFileSync(__dirname + '/dishes.json', 'utf-8');

let dishDataJSON: typeof dishDataType | null = null;

if (dishDataFile) {
  dishDataJSON = JSON.parse(dishDataFile) as typeof dishDataType;
}

let dishes: string[] = [];
let dishDescriptions: string[] = [];
if (dishDataJSON) {
  dishes = dishDataJSON.dishes;
  dishDescriptions = dishDataJSON.descriptions;
}

const fakeGenerator = fakerator('de-DE');

const generatePerson = async () => {
  const dateOfBirth = fakeGenerator.date.between(
    new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 60),
    new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 18)
  );
  const name = fakeGenerator.names.name();
  const street = fakeGenerator.address.street();
  const password = makeId(fakeGenerator.random.number(10, 20));
  const email =
    name
      .replace(/\. /g, '.')
      .replace(/ /g, '.')
      .replace(/[^\S.]+/g, '') +
    '@' +
    (mailAddress?.replace(/^[^@]+@/, '') ?? 'example.com');
  let city = locations.length
    ? locations[fakeGenerator.random.number(0, locations.length)]
    : '';
  let postalCode = '';

  if (city) {
    const cityPage = await getWikiPage(city);
    if (cityPage) {
      const cityCoordinates = await getCoords(city);
      if (cityCoordinates) {
        const postalCodesString = await cityPage.info('postalCode');
        if (postalCodesString) {
          const postalCodeFound = postalCodesString
            .toString()
            .match(/^\d+-\d+$/)
            ? postalCodesString.toString().replace(/-\d+$/, '')
            : postalCodesString.toString().match(/^\d+$/)
            ? postalCodesString.toString()
            : '';
          postalCode = postalCodeFound;
        } else {
          city = '';
        }
      } else {
        city = '';
      }
    } else {
      city = '';
    }
  }

  if (!city) {
    city = 'Zug';
    if (!postalCode) {
      postalCode = '6300';
    }
  } else if (!postalCode) {
    postalCode = fakeGenerator.address.postCode();
  }

  const address = street + ', ' + city + ' ' + postalCode;

  return { name, dateOfBirth, password, city, email, address };
};

const generateDishName = async () => {
  let dish = dishes.length
    ? dishes[fakeGenerator.random.number(0, dishes.length)]
    : '';

  if (dish) {
    const dishPage = await getWikiPage(dish);
    if (!dishPage) {
      dish = '';
    }
  }

  if (!dish) {
    dish = 'Pizza';
  }

  return dish;
};

const generateBoolean = () => {
  return fakeGenerator.random.boolean();
};

const generateDish = async () => {
  const date = fakeGenerator.date.between(
    new Date(),
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 5)
  );
  const slots = fakeGenerator.random.number(1, 4);
  const dish = await generateDishName();
  let description = dishDescriptions.length
    ? dishDescriptions[fakeGenerator.random.number(0, dishDescriptions.length)]
    : '';

  if (!description) {
    description = 'Come eat with me';
  }

  return { date, slots, dish, description };
};

const shuffleArray = <T>(array: T[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
};

export const deletePopulatedData = async () => {
  await deletePopulatedUsers();
  await removePopulatedDishPreferences();
  await removePopulatedDishes();
  await removePopulatedDishEvents();

  return true;
};

export const populateWithData = async (
  users: number,
  preferencesPerUser: number,
  dishesPerUser: number,
  dishEventsPerUser: number
) => {
  const usersList: string[] = [];
  const usersDishes: {
    dish: string;
    slots: number;
    filled: number;
    user: string;
  }[] = [];
  const results = await Promise.all(
    new Array(users).fill(undefined).map(async () => {
      const person = await generatePerson();
      const result = await registerOrEmailLoginInternal(
        person.email,
        false,
        true,
        true
      );
      if (!result.success || !result.userId || !result.passwordNew) {
        return false;
      }
      const userId = result.userId;
      usersList.push(userId);
      const verifyResult = await verifyUserEmail(userId, result.passwordNew);
      if (!verifyResult.success || !verifyResult.resetCode) {
        return false;
      }
      const setInfoResult = await setUserInfoInternal(
        userId,
        verifyResult.resetCode,
        person.password,
        person.name,
        person.dateOfBirth,
        person.city,
        person.address
      );
      if (!setInfoResult.success) {
        return false;
      }
      const preferencesResults = await Promise.all(
        new Array(preferencesPerUser).fill(undefined).map(async (_, index) => {
          const dish = await generateDishName();
          return await addDishPreference(
            dish,
            userId,
            generateBoolean(),
            index === 0,
            true
          );
        })
      );
      if (preferencesResults.some((item) => !item)) {
        return false;
      }
      const dishesResults = await Promise.all(
        new Array(dishesPerUser).fill(undefined).map(async () => {
          const dish = await generateDish();
          const dishResult = await addDish(
            dish.dish,
            userId,
            dish.slots,
            dish.date,
            person.city,
            person.address,
            dish.description,
            true
          );
          if (dishResult) {
            usersDishes.push({
              dish: dishResult,
              slots: dish.slots,
              filled: 0,
              user: userId,
            });
            return true;
          }
          return false;
        })
      );
      if (dishesResults.some((item) => !item)) {
        return false;
      }
      return true;
    })
  );
  if (results.some((item) => !item)) {
    return false;
  }
  let userIndex = 0;
  let runs = 1;
  const dishEventsStructure: {
    dish: string;
    dishUser: string;
    user: string;
  }[][] = [];
  shuffleArray(usersList);
  shuffleArray(usersDishes);
  if (usersList.length && dishEventsPerUser) {
    for (const dish of usersDishes) {
      const potentialJoinAmount = dish.slots - dish.filled;
      for (let i = 0; i < potentialJoinAmount; i++) {
        const object = {
          dish: dish.dish,
          dishUser: dish.user,
          user: usersList[userIndex],
        };
        userIndex++;
        if (userIndex >= usersList.length) {
          userIndex = 0;
          runs++;
          if (runs > dishEventsPerUser) {
            break;
          }
        }
        if (dishEventsStructure[i]) {
          dishEventsStructure[i].push(object);
        } else {
          dishEventsStructure[i] = [object];
        }
      }
      if (runs > dishEventsPerUser) {
        break;
      }
    }
  }
  const dishEventsList = dishEventsStructure.flat();
  const dishEventsResults = await Promise.all(
    dishEventsList.map(async (dishEvent) => {
      const dishEventResult = await addDishEventInternal(
        dishEvent.dish,
        dishEvent.user,
        undefined,
        true
      );
      if (!dishEventResult.success || !dishEventResult.customId) {
        return false;
      }
      const accept = generateBoolean();
      if (accept) {
        const acceptDishEventResult = await acceptDishEventInternal(
          dishEventResult.customId,
          dishEvent.dishUser
        );
        if (acceptDishEventResult.success) {
          return true;
        }
      } else {
        return true;
      }
      return false;
    })
  );
  if (dishEventsResults.some((item) => !item)) {
    return false;
  }
  return true;
};
