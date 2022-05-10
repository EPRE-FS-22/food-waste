import axios, { AxiosError } from 'axios';
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
              size: 'large',
              per_page: 10,
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
            const photo =
              result.data.photos[
                Math.floor(Math.random() * result.data.photos.length)
              ];
            previousPictures[search].next(photo.src.large);
            resolve(photo.src.large);
            return;
          } else {
            previousPictures[search].next('');
          }
          resolve('');
        }
      } catch (err) {
        if (typeof err === 'object' && err instanceof AxiosError) {
          previousPictures[search].next('');
          resolve('');
        } else {
          reject(err);
        }
      }
    })();
  });
