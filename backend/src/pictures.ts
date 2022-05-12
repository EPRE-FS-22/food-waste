import axios from 'axios';
import { ReplaySubject } from 'rxjs';
import 'dotenv/config';

const previousPictures: Record<
  string,
  { date: Date; value: ReplaySubject<string> }
> = {};

const picturesKey = process.env.FOOD_WASTE_PICTURES_KEY as string | undefined;

export const getPicture = (search: string) =>
  new Promise<string>((resolve, reject) => {
    (async () => {
      try {
        if (!picturesKey) {
          resolve('');
          return;
        }
        if (
          previousPictures[search] &&
          previousPictures[search].date.getTime() > Date.now() - 1000 * 60 * 5
        ) {
          previousPictures[search].value.subscribe((item) => {
            resolve(item);
          });
        } else {
          const subject = previousPictures[search]
            ? previousPictures[search].value
            : new ReplaySubject<string>();
          previousPictures[search] = { date: new Date(), value: subject };
          let currentIndex = 0;
          while (
            Object.keys(previousPictures).length > 1000 &&
            currentIndex < Object.keys(previousPictures).length
          ) {
            if (
              !previousPictures[Object.keys(previousPictures)[currentIndex]]
                .value.observed
            ) {
              delete previousPictures[
                Object.keys(previousPictures)[currentIndex]
              ];
            }
            currentIndex++;
          }
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
            subject.next(photo.src.large);
            resolve(photo.src.large);
            return;
          }
          subject.next('');
          resolve('');
        }
      } catch (err) {
        if (previousPictures[search]) {
          previousPictures[search].value.next('');
        }
        if (typeof err === 'object' && axios.isAxiosError(err)) {
          resolve('');
        } else {
          reject(err);
        }
      }
    })();
  });

export const getPictures = async (searches: string[]) => {
  if (!searches.length) {
    return [];
  }

  if (!picturesKey) {
    return searches.map(() => '');
  }

  return await Promise.all(
    searches.map(async (item) => await getPicture(item))
  );
};
