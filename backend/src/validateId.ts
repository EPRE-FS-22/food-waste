import tfn, { Tensor } from '@tensorflow/tfjs-node';
import type { TFSavedModel } from '@tensorflow/tfjs-node/dist/saved_model';
import sharp from 'sharp';

let model: TFSavedModel | undefined = undefined;
let modelTimeout: NodeJS.Timeout | null = null;

process.env.TF_CPP_MIN_LOG_LEVEL = '2';
tfn.enableProdMode();

export const getModel = async () => {
  if (!model) {
    model = await tfn.node.loadSavedModel('./src/identifier');
    modelTimeout = setTimeout(() => {
      model = undefined;
      modelTimeout = null;
    }, 1000 * 60 * 15);
  } else {
    if (modelTimeout) {
      clearTimeout(modelTimeout);
    }
    modelTimeout = setTimeout(() => {
      model = undefined;
      modelTimeout = null;
    }, 1000 * 60 * 15);
  }
  return model;
};

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
  const CLASS_NAMES = ['nonid', 'nonswiss', 'swissid'];

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
  let img = tfn.node.decodeJpeg(scaledBuffer);
  img = img.expandDims();
  img = img.cast('float32');
  const predictions = (await getModel()).predict(img);
  if (Array.isArray(predictions) || !(predictions instanceof Tensor)) {
    return false;
  }
  const score = tfn.softmax(predictions);
  const scoreArray = score.dataSync();
  const max = Math.max(...scoreArray);
  const indexOfMax = scoreArray.indexOf(max);

  if (CLASS_NAMES[indexOfMax] != 'nonid') {
    return true;
  }
  return false;
};
