import wiki, { Coordinates, Page } from 'wikijs';

export const getCoords = async (
  name: string
): Promise<[number, number] | null> => {
  const page = (await wiki().page(name)) as Page | undefined;
  if (page) {
    const coords = (await page.coordinates()) as Coordinates | undefined;
    if (coords) {
      return [coords.lat, coords.lon];
    }
  }
  return null;
};
