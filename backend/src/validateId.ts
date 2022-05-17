import tfn from '@tensorflow/tfjs-node';
import sharp from 'sharp';
// import fs from 'fs';

export const validateId = async (idBase64: string) => {
  const regex = /^data:.+\/(.+);base64,(.*)$/;

  const matches = idBase64.slice(0, 100).match(regex);
  if (!matches) {
    return false;
  }
  if (!['jpg', 'jpeg', 'png'].includes(matches[1])) {
    return false;
  }
  const data = matches[2] + idBase64.slice(100);
  const CLASS_NAMES = ['nonid', 'nonswiss', 'swissid']


  const imgBuffer = Buffer.from(data, 'base64');
  let scaledBuffer: Buffer | undefined = undefined;
  try {
    scaledBuffer = await sharp(imgBuffer).resize(180, 180).jpeg().toBuffer();
  } catch (e) {
    if (
      typeof e !== 'object' ||
      !(e instanceof Error) ||
      e.message !== 'Input buffer contains unsupported image format'
    ) {
      throw e;
    }
  }
  if (!scaledBuffer) {
    return false;
  }
  console.log(!!scaledBuffer);
  let img = tfn.node.decodeJpeg(scaledBuffer);
  img = img.expandDims();
  img = img.cast('float32');
  console.log(!!img);
  const model = await tfn.node.loadSavedModel('./src/identifier');
  console.log(!!model);
  const predictions = model.predict(img);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const score = tfn.softmax(predictions);
  const score_array = score.dataSync();
  const max = Math.max(...score_array);
  const indexOfMax = score_array.indexOf(max);


  if (CLASS_NAMES[indexOfMax] == 'swissid') {
    return true;
  }
  return false;
};
