import wikiImport, { Coordinates, Page } from 'wikijs';
const wiki = (wikiImport as unknown as { default: typeof wikiImport })
  .default as unknown as typeof wikiImport;

export const getWikiPage = async (page: string) => {
  try {
    return (await wiki().page(page)) as Page;
  } catch (err: unknown) {
    if (
      typeof err !== 'object' ||
      !(err instanceof Error) ||
      err.message !== 'No article found'
    ) {
      throw err;
    }
    return;
  }
};

export const getWikiPageCoordinates = async (pageName: string) => {
  const page = await getWikiPage(pageName);
  if (page) {
    const coordinates = (await page.coordinates()) as Coordinates | undefined;
    if (coordinates && coordinates.lat !== null && coordinates.lon !== null) {
      return coordinates;
    }
  }
  return null;
};

const getGeoWikis = async (query: string, currentLimit = 5) => {
  const result = await wiki().prefixSearch(query, currentLimit);
  if (!result) {
    return null;
  }

  const results = result.results;
  const coordsResults = (
    await Promise.all(
      results.map(async (item) => ({
        coords: await getWikiPageCoordinates(item),
        name: item,
      }))
    )
  )
    .filter((item) => item.coords)
    .map((item) => item.name);

  return { results, coordsResults };
};

const recurseGeoWikis = async (
  query: string,
  limit = 5,
  currentLimit = 5,
  runs = 3
): Promise<string[]> => {
  const result = await getGeoWikis(query, currentLimit);
  if (!result) {
    return [];
  }
  if (
    runs > 1 &&
    result.results.length === currentLimit &&
    result.coordsResults.length < limit
  ) {
    return await recurseGeoWikis(query, limit, currentLimit + limit, runs - 1);
  }
  return result.coordsResults;
};

export const searchWiki = async (
  query: string,
  limit = 5,
  onlyCoords = false,
  lengthLimit = 50
) => {
  if (!onlyCoords) {
    const result = await wiki().prefixSearch(query, limit);
    if (!result) {
      return [];
    }
    return result.results.filter((item) => item.length <= lengthLimit);
  } else {
    return (await recurseGeoWikis(query, limit, limit, 2)).filter(
      (item) => item.length <= lengthLimit
    );
  }
};
