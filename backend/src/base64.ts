export const base64Encode = (msg: string) => {
  return Buffer.from(msg)
    .toString('base64')
    .replace(/\//g, '_')
    .replace(/\+/g, '-')
    .replace(/=/g, '~');
};
