import { Collection, Db, MongoClient } from 'mongodb';
import { makeId } from './id.js';
import type {
  DBDish,
  DBDishEvent,
  DBDishPreference,
  DBUser,
  Setting,
  StringSetting,
} from './model';
import { hashPassword } from './users.js';
import 'dotenv/config';

const rawHost = process.env.FOOD_WASTE_DATABASE_HOST;
const host = rawHost ? encodeURIComponent(rawHost) : 'localhost';
const rawPort = process.env.FOOD_WASTE_DATABASE_PORT;
const port = rawPort ? encodeURIComponent(rawPort) : '27017';
const rawUser = process.env.FOOD_WASTE_DATABASE_USER;
const user = rawUser ? encodeURIComponent(rawUser) : '';
const rawPassword = process.env.FOOD_WASTE_DATABASE_PASSWORD;
const password = rawPassword ? encodeURIComponent(rawPassword) : '';
const authMechanism = user && password ? 'DEFAULT' : '';

// Connection URL
const url =
  authMechanism === 'DEFAULT'
    ? 'mongodb://' +
      user +
      ':' +
      password +
      '@' +
      host +
      ':' +
      port +
      '?authMechanism=' +
      authMechanism
    : 'mongodb://' + host + ':' + port;
const client = new MongoClient(url);

// Database Name
const dbName = 'foodWaste';

const dishesCollectionName = 'dishes';
const dishEventsCollectionName = 'dishEvents';
const dishPreferencesCollectionName = 'dishPreferences';
const settingsCollectionName = 'settings';
const usersCollectionName = 'users';

let connected = false;
let connecting = false;
let closing = false;
let closed = true;
let closingForGood = false;
let closedForGood = false;
const connectingWaitPromises: ((cancel?: boolean) => void)[] = [];
const closingWaitPromises: (() => void)[] = [];

let db: Db | undefined = undefined;
let dishesCollection: Collection<DBDish> | undefined = undefined;
let dishEventsCollection: Collection<DBDishEvent> | undefined = undefined;
let dishPreferencesCollection: Collection<DBDishPreference> | undefined =
  undefined;
let settingsCollection: Collection<Setting> | undefined = undefined;
let usersCollection: Collection<DBUser> | undefined = undefined;

const ensureDBConnection = () => {
  if (connected) {
    return Promise.resolve();
  }
  if (connecting) {
    if (closingForGood || closedForGood) {
      throw new Error('Connection closed for good');
    }
    const promise = new Promise<void>((resolve, reject) => {
      connectingWaitPromises.push((cancel = false) => {
        if (cancel) {
          reject(new Error('Connection closed for good'));
        }
        resolve();
      });
    });
    return promise;
  }
  return new Promise<void>((resolve) => {
    (async () => {
      try {
        if (closing) {
          await ensureNoDBConnection();
        }
        closed = false;
        connecting = true;
        await client.connect();
        console.log('Connected successfully to database server');
        db = client.db(dbName);
        dishesCollection = db.collection(dishesCollectionName);
        dishEventsCollection = db.collection(dishEventsCollectionName);
        dishPreferencesCollection = db.collection(
          dishPreferencesCollectionName
        );
        settingsCollection = db.collection(settingsCollectionName);
        usersCollection = db.collection(usersCollectionName);
        dishesCollection.createIndex({ locationCityCoords: '2dsphere' });

        const passwordObject = (await settingsCollection.findOne({
          key: 'password',
          type: 'string',
        })) as StringSetting | null;
        if (!passwordObject) {
          let password = process.env.FOOD_WASTE_DEFAULT_PASSWORD;
          if (!password) {
            password = makeId(15);
            console.log('Generated password: ' + password);
          }
          const passwordHashed = await hashPassword(password);
          await settingsCollection.insertOne({
            key: 'password',
            value: passwordHashed,
            type: 'string',
          });
        }
        const adminIdObject = (await settingsCollection.findOne({
          key: 'adminId',
          type: 'string',
        })) as StringSetting | null;
        if (!adminIdObject) {
          const adminId = makeId(20);
          await settingsCollection.insertOne({
            key: 'adminId',
            value: adminId,
            type: 'string',
          });
        }
        Promise.resolve().then(() => {
          connectingWaitPromises.forEach((promiseFunc) => promiseFunc());
          connected = true;
          connecting = false;
        });
        resolve();
      } catch (e: unknown) {
        console.error(
          typeof e === 'object' && e instanceof Error ? e.stack ?? e : e
        );
        process.exitCode = 1;
      }
    })();
  });
};

const ensureNoDBConnection = (forGood = false) => {
  if (closed && (!forGood || closedForGood)) {
    return Promise.resolve();
  }
  if (closing) {
    if (forGood && !closingForGood) {
      closingForGood = true;
      connectingWaitPromises.forEach((promiseFunc) => promiseFunc(true));
    }
    const promise = new Promise<void>((resolve) => {
      closingWaitPromises.push(() => resolve());
    });
    return promise;
  }
  return new Promise<void>((resolve) => {
    (async () => {
      try {
        if (connecting) {
          await ensureDBConnection();
        }
        db = undefined;
        connected = false;
        closing = true;
        if (forGood) {
          closingForGood = true;
        }
        await client.close();
        console.log('Successfully closed connection to server');
        Promise.resolve().then(() => {
          closingWaitPromises.forEach((promiseFunc) => promiseFunc());
          closed = true;
          closing = false;
          if (closingForGood) {
            closedForGood = true;
            closingForGood = false;
          }
        });
        resolve();
      } catch (e: unknown) {
        console.error(
          typeof e === 'object' && e instanceof Error ? e.stack ?? e : e
        );
        process.exitCode = 1;
      }
    })();
  });
};

export const getDishesCollection = async () => {
  await ensureDBConnection();
  return dishesCollection as Collection<DBDish>;
};

export const getDishEventsCollection = async () => {
  await ensureDBConnection();
  return dishEventsCollection as Collection<DBDishEvent>;
};

export const getDishPreferencesCollection = async () => {
  await ensureDBConnection();
  return dishPreferencesCollection as Collection<DBDishPreference>;
};

export const getSettingsCollection = async () => {
  await ensureDBConnection();
  return settingsCollection as Collection<Setting>;
};

export const getUsersCollection = async () => {
  await ensureDBConnection();
  return usersCollection as Collection<DBUser>;
};
