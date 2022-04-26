import { WithId } from 'mongodb';
import { DISHES } from './constants.js';
import { getPointEventsCollection, getPointsCollection } from './data.js';
import type { Points, PointsCategory, PointsWithStats } from './model';

const stripPointsIds = (points: WithId<Points>[]): Points[] => {
  return points.map((p) => ({ ...p, _id: undefined }));
};

export const getPoints = async () => {
  const pointsCollection = await getPointsCollection();

  return stripPointsIds(await pointsCollection.find({}).toArray());
};

export const getPointsWithStats = async () => {
  const pointEventsCollection = await getPointEventsCollection();

  const points = await getPoints();
  const events = await pointEventsCollection.find({}).toArray();

  const pointsWithStats: PointsWithStats[] = points.map((item) => {
    const pointsCategories: Record<string, number> = {};
    events
      .filter((event) => event.dish === item.dish)
      .forEach((event) => {
        if (pointsCategories[event.reason || 'General']) {
          pointsCategories[event.reason || 'General'] += event.pointsDiff;
        } else {
          pointsCategories[event.reason || 'General'] = event.pointsDiff;
        }
      });
    const categoriesArray: PointsCategory[] = Object.keys(pointsCategories).map(
      (key) => {
        return { name: key, amount: pointsCategories[key] };
      }
    );
    return { ...item, categories: categoriesArray };
  });
  return pointsWithStats;
};

export const addPoints = async (
  dish: keyof typeof DISHES,
  number: number,
  date?: Date,
  owner?: string,
  reason?: string
) => {
  const pointsCollection = await getPointsCollection();
  const pointEventsCollection = await getPointEventsCollection();

  await pointsCollection.updateOne(
    { dish: dish },
    {
      $inc: { points: number },
      $currentDate: { lastChanged: true },
    }
  );

  await pointEventsCollection.insertOne({
    dish: dish,
    pointsDiff: number,
    date: date ?? new Date(),
    addedDate: new Date(),
    addedBy: 'Web',
    owner,
    reason,
  });

  return await getPointsWithStats();
};
