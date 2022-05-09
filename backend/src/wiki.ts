import wikiImport, { Page } from 'wikijs';
const wiki = (wikiImport as unknown as { default: typeof wikiImport })
  .default as unknown as typeof wikiImport;

export const getWikiPage = async (page: string) => {
  return (await wiki().page(page)) as Page | undefined;
};

export const searchWiki = async (query: string) => {
  return await wiki().search(query);
};
