import axios from 'axios';

const previousPictures: Record<string, string> = {};

const picturesKey = import.meta.env.VITE_FOOD_WASTE_PICTURES_KEY as
  | string
  | undefined;

export const getPicture = async (search: string) => {
  if (!picturesKey) {
    return '';
  }
  if (previousPictures[search]) {
    return previousPictures[search];
  }
  const result = await axios.get('https://api.pexels.com/v1/search', {
    params: {
      query: search,
      size: 'medium',
      per_page: 1,
    },
    headers: {
      Authorization: picturesKey,
    },
  });
  if (
    result &&
    result.data &&
    result.data.photos &&
    result.data.photos.length
  ) {
    previousPictures[search] = result.data.photos[0].src.medium;
    return result.data.photos[0].src.medium;
  }
  return '';
};
