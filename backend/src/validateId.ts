import tfn from '@tensorflow/tfjs-node';
import {testImage} from "./testimage.js";
import sharp from 'sharp'

export const validateId = async (idBase64: string) => {
  const CLASS_NAMES = ['nonid', 'nonswiss', 'swissid']
  /**const buf = await resizeImg(fs.readFileSync('/Users/oliver/HSLU/EPRE/tensorflow-test/Test/20161207_142428_HDR.jpg'),{
    width: 180,
    height: 180
  })**/
    //const buf = await fs.readFileSync('/Users/oliver/HSLU/EPRE/tensorflow-test/Test/20161207_142428_HDR.jpg');
  const imgBuffer = Buffer.from(idBase64);
  const scaledBuffer = await sharp(imgBuffer)
    .resize(180, 180)
    .jpeg()
    .toBuffer();

  let img = tfn.node.decodeJpeg(scaledBuffer);
  img = img.expandDims();
  img = img.cast('float32');
  console.log(img.toString())
  const model = await tfn.node.loadSavedModel('./src/identifier');
  const predictions = model.predict(img)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const score = tfn.softmax(predictions);
  console.log(score.toString())
  if (idBase64) {
    return true;
  }
  return false;
};


(async () => {
  try {
    await validateId(testImage);
  } catch (e) {
    console.error(e);
    throw e;
  }

})();
