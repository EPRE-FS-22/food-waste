import { ReplaySubject } from 'rxjs';
import wikiImport, { Coordinates, Page } from 'wikijs';
const wiki = (wikiImport as unknown as { default: typeof wikiImport })
  .default as unknown as typeof wikiImport;

const previousWikiPageSearches: Record<
  string,
  { date: Date; value: ReplaySubject<Page | null> }
> = {};

export const getWikiPage = (page: string) =>
  new Promise<Page | null>((resolve, reject) => {
    (async () => {
      try {
        if (!page) {
          resolve(null);
          return;
        }

        if (
          previousWikiPageSearches[page] &&
          previousWikiPageSearches[page].date.getTime() >
            Date.now() - 1000 * 60 * 60
        ) {
          previousWikiPageSearches[page].value.subscribe((item) => {
            resolve(item);
          });
        } else {
          const subject = previousWikiPageSearches[page]
            ? previousWikiPageSearches[page].value
            : new ReplaySubject<Page | null>();
          previousWikiPageSearches[page] = { date: new Date(), value: subject };
          let currentIndex = 0;
          while (
            Object.keys(previousWikiPageSearches).length > 100 &&
            currentIndex < Object.keys(previousWikiPageSearches).length
          ) {
            if (
              !previousWikiPageSearches[
                Object.keys(previousWikiPageSearches)[currentIndex]
              ].value.observed
            ) {
              delete previousWikiPageSearches[
                Object.keys(previousWikiPageSearches)[currentIndex]
              ];
            }
            currentIndex++;
          }
          const foundPage = (await wiki().page(page)) as Page;
          if (foundPage) {
            subject.next(foundPage);
            resolve(foundPage);
            return;
          }
          subject.next(null);
          resolve(null);
        }
      } catch (err: unknown) {
        if (previousWikiPageSearches[page]) {
          previousWikiPageSearches[page].value.next(null);
        }
        if (
          typeof err === 'object' &&
          err instanceof Error &&
          err.message === 'No article found'
        ) {
          resolve(null);
        }
        reject(err);
      }
    })();
  });

const previousWikiCoordsSearches: Record<
  string,
  { date: Date; value: ReplaySubject<Coordinates | null> }
> = {};

export const getWikiPageCoordinates = (pageName: string) =>
  new Promise<Coordinates | null>((resolve, reject) => {
    (async () => {
      try {
        if (!pageName) {
          resolve(null);
          return;
        }

        if (
          previousWikiCoordsSearches[pageName] &&
          previousWikiCoordsSearches[pageName].date.getTime() >
            Date.now() - 1000 * 60 * 60
        ) {
          previousWikiCoordsSearches[pageName].value.subscribe((item) => {
            resolve(item);
          });
        } else {
          const subject = previousWikiCoordsSearches[pageName]
            ? previousWikiCoordsSearches[pageName].value
            : new ReplaySubject<Coordinates | null>();
          previousWikiCoordsSearches[pageName] = {
            date: new Date(),
            value: subject,
          };
          let currentIndex = 0;
          while (
            Object.keys(previousWikiCoordsSearches).length > 100 &&
            currentIndex < Object.keys(previousWikiCoordsSearches).length
          ) {
            if (
              !previousWikiCoordsSearches[
                Object.keys(previousWikiCoordsSearches)[currentIndex]
              ].value.observed
            ) {
              delete previousWikiCoordsSearches[
                Object.keys(previousWikiCoordsSearches)[currentIndex]
              ];
            }
            currentIndex++;
          }
          const page = await getWikiPage(pageName);
          if (page) {
            const coordinates = (await page.coordinates()) as
              | Coordinates
              | undefined;
            if (
              coordinates &&
              coordinates.lat !== null &&
              coordinates.lon !== null
            ) {
              subject.next(coordinates);
              resolve(coordinates);
              return;
            }
          }
          subject.next(null);
          resolve(null);
        }
      } catch (err: unknown) {
        if (previousWikiCoordsSearches[pageName]) {
          previousWikiCoordsSearches[pageName].value.next(null);
        }
        reject(err);
      }
    })();
  });

const previousWikiSummarySearches: Record<
  string,
  { date: Date; value: ReplaySubject<string> }
> = {};

export const getWikiPageSummary = (pageName: string) =>
  new Promise<string>((resolve, reject) => {
    (async () => {
      try {
        if (!pageName) {
          resolve('');
          return;
        }

        if (
          previousWikiSummarySearches[pageName] &&
          previousWikiSummarySearches[pageName].date.getTime() >
            Date.now() - 1000 * 60 * 60
        ) {
          previousWikiSummarySearches[pageName].value.subscribe((item) => {
            resolve(item);
          });
        } else {
          const subject = previousWikiSummarySearches[pageName]
            ? previousWikiSummarySearches[pageName].value
            : new ReplaySubject<string>();
          previousWikiSummarySearches[pageName] = {
            date: new Date(),
            value: subject,
          };
          let currentIndex = 0;
          while (
            Object.keys(previousWikiSummarySearches).length > 100 &&
            currentIndex < Object.keys(previousWikiSummarySearches).length
          ) {
            if (
              !previousWikiSummarySearches[
                Object.keys(previousWikiSummarySearches)[currentIndex]
              ].value.observed
            ) {
              delete previousWikiSummarySearches[
                Object.keys(previousWikiSummarySearches)[currentIndex]
              ];
            }
            currentIndex++;
          }
          const page = await getWikiPage(pageName);
          if (page) {
            const summary = (await page.summary()) as string | undefined;
            if (summary) {
              subject.next(summary);
              resolve(summary);
              return;
            }
          }
          subject.next('');
          resolve('');
        }
      } catch (err: unknown) {
        if (previousWikiSummarySearches[pageName]) {
          previousWikiSummarySearches[pageName].value.next('');
        }
        reject(err);
      }
    })();
  });

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

const previousWikiSearches: Record<
  string,
  { date: Date; value: ReplaySubject<string[]> }
> = {};

export const searchWiki = (
  query: string,
  limit = 5,
  onlyCoords = false,
  lengthLimit = 50
) =>
  new Promise<string[]>((resolve, reject) => {
    (async () => {
      try {
        if (!query) {
          resolve([]);
          return;
        }

        const cacheQuery =
          query + ';' + limit + ';' + onlyCoords + ';' + lengthLimit;

        if (
          previousWikiSearches[cacheQuery] &&
          previousWikiSearches[cacheQuery].date.getTime() >
            Date.now() - 1000 * 60 * 60
        ) {
          previousWikiSearches[cacheQuery].value.subscribe((item) => {
            resolve(item);
          });
        } else {
          const subject = previousWikiSearches[cacheQuery]
            ? previousWikiSearches[cacheQuery].value
            : new ReplaySubject<string[]>();
          previousWikiSearches[cacheQuery] = {
            date: new Date(),
            value: subject,
          };
          let currentIndex = 0;
          while (
            Object.keys(previousWikiSearches).length > 100 &&
            currentIndex < Object.keys(previousWikiSearches).length
          ) {
            if (
              !previousWikiSearches[
                Object.keys(previousWikiSearches)[currentIndex]
              ].value.observed
            ) {
              delete previousWikiSearches[
                Object.keys(previousWikiSearches)[currentIndex]
              ];
            }
            currentIndex++;
          }
          if (!onlyCoords) {
            const searchResult = await wiki().prefixSearch(query, limit);
            if (!searchResult) {
              subject.next([]);
              resolve([]);
              return;
            }
            const result = searchResult.results.filter(
              (item) => item.length <= lengthLimit
            );
            subject.next(result);
            resolve(result);
          } else {
            const result = (
              await recurseGeoWikis(query, limit, limit, 2)
            ).filter((item) => item.length <= lengthLimit);
            subject.next(result);
            resolve(result);
          }
        }
      } catch (err: unknown) {
        if (previousWikiSearches[query]) {
          previousWikiSearches[query].value.next([]);
        }
        reject(err);
      }
    })();
  });
