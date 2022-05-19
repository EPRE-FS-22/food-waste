# Food waste

Food waste sharing app

## About The Project

The project consists of a frontend as well as a backend which the frontend connects with and where the users are store.

### Built With

This project is build with modern web-technologies, the most important are:

#### Frontend

- [Vue.js 3 (Composition API)](https://vuejs.org/)
- [Vite](https://vitejs.dev)
- [SCSS/Sass](https://sass-lang.com)
- [Vue Router](https://router.vuejs.org)

#### Shared / Both

- [Typescript](https://www.typescriptlang.org)
- [tRPC](https://trpc.io)
- [RxJS](https://rxjs.dev)

#### Backend

- [Node.js](https://nodejs.org/en/)
- [fastify](https://www.fastify.io)
- [MongoDB](https://www.mongodb.com)

<!-- GETTING STARTED -->

## Getting Started

To set up the project locally follow the following steps.

### Prerequisites

To install and run the project you will need the following:

#### General / Shared

- Git: [install (click here)](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- a recent version of Node.js and npm:
  [install (click here)](https://nodejs.dev/learn/how-to-install-nodejs), update:

  ```sh
  npm install npm@latest -g
  npm install -g node
  ```

- Yarn v1.x (not 2): [install instructions](https://classic.yarnpkg.com/lang/en/docs/install/#mac-stable) or use

  ```sh
  npm install --global yarn
  ```

#### Backend

- MongoDB: [install (click here)](https://www.mongodb.com/docs/guides/server/install/)

#### Frontend

- A (or better multiple) modern browser(s)

### Cloning and installation

1. Clone the repo

   ```sh
   git clone git@github.com:EPRE-FS-22/food-waste.git
   ```

   or

   ```sh
   git clone https://github.com/EPRE-FS-22/food-waste.git
   ```

2. Enter the directory

   ```sh
   cd food-waste
   ```

3. Install NPM packages at root level (This will install husky for commitlint.)

   ```sh
   yarn
   ```

### Subprojects installation and running (easy helper scripts)

To install and run the subprojects using the helper scripts (from the root level) use the following commands.

WARNING: If you are running windows, these helper script currently don't work. Skip to the manual way further down.

1. Install NPM packages for all subprojects

   ```sh
   yarn install:all
   ```

2. Start the backend and the frontend with auto-recompile, auto-restart and auto-refresh on changes (no type checking in the frontend)

   ```sh
   yarn serve
   ```

   or build the backend and the frontend completely once (includes type checking in the frontend and will use the production configuration for the frontend)

   ```sh
   yarn build
   ```

3. Format everything using linters (includes lint check after formatting each subproject)

   ```sh
   yarn format
   ```

   or only lint it

   ```sh
   yarn lint
   ```

### Subprojects installation and running (manual)

To install and run the subprojects manually use the following commands.

#### Frontend

1. Enter the directory

   ```sh
   cd frontend
   ```

2. Install NPM packages for the frontend

   ```sh
   yarn
   ```

3. Start Vite with auto-recompile and auto-refresh on changes (no type checking)

   ```sh
   yarn dev
   ```

   or build it completely once (includes type checking and will use the production configuration)

   ```sh
   yarn build
   ```

4. Format using linters

   ```sh
   yarn format:all
   ```

   and lint it afterwards

   ```sh
   yarn lint:all
   ```

#### Backend

1. Enter the directory

   ```sh
   cd backend
   ```

2. Install NPM packages for the backend

   ```sh
   yarn
   ```

3. Run typescript with auto-recompile on changes

   ```sh
   yarn watch
   ```

   or build it once

   ```sh
   yarn build
   ```

4. **Open a new shell instance/terminal** and navigate to the same location

   ```sh
   cd backend
   ```

5. Run the program with Node.js and auto-restart on changes

   ```sh
   yarn serve
   ```

   or run it once

   ```sh
   yarn start
   ```

6. Format using linters

   ```sh
   yarn format:all
   ```

   and lint it afterwards

   ```sh
   yarn lint:all
   ```

### Configuration, building and deployment

This project is configured by default to run on localhost and in development configuration.
To configure and build it for production, set the following environment variables:

#### Frontend

```sh
VITE_FOOD_WASTE_PROTOCOL="https"
VITE_FOOD_WASTE_BACKEND_HOST="<domain>"
VITE_FOOD_WASTE_BACKEND_PORT="3330"
VITE_FOOD_WASTE_CAPTCHA_SITEKEY="<hCaptcha sitekey (can be omitted to disable captcha)>"
```

These can be set in a `.env.production.local` file in the `frontend` directory so they will be used for every full build (using `yarn build`), but not for testing and development.
(Or create a `.env` file to also use it while testing and development.)

In the frontend the environment variables will be loaded in at compile/build time an can therefore be omitted when deploying the compiled/built `dist` files on a webserver.

#### Backend

```sh
FOOD_WASTE_PORT="3330"
FOOD_WASTE_IP="<server IP address, NOT DOMAIN!!!>"
FOOD_WASTE_SSL_CERT="<file path to ssl certificate (can be omitted, then http/ws will be used)>"
FOOD_WASTE_SSL_KEY="<file path to ssl private key (can be omitted together with the certificate)>"
FOOD_WASTE_FRONTEND_HOST="mll.one"
FOOD_WASTE_FRONTEND_PORT="<Port the frontend uses, can be omitted to use dev server. SET IN PRODUCTION!>"
FOOD_WASTE_FRONTEND_PATH="<Path the frontend uses, can be omitted if path is root or to use dev server.>"
FOOD_WASTE_DEFAULT_PASSWORD="<default password to be set on first connection to database, if not set already, SHOULD BE REMOVED/OMITTED LATER!!!>"
FOOD_WASTE_DATABASE_HOST="localhost"
FOOD_WASTE_DATABASE_PORT="27017"
FOOD_WASTE_DATABASE_USER="<MongoDB user (can be omitted)>"
FOOD_WASTE_DATABASE_PASSWORD="<MongoDB password (can be omitted)"
FOOD_WASTE_CAPTCHA_SECRET="<hCaptcha secret (can be omitted to disable captcha)>"
FOOD_WASTE_PICTURES_KEY="<Pexels API key (can be omitted to disable picture)>"
FOOD_WASTE_MAIL_HOSTNAME="<E-Mail server hostname (can be omitted to disable E-Mails)>"
FOOD_WASTE_MAIL_PORT="<E-Mail server port (can be omitted to disable E-Mails)>"
FOOD_WASTE_MAIL_SECURE="<Wether E-Mail should use secure transfer (false if omitted)>"
FOOD_WASTE_MAIL_USE_TLS="<Wether E-Mail should use TLS (false if omitted)>"
FOOD_WASTE_MAIL_USERNAME="<E-Mail server username (can be omitted to disable E-Mails)>"
FOOD_WASTE_MAIL_PASSWORD="<E-Mail server password (can be omitted to disable E-Mails)>"
FOOD_WASTE_MAIL_ADDRESS="<E-Mail sender address (can be omitted to disable E-Mails)>"
```

These can also be set in a `.env` file in the directory it's run from. WARNING: Unlike in the frontend, they will be used for every run (including testing and development). They are not needed at compile time and can be omitted for most testing and development setups.

Since the environment variables will be loaded at runtime they need to be included when deploying the compiled `dist` files on a server.

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

**Important**: To keep this project clean and easily readable, we use [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) and an entire suite of linters.
Before submitting your Pull Request, check that you have followed conventional commits and run the format and lint commands mentioned above.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feat/add-amazing-feature`)
3. Commit your Changes (`git commit -m 'feat: add some amazing feature'`)
4. Push to the Branch (`git push origin feat/add-amazing-feature`)
5. Open a Pull Request

## License

Distributed under the GNU General Public License v3.0. See `LICENSE` for more information.

<p align="right">(<a href="#top">back to top</a>)</p>
