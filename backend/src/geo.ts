import { getWikiPageCoordinates } from './wiki.js';

export const getCoords = async (
  name: string
): Promise<[number, number] | null> => {
  const coords = await getWikiPageCoordinates(name);
  if (coords) {
    return [coords.lat, coords.lon];
  }
  return null;
};
