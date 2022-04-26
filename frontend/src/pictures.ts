import axios from 'axios';
import { ReplaySubject } from 'rxjs';

const previousPictures: Record<string, ReplaySubject<string>> = {};

const picturesKey = import.meta.env.VITE_FOOD_WASTE_PICTURES_KEY as
  | string
  | undefined;

export const getPicture = (search: string) =>
  new Promise<string>((resolve, reject) => {
    (async () => {
      try {
        if (!picturesKey) {
          resolve('');
          return;
        }
        if (previousPictures[search]) {
          previousPictures[search].subscribe((item) => {
            resolve(item);
          });
        } else {
          previousPictures[search] = new ReplaySubject();
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
            previousPictures[search].next(result.data.photos[0].src.medium);
            resolve(result.data.photos[0].src.medium);
            return;
          }
          resolve('');
        }
      } catch (err) {
        reject(err);
      }
    })();
  });
