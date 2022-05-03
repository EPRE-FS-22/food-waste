import { WithId } from 'mongodb';
import wiki, { Page } from 'wikijs';
import {
  getDishPreferencesCollection,
  getDishesCollection,
  getDishEventsCollection,
} from './data.js';
import { makeId } from './id.js';
import type {
  DBDish,
  DBDishEvent,
  DBDishPreference,
  Dish,
  DishEvent,
  DishInfo,
  DishPreference,
} from './model';
import { getUserName } from './users.js';
import ContentBasedRecommender from 'content-based-recommender';

const recommender = new ContentBasedRecommender({
  minScore: 0.1,
  maxSimilarDocuments: 100,
});

const stripDishDBValues = (dish: WithId<DBDish>): Dish => {
  return {
    customId: dish.customId,
    name: dish.name,
    date: dish.date,
    slots: dish.slots,
    filled: dish.filled,
    dish: dish.dish,
  };
};

const stripDishesDBValues = (dishes: WithId<DBDish>[]): Dish[] => {
  return dishes.map((d) => stripDishDBValues(d));
};

const combineDishInfoDBValues = (
  dish: WithId<DBDish>,
  dishEvents: WithId<DBDishEvent>[]
): DishInfo => {
  return {
    customId: dish.customId,
    name: dish.name,
    date: dish.date,
    slots: dish.slots,
    filled: dish.filled,
    dish: dish.dish,
    participantNames: dishEvents
      .filter((d) => d.accepted)
      .map((e) => e.participantName),
    participantMessages: dishEvents
      .filter((d) => d.accepted)
      .map((e) => e.message),
    responses: dishEvents.filter((d) => d.accepted).map((e) => e.response),
    participantRequestsNames: dishEvents
      .filter((d) => !d.accepted)
      .map((e) => e.participantName),
    participantRequestsMessages: dishEvents
      .filter((d) => !d.accepted)
      .map((e) => e.message),
    eventIds: dishEvents.filter((d) => d.accepted).map((e) => e.customId),
    eventRequestsIds: dishEvents
      .filter((d) => !d.accepted)
      .map((e) => e.customId),
    createdDate: dish.createdDate,
    lastAcceptedDate: dish.lastAcceptedDate,
  };
};

const combineDishesInfosDBValues = (
  dishGroups: { dish: WithId<DBDish>; dishEvents: WithId<DBDishEvent>[] }[]
): DishInfo[] => {
  return dishGroups.map((d) => combineDishInfoDBValues(d.dish, d.dishEvents));
};

const combineDishEventDBValues = (
  dishEvent: WithId<DBDishEvent>,
  dish: WithId<DBDish>
): DishEvent => {
  return {
    customId: dish.customId,
    name: dish.name,
    date: dish.date,
    slots: dish.slots,
    filled: dish.filled,
    dish: dish.dish,
    participantName: dishEvent.participantName,
    accepted: dishEvent.accepted,
    message: dishEvent.message,
    response: dishEvent.response,
    signupDate: dishEvent.signupDate,
    acceptedDate: dishEvent.acceptedDate,
  };
};

const combineDishesEventsDBValues = (
  dishGroups: { dishEvent: WithId<DBDishEvent>; dish: WithId<DBDish> }[]
): DishEvent[] => {
  return dishGroups.map((d) => combineDishEventDBValues(d.dishEvent, d.dish));
};

const stripDishPreferenceDBValues = (
  dishPreference: WithId<DBDishPreference>
): DishPreference => {
  return { dish: dishPreference.dish, likes: dishPreference.likes };
};

const stripDishPreferencesDBValues = (
  dishPreferences: WithId<DBDishPreference>[]
): DishPreference[] => {
  return dishPreferences.map((d) => stripDishPreferenceDBValues(d));
};

export const getAvailableDishes = async (
  userId?: string,
  start = 0,
  limit = 6
) => {
  const dishesCollection = await getDishesCollection();

  return stripDishesDBValues(
    await dishesCollection
      .find({
        $and: [
          { date: { $gte: new Date() } },
          userId ? { userId: { $ne: userId } } : {},
        ],
        $expr: { $ne: ['$slots', '$filled'] },
      })
      .sort({ _id: 1 })
      .skip(start)
      .limit(limit)
      .toArray()
  );
};

const getSimilarDishes = (
  dish: string,
  availableDishes: WithId<DBDish>[],
  number: number
): WithId<DBDish>[] => {
  let index = 0;
  const similarDishes: { id: string }[] = [];
  let currentSimilarDishes: { id: string }[] = [];
  do {
    currentSimilarDishes = recommender
      .getSimilarDocuments(dish, index, number)
      .filter((item: { id: string }) =>
        availableDishes.find((searchItem) => searchItem.dish === item.id)
      );
    index += number;
    similarDishes.push(...currentSimilarDishes);
  } while (similarDishes.length < number && currentSimilarDishes.length > 0);
  return similarDishes.reduce(
    (list: WithId<DBDish>[], currentItem) => [
      ...list,
      ...availableDishes.filter((dish) => dish.dish === currentItem.id),
    ],
    []
  );
};

export const getRecommendedDishes = async (
  userId: string,
  previousIds?: string[],
  limit = 6
) => {
  const dishesCollection = await getDishesCollection();

  const dishes = await dishesCollection
    .find({
      customId: { $not: { $in: previousIds } },
      date: { $gte: new Date() },
      userId,
      $expr: { $ne: ['$slots', '$filled'] },
    })
    .toArray();

  if (dishes.length <= limit) {
    return stripDishesDBValues([...dishes].reverse());
  }

  const dishPreferencesCollection = await getDishPreferencesCollection();

  const preferences = await dishPreferencesCollection
    .find({
      userId,
    })
    .toArray();

  if (!preferences.length) {
    return stripDishesDBValues([...dishes].reverse().slice(limit));
  }

  const likes = preferences
    .filter((preference) => preference.likes)
    .map((preference) => getSimilarDishes(preference.dish, dishes, 10));

  const dislikes = preferences
    .filter((preference) => preference.likes)
    .map((preference) => getSimilarDishes(preference.dish, dishes, 10))
    .flat();

  const previousDislikes: WithId<DBDish>[] = [];

  const output: WithId<DBDish>[] = [];

  for (const like of likes) {
    for (const item of like) {
      if (
        dislikes.some((searchItem) => searchItem.customId === item.customId)
      ) {
        previousDislikes.push(item);
      } else {
        output.push(item);
      }
      if (output.length >= limit) {
        break;
      }
    }
    if (output.length >= limit) {
      break;
    }
  }

  if (output.length < limit) {
    for (const item of previousDislikes) {
      output.push(item);
      if (output.length >= limit) {
        break;
      }
    }
  }

  if (output.length < limit) {
    for (const item of dishes.sort((a, b) => {
      return b.date.getTime() - a.date.getTime();
    })) {
      if (!output.some((outputItem) => outputItem.customId === item.customId)) {
        output.push(item);
        if (output.length >= limit) {
          break;
        }
      }
    }
  }

  return stripDishesDBValues(output);
};

export const getDishPreferences = async (userId: string) => {
  const dishPreferencesCollection = await getDishPreferencesCollection();

  return stripDishPreferencesDBValues(
    await dishPreferencesCollection
      .find({
        userId: userId,
      })
      .toArray()
  );
};

export const getMyDishes = async (userId: string) => {
  const dishesCollection = await getDishesCollection();
  const dishEventsCollection = await getDishEventsCollection();

  const dishes = await dishesCollection
    .find({
      userId,
    })
    .toArray();

  return combineDishesInfosDBValues(
    await Promise.all(
      dishes.map(async (item) => ({
        dish: item,
        dishEvents: await dishEventsCollection
          .find({
            dishId: item.customId,
          })
          .toArray(),
      }))
    )
  );
};

export const getSignedUpDishes = async (userId: string) => {
  const dishesCollection = await getDishesCollection();
  const dishEventsCollection = await getDishEventsCollection();

  const dishEvents = await dishEventsCollection
    .find({
      participantId: userId,
    })
    .toArray();

  return combineDishesEventsDBValues(
    (
      await Promise.all(
        dishEvents.map(async (item) => {
          const dish = await dishesCollection.findOne({
            customId: item.dishId,
          });
          if (dish) {
            return { dishEvent: item, dish };
          }
          return null;
        })
      )
    ).filter((group) => group !== null) as {
      dishEvent: WithId<DBDishEvent>;
      dish: WithId<DBDish>;
    }[]
  );
};

export const getDish = async (customId: string, userId?: string) => {
  const dishesCollection = await getDishesCollection();

  const dish = await dishesCollection.findOne({
    customId,
    $or: [{ date: { $gte: new Date() } }, userId ? { userId } : {}],
  });

  if (dish) {
    return stripDishDBValues(dish);
  }

  return false;
};

const getDishDescription = async (dish: string) => {
  const page = (await wiki().find(dish)) as Page | undefined;

  return (await page?.summary()) ?? '';
};

export const addDishPreference = async (
  dish: string,
  userId: string,
  likes: boolean
) => {
  const description = await getDishDescription(dish);

  if (description) {
    const dishPreferencesCollection = await getDishPreferencesCollection();

    console.log(description);

    await dishPreferencesCollection.insertOne({
      dish: dish,
      likes,
      description,
      userId: userId,
      setDate: new Date(),
    });

    return true;
  }
  return false;
};

export const addDish = async (
  dish: string,
  userId: string,
  slots: number,
  date: Date
) => {
  const description = await getDishDescription(dish);

  if (description) {
    const dishesCollection = await getDishesCollection();

    console.log(description);

    const id = makeId(20);

    const name = await getUserName(userId);

    await dishesCollection.insertOne({
      customId: id,
      dish: dish,
      description,
      userId,
      name,
      slots,
      filled: 0,
      date: date,
      createdDate: new Date(),
    });

    return id;
  }
  return false;
};

export const addDishEvent = async (
  customId: string,
  userId: string,
  message?: string
) => {
  const dishesCollection = await getDishesCollection();

  const dish = await dishesCollection.findOne({
    customId,
    $or: [{ date: { $gte: new Date() } }],
    $expr: { $ne: ['$slots', '$filled'] },
  });

  if (dish) {
    const dishEventsCollection = await getDishEventsCollection();

    const participantName = await getUserName(userId);

    const id = makeId(20);

    await dishEventsCollection.insertOne({
      dish: dish.dish,
      dishId: dish.customId,
      description: dish.description,
      customId: id,
      participantId: userId,
      accepted: false,
      participantName,
      message,
      signupDate: new Date(),
    });

    return true;
  }
  return false;
};

export const acceptDishEvent = async (
  customId: string,
  userId: string,
  response?: string
) => {
  const dishEventsCollection = await getDishEventsCollection();

  const dishEvent = await dishEventsCollection.findOne({
    customId,
  });

  if (dishEvent) {
    const dishesCollection = await getDishesCollection();

    const dish = await dishesCollection.findOne({
      customId: dishEvent.dishId,
      userId,
      $expr: { $ne: ['$slots', '$filled'] },
    });

    if (dish) {
      await dishEventsCollection.updateOne(
        {
          customId,
        },
        {
          $set: {
            accepted: true,
            response,
          },
          $currentDate: { acceptedDate: true },
        }
      );

      await dishesCollection.updateOne(
        {
          customId,
        },
        {
          $inc: {
            filled: 1,
          },
          $currentDate: { lastAcceptedDate: true },
        }
      );

      return true;
    }
  }
  return false;
};

export const train = async () => {
  const dishesCollection = await getDishesCollection();

  const dishes = await dishesCollection
    .find({
      date: { $gte: new Date() },
      $expr: { $ne: ['$slots', '$filled'] },
    })
    .toArray();

  const dishPreferencesCollection = await getDishPreferencesCollection();

  const preferences = await dishPreferencesCollection.find({}).toArray();

  const allDishes = [...dishes, ...preferences];

  const documents = allDishes
    .map((dish, index) => {
      if (allDishes.findIndex((item) => item.dish === dish.dish) === index) {
        return { id: dish.dish, content: dish.description };
      }
      return null;
    })
    .filter((item) => item);

  await recommender.train(documents);
};
