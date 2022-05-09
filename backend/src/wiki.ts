import wikiImport, { Coordinates, Page } from 'wikijs';
const wiki = (wikiImport as unknown as { default: typeof wikiImport })
  .default as unknown as typeof wikiImport;

export const getWikiPage = async (page: string) => {
  return (await wiki().page(page)) as Page | undefined;
};

export const searchWiki = async (query: string, limit = 15, onlyCoords = false) => {
  if (!onlyCoords) {
    const result = await wiki().search(query, limit);
    return result.results;

  } else {
    console.log(onlyCoords);
    let currentLimit = limit;
    let results: string[] = [];
    let coordsResults: string[] = [];
    do {
      const result = await wiki().search(query, limit);
      results = result.results;
      coordsResults = await Promise.all(results.filter(async (item) => ((await (await wiki().page(item)).coordinates()) as Coordinates | undefined)));
      currentLimit += limit;
    }
    while (results.length === currentLimit && coordsResults.length < limit)
    return coordsResults.slice(0, limit);
  }

};
