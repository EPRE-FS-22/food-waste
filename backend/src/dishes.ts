import { WithId } from 'mongodb';
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
import {
  getUserInfo,
  getUserName,
  sendUserMail,
  userPreferencesSet,
} from './users.js';
import ContentBasedRecommender from 'content-based-recommender';
import { generateFrontendLink } from './index.js';
import {
  APP_NAME,
  DEFAULT_SEARCH_AGE_RANGE,
  DEFAULT_SEARCH_LOCATION_RANGE,
} from './constants.js';
import moment from 'moment';
import { getCoords } from './geo.js';
import { getWikiPageSummary } from './wiki.js';

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
    dishDescription: dish.dishDescription,
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
    dishDescription: dish.dishDescription,
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
    customId: dishEvent.customId,
    dishId: dish.customId,
    name: dish.name,
    date: dish.date,
    slots: dish.slots,
    filled: dish.filled,
    dish: dish.dish,
    dishDescription: dish.dishDescription,
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
  limit = 6,
  locationCity?: string,
  dateStart?: Date,
  dateEnd?: Date,
  locationRangeSize?: number,
  ageRangeSize?: number
) => {
  let locationCityCoords: [number, number] | undefined = undefined;
  let agePreference: number | undefined = undefined;
  if (locationCity) {
    locationCityCoords = (await getCoords(locationCity)) ?? undefined;
  }
  if (userId) {
    const userInfo = await getUserInfo(userId);
    if (userInfo && !locationCityCoords) {
      locationCityCoords = userInfo.locationCityCoords;
      agePreference = Math.floor(
        ((userInfo.dateOfBirth ? userInfo.dateOfBirth.getTime() : 0) +
          (dateStart ? dateStart.getTime() - Date.now() : 0)) /
          (1000 * 60 * 60 * 24 * 365)
      );
    }
  }

  const dishesCollection = await getDishesCollection();

  return stripDishesDBValues(
    await dishesCollection
      .find({
        $and: [
          dateStart
            ? { date: { $gte: dateStart } }
            : { date: { $gte: new Date() } },
          userId ? { userId: { $ne: userId } } : {},
          dateEnd ? { date: { $lte: dateEnd } } : {},
          agePreference
            ? {
                age: {
                  $gte:
                    agePreference - (ageRangeSize ?? DEFAULT_SEARCH_AGE_RANGE),
                  $lte:
                    agePreference + (ageRangeSize ?? DEFAULT_SEARCH_AGE_RANGE),
                },
              }
            : {},
          locationCityCoords
            ? {
                locationCityCoords: {
                  $near: {
                    $geometry: {
                      type: 'Point',
                      coordinates: locationCityCoords,
                    },
                    $maxDistance:
                      locationRangeSize ?? DEFAULT_SEARCH_LOCATION_RANGE,
                  },
                },
              }
            : {},
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
  limit = 6,
  locationCity?: string,
  dateStart?: Date,
  dateEnd?: Date,
  locationRangeSize?: number,
  ageRangeSize?: number
) => {
  let locationCityCoords: [number, number] | undefined = undefined;
  let agePreference: number | undefined = undefined;
  if (locationCity) {
    locationCityCoords = (await getCoords(locationCity)) ?? undefined;
  }
  if (userId) {
    const userInfo = await getUserInfo(userId);
    if (userInfo && !locationCityCoords) {
      locationCityCoords = userInfo.locationCityCoords;
      agePreference = Math.floor(
        ((userInfo.dateOfBirth ? userInfo.dateOfBirth.getTime() : 0) +
          (dateStart ? dateStart.getTime() - Date.now() : 0)) /
          (1000 * 60 * 60 * 24 * 365)
      );
    }
  }

  const dishesCollection = await getDishesCollection();

  const dishes = await dishesCollection
    .find({
      $and: [
        { customId: { $not: { $in: previousIds } } },
        dateStart
          ? { date: { $gte: dateStart } }
          : { date: { $gte: new Date() } },
        userId ? { userId: { $ne: userId } } : {},
        dateEnd ? { date: { $lte: dateEnd } } : {},
        agePreference
          ? {
              age: {
                $gte:
                  agePreference - (ageRangeSize ?? DEFAULT_SEARCH_AGE_RANGE),
                $lte:
                  agePreference + (ageRangeSize ?? DEFAULT_SEARCH_AGE_RANGE),
              },
            }
          : {},
        locationCityCoords
          ? {
              locationCityCoords: {
                $near: {
                  $geometry: {
                    type: 'Point',
                    coordinates: locationCityCoords,
                  },
                  $maxDistance:
                    locationRangeSize ?? DEFAULT_SEARCH_LOCATION_RANGE,
                },
              },
            }
          : {},
      ],
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
      date: { $gte: new Date() },
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
      date: { $gte: new Date() },
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

export const getAvailableDish = async (customId: string, userId?: string) => {
  const dishesCollection = await getDishesCollection();

  const dish = await dishesCollection.findOne({
    customId,
    $or: [
      { date: { $gte: new Date() } },
      userId ? { userID: { $ne: userId } } : {},
    ],
  });

  if (dish) {
    return stripDishDBValues(dish);
  }

  return false;
};

export const getMyDish = async (customId: string, userId: string) => {
  const dishesCollection = await getDishesCollection();
  const dishEventsCollection = await getDishEventsCollection();

  const dish = await dishesCollection.findOne({
    customId,
    userId,
  });

  if (!dish) {
    return false;
  }

  const dishEvents = await dishEventsCollection
    .find({
      dishId: dish.customId,
    })
    .toArray();

  return combineDishInfoDBValues(dish, dishEvents);
};

export const getSignedUpDish = async (customId: string, userId: string) => {
  const dishesCollection = await getDishesCollection();
  const dishEventsCollection = await getDishEventsCollection();

  const dishEvent = await dishEventsCollection.findOne({
    customId,
    userId,
    date: { $gte: new Date() },
  });

  if (!dishEvent) {
    return false;
  }

  const dish = await dishesCollection.findOne({
    customId: dishEvent.dishId,
  });

  if (!dish) {
    return false;
  }

  return combineDishEventDBValues(dishEvent, dish);
};

export const addDishPreference = async (
  dish: string,
  userId: string,
  likes: boolean,
  isFirst: boolean
) => {
  const description = await getWikiPageSummary(dish);

  if (description) {
    const dishPreferencesCollection = await getDishPreferencesCollection();

    const previous = await dishPreferencesCollection.findOne({
      dish,
      userId,
    });

    if (!previous) {
      let success = true;
      if (isFirst) {
        success = await userPreferencesSet(userId);
      }
      if (success) {
        return (
          await dishPreferencesCollection.insertOne({
            dish: dish,
            likes,
            description,
            userId,
            setDate: new Date(),
          })
        ).acknowledged;
      }
    }
  }
  return false;
};

export const removeDishPreference = async (dish: string, userId: string) => {
  const dishPreferencesCollection = await getDishPreferencesCollection();

  const found = await dishPreferencesCollection
    .find({
      userId: userId,
    })
    .toArray();

  if (found.length < 2) {
    return false;
  }

  const result = await dishPreferencesCollection.deleteOne({
    dish: dish,
    userId: userId,
  });

  return result.deletedCount > 0;
};

export const addDish = async (
  dish: string,
  userId: string,
  slots: number,
  date: Date,
  locationCity?: string,
  exactLocation?: string,
  dishDescription?: string
) => {
  const description = await getWikiPageSummary(dish);

  if (description) {
    const dishesCollection = await getDishesCollection();

    const id = makeId(20);

    const userInfo = await getUserInfo(userId);

    const locationCityCoords = locationCity
      ? await getCoords(locationCity)
      : null;

    if (userInfo) {
      await dishesCollection.insertOne({
        customId: id,
        dish,
        dishDescription,
        description,
        userId,
        name: userInfo.name,
        slots,
        filled: 0,
        date: date,
        createdDate: new Date(),
        age: Math.floor(
          ((userInfo.dateOfBirth ? userInfo.dateOfBirth.getTime() : 0) +
            (date.getTime() - Date.now())) /
            (1000 * 60 * 60 * 24 * 365)
        ),
        locationCity: locationCityCoords
          ? locationCity ?? userInfo.locationCity
          : undefined,
        locationCityCoords: locationCityCoords ?? userInfo.locationCityCoords,
        exactLocation: exactLocation ?? userInfo.exactLocation,
      });

      return id;
    }
  }
  return false;
};

export const removeDish = async (customId: string, userId?: string) => {
  const dishesCollection = await getDishesCollection();

  const dish = await dishesCollection.findOne({
    customId,
    userId,
  });

  if (dish) {
    const result = await dishesCollection.deleteOne({
      customId,
      userId,
    });

    if (result.deletedCount > 0) {
      const dishEventsCollection = await getDishEventsCollection();

      const dishEvents = await dishEventsCollection
        .find({ dishId: customId })
        .toArray();

      await Promise.all(
        dishEvents.map(async (dishEvent) => {
          const body = userId
            ? `Hello ${dishEvent.participantName}

Thank your for using the ${APP_NAME} App.

Unfortunately the plan for eating ${dish.dish} on ${moment(
                dish.date
              ).calendar()} has been cancelled by the host.

Use the site to search for alternatives: ${generateFrontendLink('/user')}`
            : `Hello ${dishEvent.participantName}

Thank your for using the ${APP_NAME} App.

Unfortunately the plan for eating ${dish.dish} on ${moment(
                dish.date
              ).calendar()} has been cancelled by an admin.

Use the site to search for alternatives: ${generateFrontendLink('/user')}`;
          await sendUserMail(
            dishEvent.participantId,
            APP_NAME +
              (userId ? ' plan cancelled' : ' plan cancelled by admin'),
            body
          );
        })
      );

      if (!userId) {
        const body = `Hello ${dish.name}

Thank your for using the ${APP_NAME} App.

Unfortunately your plan for eating ${dish.dish} on ${moment(
          dish.date
        ).calendar()} has been cancelled by an admin.

If you do not agree with this decision use the contact option on our site: ${generateFrontendLink(
          '/user'
        )}`;
        await sendUserMail(
          dish.userId,
          APP_NAME + ' plan cancelled by admin',
          body
        );
      }

      return (
        (
          await dishEventsCollection.deleteMany({
            dishId: customId,
          })
        ).deletedCount > 0
      );
    }
  }

  return false;
};

export const addDishEventInternal = async (
  customId: string,
  userId: string,
  message?: string
) => {
  const dishesCollection = await getDishesCollection();

  const dish = await dishesCollection.findOne({
    customId,
    date: { $gte: new Date() },
    $expr: { $ne: ['$slots', '$filled'] },
  });

  if (dish) {
    const dishEventsCollection = await getDishEventsCollection();

    const participantName = await getUserName(userId);

    const id = makeId(20);

    const result = await dishEventsCollection.insertOne({
      dish: dish.dish,
      date: dish.date,
      dishId: dish.customId,
      description: dish.description,
      customId: id,
      participantId: userId,
      accepted: false,
      participantName,
      message,
      signupDate: new Date(),
    });

    if (result.acknowledged) {
      return {
        success: true,
        dish: dish.dish,
        dishName: dish.name,
        dishDate: dish.date,
        participantName,
        customId: id,
      };
    }
  }
  return { success: false };
};

export const addDishEvent = async (
  customId: string,
  userId: string,
  message?: string
) => {
  const result = await addDishEventInternal(customId, userId, message);

  if (
    result &&
    result.dish &&
    result.dishName &&
    result.dishDate &&
    result.participantName
  ) {
    const body = `Congratulations ${result.dishName}

Your plan on ${APP_NAME} for eating ${result.dish} on ${moment(
      result.dishDate
    ).calendar()} has received a new guest request from ${
      result.participantName
    }.

Use the site to accept it: ${generateFrontendLink('/plans')}`;
    await sendUserMail(userId, APP_NAME + ' new guest request', body);

    return true;
  }
  return false;
};

export const removeDishEvent = async (customId: string, userId?: string) => {
  const dishEventsCollection = await getDishEventsCollection();

  const dishEvent = await dishEventsCollection.findOne({
    customId,
    participantId: userId,
  });

  if (
    dishEvent &&
    (
      await dishEventsCollection.deleteOne({
        customId,
        participantId: userId,
      })
    ).deletedCount > 0 &&
    dishEvent.accepted
  ) {
    const dishesCollection = await getDishesCollection();

    const dish = await dishesCollection.findOne({
      customId: dishEvent.dishId,
    });

    if (dish) {
      const result = await dishesCollection.updateOne(
        {
          customId: dishEvent.dishId,
        },
        {
          $dec: {
            filled: 1,
          },
        }
      );

      if (result.modifiedCount > 0) {
        const body = `Hello ${dish.name}

Thank your for using the ${APP_NAME} App.

Unfortunately your guest ${dishEvent.participantName} for eating ${
          dish.dish
        } on ${moment(dish.date).calendar()} has cancelled.

Use the site to see and accept other requests: ${generateFrontendLink(
          '/plans'
        )}`;
        await sendUserMail(dish.userId, APP_NAME + ' guest cancelled', body);

        return true;
      }
    }
  }

  return false;
};

export const acceptDishEventInternal = async (
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

    if (
      dish &&
      (
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
        )
      ).modifiedCount > 0
    ) {
      if (
        (
          await dishesCollection.updateOne(
            {
              customId: dishEvent.dishId,
            },
            {
              $inc: {
                filled: 1,
              },
              $currentDate: { lastAcceptedDate: true },
            }
          )
        ).modifiedCount > 0
      ) {
        return {
          success: true,
          participantName: dishEvent.participantName,
          dish: dish.dish,
          dishDate: dish.date,
          dishName: dish.name,
          participantId: dishEvent.participantId,
        };
      }
    }
  }
  return { success: false };
};

export const acceptDishEvent = async (
  customId: string,
  userId: string,
  response?: string
) => {
  const result = await acceptDishEventInternal(customId, userId, response);

  if (
    result.success &&
    result.participantName &&
    result.dish &&
    result.dishDate &&
    result.dishName &&
    result.participantId
  ) {
    const body = `Congratulations ${result.participantName}

Your request on ${APP_NAME} for eating ${result.dish} on ${moment(
      result.dishDate
    ).calendar()} with ${result.dishName} has been accepted.

Use the site to see more details: ${generateFrontendLink('/plans')}`;
    await sendUserMail(
      result.participantId,
      APP_NAME + ' request accepted',
      body
    );

    return true;
  }
  return false;
};

export const unacceptDishEvent = async (customId: string, userId: string) => {
  const dishEventsCollection = await getDishEventsCollection();

  const dishEvent = await dishEventsCollection.findOne({
    customId,
  });

  if (dishEvent) {
    const dishesCollection = await getDishesCollection();

    const dish = await dishesCollection.findOne({
      customId: dishEvent.dishId,
    });

    if (
      dish &&
      (
        await dishesCollection.updateOne(
          {
            customId,
            userId,
          },
          {
            $dec: {
              filled: 1,
            },
          }
        )
      ).modifiedCount > 0
    ) {
      const result = await dishEventsCollection.updateOne(
        {
          customId,
        },
        {
          $set: {
            accepted: false,
          },
          $unset: {
            acceptedDate: true,
          },
        }
      );

      if (result.modifiedCount > 0) {
        const body = `Hello ${dish.name}

Thank your for using the ${APP_NAME} App.

Unfortunately your host ${dish.name} for eating ${dish.dish} on ${moment(
          dish.date
        ).calendar()} has cancelled your invite.

Use the site to search for alternatives: ${generateFrontendLink('/user')}`;
        await sendUserMail(
          dishEvent.participantId,
          APP_NAME + ' invite cancelled',
          body
        );

        return true;
      }
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
