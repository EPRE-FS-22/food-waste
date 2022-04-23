import cryptoRandomString from 'crypto-random-string';

export const makeId = (length: number) => {
  return cryptoRandomString({ length, type: 'alphanumeric' });
};
