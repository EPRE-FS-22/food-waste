import moment from 'moment';
import { ref } from 'vue';
import {
  hasConfirmedUserSession,
  hasConfirmedUserSessionWithPreferences,
  hasSession,
  hasUserSession,
} from './data';

export enum DisplayType {
  available,
  recommended,
  plans,
}

export const loggedIn = ref(hasSession());
export const userLoggedIn = ref(hasUserSession());
export const userConfirmed = ref(hasConfirmedUserSession());
export const userConfirmedWithPreferences = ref(
  hasConfirmedUserSessionWithPreferences()
);

export const resetState = () => {
  loggedIn.value = hasSession();
  userLoggedIn.value = hasUserSession();
  userConfirmed.value = hasConfirmedUserSession();
  userConfirmedWithPreferences.value = hasConfirmedUserSessionWithPreferences();
};

export const ranking = ref(false);

export const loading = ref(true);

const currentDate = moment(new Date()).format('YYYY-MM-DDThh:mm');

export const settings = ref({
  amount: ref(1),
  keepAmount: false,
  date: ref(currentDate),
  keepDate: false,
  owner: ref(''),
  keepOwner: false,
  reason: ref(''),
  keepReason: false,
});
