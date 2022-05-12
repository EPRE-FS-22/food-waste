import fakerator from 'fakerator';
import type locationDataType from './locations.json';
import type dishDataType from './dishes.json';
import { readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { getWikiPage } from './wiki.js';
import {
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
} from './dishes.js';
import { getCoords } from './geo.js';

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
      .replace(/\. /, '.')
      .replace(/ /, '.')
      .replace(/[^\S.]+/g, '') +
    '@' +
    (mailAddress?.replace(/@[^@]+$/, '') ?? 'example.com');
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
        new Array(preferencesPerUser)
          .fill(undefined)
          .map(async (item, index) => {
            const dish = await generateDishName();
            return await addDishPreference(
              dish,
              userId,
              generateBoolean(),
              index === 0
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
            dish.description
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
        dishEvent.user
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
