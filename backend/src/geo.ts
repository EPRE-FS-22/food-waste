import type { Coordinates } from 'wikijs';
import { getWikiPage } from './wiki.js';

export const getCoords = async (
  name: string
): Promise<[number, number] | null> => {
  const page = await getWikiPage(name);
  if (page) {
    const coords = (await page.coordinates()) as Coordinates | undefined;
    if (coords) {
      return [coords.lat, coords.lon];
    }
  }
  return null;
};
