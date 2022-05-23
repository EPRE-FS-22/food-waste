import { WithId } from 'mongodb';
import {
  getDishPreferencesCollection,
  getDishesCollection,
  getDishEventsCollection,
  getUsersCollection,
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
import moment from 'moment-timezone';
import { getCoords } from './geo.js';
import { getWikiPageSummary } from './wiki.js';
import { getPicture, getPictures } from './pictures.js';

let recommenderInUse = 0;

const firstRecommender = new ContentBasedRecommender({
  minScore: 0.1,
  maxSimilarDocuments: 100,
});

const secondRecommender = new ContentBasedRecommender({
  minScore: 0.1,
  maxSimilarDocuments: 100,
});

const getRecommender = () =>
  recommenderInUse ? secondRecommender : firstRecommender;

const combineDishDBValues = (dish: WithId<DBDish>, image?: string): Dish => {
  return {
    customId: dish.customId,
    name: dish.name,
    date: dish.date,
    slots: dish.slots,
    filled: dish.filled,
    dish: dish.dish,
    age: dish.age,
    dishDescription: dish.dishDescription,
    locationCity: dish.locationCity,
    image,
  };
};

const combineDishesDBValues = (
  dishes: WithId<DBDish>[],
  images?: string[]
): Dish[] => {
  return dishes.map((d, i) =>
    combineDishDBValues(d, images ? images[i] : undefined)
  );
};

const combineDishInfoDBValues = (
  dish: WithId<DBDish>,
  dishEvents: WithId<DBDishEvent>[],
  image?: string
): DishInfo => {
  return {
    customId: dish.customId,
    name: dish.name,
    date: dish.date,
    slots: dish.slots,
    filled: dish.filled,
    dish: dish.dish,
    age: dish.age,
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
    locationCity: dish.locationCity,
    exactLocation: dish.exactLocation,
    createdDate: dish.createdDate,
    lastAcceptedDate: dish.lastAcceptedDate,
    image,
  };
};

const combineDishesInfosDBValues = (
  dishGroups: {
    dish: WithId<DBDish>;
    dishEvents: WithId<DBDishEvent>[];
    image?: string;
  }[]
): DishInfo[] => {
  return dishGroups.map((d) =>
    combineDishInfoDBValues(d.dish, d.dishEvents, d.image)
  );
};

const combineDishEventDBValues = (
  dishEvent: WithId<DBDishEvent>,
  dish: WithId<DBDish>,
  image?: string
): DishEvent => {
  return {
    customId: dishEvent.customId,
    dishId: dish.customId,
    name: dish.name,
    date: dish.date,
    slots: dish.slots,
    filled: dish.filled,
    dish: dish.dish,
    age: dish.age,
    dishDescription: dish.dishDescription,
    participantName: dishEvent.participantName,
    accepted: dishEvent.accepted,
    message: dishEvent.message,
    response: dishEvent.response,
    locationCity: dish.locationCity,
    exactLocation: dishEvent.accepted ? dish.exactLocation : undefined,
    signupDate: dishEvent.signupDate,
    acceptedDate: dishEvent.acceptedDate,
    image,
  };
};

const combineDishesEventsDBValues = (
  dishGroups: {
    dishEvent: WithId<DBDishEvent>;
    dish: WithId<DBDish>;
    image?: string;
  }[]
): DishEvent[] => {
  return dishGroups.map((d) =>
    combineDishEventDBValues(d.dishEvent, d.dish, d.image)
  );
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
  ageRangeSize?: number,
  showPopulated = true
) => {
  if (
    dateStart &&
    (dateStart.getTime() <= Date.now() ||
      (dateEnd &&
        (dateEnd.getTime() <= dateStart.getTime() ||
          dateEnd.getTime() <= Date.now())))
  ) {
    return [] as Dish[];
  }

  let locationCityCoords: [number, number] | undefined = undefined;
  let agePreference: number | undefined = undefined;
  let actuallyShowPopulated = showPopulated;
  if (locationCity) {
    locationCityCoords = (await getCoords(locationCity)) ?? undefined;
  }
  let signedUpIds = [] as string[];
  if (userId) {
    const userInfo = await getUserInfo(userId);
    if (userInfo) {
      if (!locationCityCoords) {
        locationCityCoords = userInfo.locationCityCoords;
      }
      agePreference = Math.floor(
        ((userInfo.dateOfBirth ? userInfo.dateOfBirth.getTime() : 0) +
          (dateStart ? dateStart.getTime() - Date.now() : 0)) /
          (1000 * 60 * 60 * 24 * 365)
      );
      if (!userInfo.showPopulated) {
        actuallyShowPopulated = false;
      }
      signedUpIds = await (
        await getSignedUpDishes(userId)
      ).map((item) => item.dishId);
    }
  }

  const dishesCollection = await getDishesCollection();

  const result = await dishesCollection
    .find({
      $and: [
        signedUpIds.length ? { customId: { $not: { $in: signedUpIds } } } : {},
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
                    (locationRangeSize ?? DEFAULT_SEARCH_LOCATION_RANGE) * 1000,
                },
              },
            }
          : {},
        !actuallyShowPopulated ? { populated: { $ne: true } } : {},
      ],
      $expr: { $ne: ['$slots', '$filled'] },
    })
    .sort({ populated: 1, date: 1 })
    .skip(start)
    .limit(limit)
    .toArray();

  return combineDishesDBValues(
    result,
    result.length
      ? await getPictures(result.map((item) => item.dish))
      : undefined
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
    currentSimilarDishes = getRecommender()
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

const getRecommendedDishesInternal = async (
  userId: string,
  previousIds?: string[],
  limit = 6,
  locationCityCoords?: [number, number],
  agePreference?: number,
  dateStart?: Date,
  dateEnd?: Date,
  locationRangeSize?: number,
  ageRangeSize?: number,
  showPopulated = true,
  searchPopulated = false
): Promise<Dish[]> => {
  const dishesCollection = await getDishesCollection();

  const dishes = await dishesCollection
    .find({
      $and: [
        previousIds ? { customId: { $not: { $in: previousIds } } } : {},
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
                    (locationRangeSize ?? DEFAULT_SEARCH_LOCATION_RANGE) * 1000,
                },
              },
            }
          : {},
      ],
      populated: searchPopulated ? true : { $ne: true },
      $expr: { $ne: ['$slots', '$filled'] },
    })
    .toArray();

  if (dishes.length <= limit) {
    if (dishes.length < limit && showPopulated && !searchPopulated) {
      return [
        ...combineDishesDBValues(
          dishes,
          dishes.length
            ? await getPictures(dishes.map((item) => item.dish))
            : undefined
        ),
        ...(await getRecommendedDishesInternal(
          userId,
          previousIds,
          limit - dishes.length,
          locationCityCoords,
          agePreference,
          dateStart,
          dateEnd,
          locationRangeSize,
          ageRangeSize,
          true,
          true
        )),
      ];
    }
    return combineDishesDBValues(
      dishes,
      dishes.length
        ? await getPictures(dishes.map((item) => item.dish))
        : undefined
    );
  }

  const dishPreferencesCollection = await getDishPreferencesCollection();

  const preferences = await dishPreferencesCollection
    .find({
      userId,
    })
    .toArray();

  if (!preferences.length) {
    return combineDishesDBValues(
      dishes.slice(limit),
      dishes.length
        ? await getPictures(dishes.slice(limit).map((item) => item.dish))
        : undefined
    );
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

  return combineDishesDBValues(
    output,
    output.length
      ? await getPictures(output.map((item) => item.dish))
      : undefined
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
  ageRangeSize?: number,
  showPopulated = true
) => {
  if (
    dateStart &&
    (dateStart.getTime() <= Date.now() ||
      (dateEnd &&
        (dateEnd.getTime() <= dateStart.getTime() ||
          dateEnd.getTime() <= Date.now())))
  ) {
    return [] as Dish[];
  }

  let signedUpIds = [] as string[];
  let locationCityCoords: [number, number] | undefined = undefined;
  let agePreference: number | undefined = undefined;
  let actuallyShowPopulated = showPopulated;
  if (locationCity) {
    locationCityCoords = (await getCoords(locationCity)) ?? undefined;
  }
  if (userId) {
    const userInfo = await getUserInfo(userId);
    if (userInfo) {
      if (!locationCityCoords) {
        locationCityCoords = userInfo.locationCityCoords;
      }
      agePreference = Math.floor(
        ((userInfo.dateOfBirth ? userInfo.dateOfBirth.getTime() : 0) +
          (dateStart ? dateStart.getTime() - Date.now() : 0)) /
          (1000 * 60 * 60 * 24 * 365)
      );
      if (!userInfo.showPopulated) {
        actuallyShowPopulated = false;
      }
      signedUpIds = await (
        await getSignedUpDishes(userId)
      ).map((item) => item.dishId);
    }
  }

  return await getRecommendedDishesInternal(
    userId,
    [...(previousIds ?? []), ...signedUpIds],
    limit,
    locationCityCoords,
    agePreference,
    dateStart,
    dateEnd,
    locationRangeSize,
    ageRangeSize,
    actuallyShowPopulated,
    false
  );
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

export const getMyDishes = async (
  userId: string,
  limit?: number,
  start = 0
) => {
  const dishesCollection = await getDishesCollection();
  const dishEventsCollection = await getDishEventsCollection();

  const dishes = await dishesCollection
    .find({
      userId,
      date: { $gte: new Date() },
    })
    .sort({ date: 1 })
    .skip(start)
    .limit(limit ?? 0)
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
        image: await getPicture(item.dish),
      }))
    )
  );
};

export const getSignedUpDishes = async (
  userId: string,
  limit?: number,
  start = 0
) => {
  const dishesCollection = await getDishesCollection();
  const dishEventsCollection = await getDishEventsCollection();

  const dishEvents = await dishEventsCollection
    .find({
      participantId: userId,
      date: { $gte: new Date() },
    })
    .sort({ date: 1 })
    .skip(start)
    .limit(limit ?? 0)
    .toArray();

  return combineDishesEventsDBValues(
    (
      await Promise.all(
        dishEvents.map(async (item) => {
          const dish = await dishesCollection.findOne({
            customId: item.dishId,
          });
          if (dish) {
            return {
              dishEvent: item,
              dish,
              image: await getPicture(item.dish),
            };
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
    return combineDishDBValues(dish, await getPicture(dish.dish));
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
  isFirst: boolean,
  populated = false
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
            populated,
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

export const removePopulatedDishPreferences = async () => {
  const dishPreferencesCollection = await getDishPreferencesCollection();

  await dishPreferencesCollection.deleteMany({
    populated: true,
  });
};

export const addDish = async (
  dish: string,
  userId: string,
  slots: number,
  date: Date,
  locationCity?: string,
  exactLocation?: string,
  dishDescription?: string,
  populated = false
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
        age: userInfo.dateOfBirth
          ? Math.floor(
              (Date.now() -
                userInfo.dateOfBirth.getTime() +
                (date.getTime() - Date.now())) /
                (1000 * 60 * 60 * 24 * 365)
            )
          : undefined,
        locationCity: locationCityCoords
          ? locationCity
          : userInfo.locationCityCoords
          ? userInfo.locationCity
          : undefined,
        locationCityCoords: locationCityCoords ?? userInfo.locationCityCoords,
        exactLocation: exactLocation ?? userInfo.exactLocation,
        populated,
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

Unfortunately the plan for eating ${dish.dish} on ${moment(dish.date)
                .tz('Europe/Zurich')
                .calendar()} has been cancelled by the host.

Use the site to search for alternatives: ${generateFrontendLink('/user')}`
            : `Hello ${dishEvent.participantName}

Thank your for using the ${APP_NAME} App.

Unfortunately the plan for eating ${dish.dish} on ${moment(dish.date)
                .tz('Europe/Zurich')
                .calendar()} has been cancelled by an admin.

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

Unfortunately your plan for eating ${dish.dish} on ${moment(dish.date)
          .tz('Europe/Zurich')
          .calendar()} has been cancelled by an admin.

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

export const removePopulatedDishes = async () => {
  const dishesCollection = await getDishesCollection();

  await dishesCollection.deleteMany({
    populated: true,
  });
};

export const addDishEventInternal = async (
  customId: string,
  userId: string,
  message?: string,
  populated = false
) => {
  const dishEventsCollection = await getDishEventsCollection();

  if (
    await dishEventsCollection.findOne({
      dishiD: customId,
      participantId: userId,
    })
  ) {
    return { success: false };
  }
  const dishesCollection = await getDishesCollection();

  const dish = await dishesCollection.findOne({
    customId,
    date: { $gte: new Date() },
    $expr: { $ne: ['$slots', '$filled'] },
  });

  if (dish) {
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
      populated: populated || dish.populated,
    });

    if (result.acknowledged) {
      return {
        success: true,
        dish: dish.dish,
        dishName: dish.name,
        dishDate: dish.date,
        participantName,
        customId: id,
        userId: dish.userId,
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

Your plan on ${APP_NAME} for eating ${result.dish} on ${moment(result.dishDate)
      .tz('Europe/Zurich')
      .calendar()} has received a new guest request from ${
      result.participantName
    }.

Use the site to accept it: ${generateFrontendLink('/plans')}`;
    await sendUserMail(result.userId, APP_NAME + ' new guest request', body);

    return true;
  }
  return false;
};

export const removeDishEvent = async (customId: string, userId?: string) => {
  const dishEventsCollection = await getDishEventsCollection();

  const dishEvent = await dishEventsCollection.findOne({
    customId,
    participantId: userId,
    date: { $gte: new Date() },
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
          $inc: {
            filled: -1,
          },
        }
      );

      if (result.modifiedCount > 0) {
        const body = `Hello ${dish.name}

Thank your for using the ${APP_NAME} App.

Unfortunately your guest ${dishEvent.participantName} for eating ${
          dish.dish
        } on ${moment(dish.date).tz('Europe/Zurich').calendar()} has cancelled.

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

export const removePopulatedDishEvents = async () => {
  const dishEventsCollection = await getDishEventsCollection();

  await dishEventsCollection.deleteMany({
    populated: true,
  });
};

export const acceptDishEventInternal = async (
  customId: string,
  userId: string,
  response?: string
) => {
  const dishEventsCollection = await getDishEventsCollection();

  const dishEvent = await dishEventsCollection.findOne({
    customId,
    accepted: false,
    date: { $gte: new Date() },
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
    )
      .tz('Europe/Zurich')
      .calendar()} with ${result.dishName} has been accepted.

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
    accepted: true,
    date: { $gte: new Date() },
  });

  if (dishEvent) {
    const dishesCollection = await getDishesCollection();

    const dish = await dishesCollection.findOne({
      customId: dishEvent.dishId,
      userId,
    });

    if (
      dish &&
      (
        await dishesCollection.updateOne(
          {
            customId: dishEvent.dishId,
          },
          {
            $inc: {
              filled: -1,
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
        )
          .tz('Europe/Zurich')
          .calendar()} has cancelled your invite.

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

  const usersCollection = await getUsersCollection();

  const activeUsers = await usersCollection
    .find({
      lastLogin: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) },
      populated: { $ne: true },
    })
    .toArray();

  const dishPreferencesCollection = await getDishPreferencesCollection();

  const preferences = await dishPreferencesCollection
    .find({ userId: { $in: activeUsers.map((item) => item.customId) } })
    .toArray();

  const allDishes = [...dishes, ...preferences];

  const documents = allDishes
    .map((dish, index) => {
      if (allDishes.findIndex((item) => item.dish === dish.dish) === index) {
        return { id: dish.dish, content: dish.description };
      }
      return null;
    })
    .filter((item) => item);

  setTimeout(() =>
    (async () => {
      try {
        getRecommender().train(documents);
        if (recommenderInUse) {
          recommenderInUse = 0;
        } else {
          recommenderInUse = 1;
        }
      } catch (err) {
        console.error(err);
        process.exitCode = 1;
      }
    })()
  );
};
