import { reactive, ref } from 'vue';
import {
  DEFAULT_SEARCH_AGE_RANGE,
  DEFAULT_SEARCH_LOCATION_RANGE,
} from '../../backend/src/constants';
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

export const loading = ref(true);

export const resetSettingsMessages = () => {
  settingsMessages.locationCity = '';
  settingsMessages.locationRangeSize = '';
  settingsMessages.ageRangeSize = '';
  settingsMessages.dateEnd = '';
  settingsMessages.dateStart = '';
};

export const settingsMessages = reactive({
  dateStart: '',
  dateEnd: '',
  locationCity: '',
  locationRangeSize: '',
  ageRangeSize: '',
});

export const resetSettings = () => {
  settings.locationCity = '';
  settings.previousLocationCity = '';
  settings.locationRangeSize = DEFAULT_SEARCH_LOCATION_RANGE;
  settings.ageRangeSize = DEFAULT_SEARCH_AGE_RANGE;
  settings.dateEnd = '';
  settings.dateStart = '';
};

export const settings = reactive({
  dateStart: '',
  dateEnd: '',
  locationCity: '',
  previousLocationCity: '',
  locationRangeSize: DEFAULT_SEARCH_LOCATION_RANGE,
  ageRangeSize: DEFAULT_SEARCH_AGE_RANGE,
});
