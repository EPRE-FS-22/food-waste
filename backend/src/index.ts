import fastify from 'fastify';
import fastifyCors from 'fastify-cors';
import fp from 'fastify-plugin';
import fs from 'fs';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify/dist/trpc-server-adapters-fastify.cjs.js';
import { createContext } from './context.js';
import { appRouter } from './router.js';
import 'dotenv/config';

console.log('starting');

const cert = process.env.FOOD_WASTE_SSL_CERT ?? '';
const key = process.env.FOOD_WASTE_SSL_KEY ?? '';

const makeHTTPSFastify = () => {
  return fastify({
    http2: true,
    https: {
      allowHTTP1: true,
      key: fs.readFileSync(key),
      cert: fs.readFileSync(cert),
    },
    maxParamLength: 5000,
    bodyLimit: 10000000,
  });
};

const makeFastify = (): ReturnType<typeof makeHTTPSFastify> => {
  if (cert && key) {
    return makeHTTPSFastify();
  }
  // Hack because their signatures are incompatible, but we still want to allow localhost
  return fastify({
    maxParamLength: 5000,
    bodyLimit: 10000000,
  }) as unknown as ReturnType<typeof makeHTTPSFastify>;
};

const server = makeFastify();

server.register(fp(fastifyTRPCPlugin), {
  prefix: '/',
  trpcOptions: { router: appRouter, createContext },
});

export const frontendHost = process.env.FOOD_WASTE_FRONTEND_HOST ?? 'localhost';
export const frontendPort = process.env.FOOD_WASTE_FRONTEND_PORT ?? '4000';
export const frontendPath = process.env.FOOD_WASTE_FRONTEND_PATH ?? '/#';
export const frontendProtocol =
  process.env.FOOD_WASTE_FRONTEND_PROTOCOL ?? 'http://';

export const generateFrontendLink = (path: string) => {
  return `${frontendProtocol}${frontendHost}${
    frontendPort ? ':' + frontendPort : ''
  }${frontendPath}${path}`;
};

server.register(fastifyCors, {
  origin: (origin, cb) => {
    const hostname = new URL(origin).hostname;
    if (hostname === frontendHost) {
      cb(null, true);
      return;
    }
    cb(new Error('Not allowed'), false);
  },
});
(async () => {
  try {
    await server.listen(
      process.env.FOOD_WASTE_PORT ?? 3330,
      process.env.FOOD_WASTE_IP ?? undefined
    );
    console.log('Listening on port 3330');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
