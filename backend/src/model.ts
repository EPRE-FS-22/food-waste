export interface DishBase {
  dish: string;
}

export interface DBDishBase extends DishBase {
  description: string;
  fake?: boolean;
}

export interface DishPlan extends DishBase {
  customId: string;
}

export interface Dish extends DishPlan, UserInfoDish {
  date: Date;
  slots: number;
  filled: number;
  dishDescription?: string;
}

export interface DishInfoBase extends Dish {
  lastAcceptedDate?: Date;
  createdDate: Date;
}

export interface DishInfo extends DishInfoBase {
  participantNames: string[];
  participantMessages: (string | undefined)[];
  responses: (string | undefined)[];
  participantRequestsNames: string[];
  participantRequestsMessages: (string | undefined)[];
  eventIds: string[];
  eventRequestsIds: string[];
}

export interface DBDish extends DishInfoBase, DBDishBase, UserInfoBasePrivate {
  userId: string;
}

export interface DishEventBase extends DishPlan {
  participantName: string;
  accepted: boolean;
  message?: string;
  response?: string;
  signupDate: Date;
  acceptedDate?: Date;
}

export interface DishEvent extends DishEventBase, Dish {}

export interface DBDishEvent extends DishEventBase, DBDishBase {
  participantId: string;
  dishId: string;
}

export interface DishPreference extends DishBase {
  likes: boolean;
}

export interface DBDishPreference extends DishPreference, DBDishBase {
  userId: string;
  setDate: Date;
}
export interface BaseSetting {
  key: string;
  value: unknown;
  type: string;
}

export interface StringSetting extends BaseSetting {
  key: string;
  value: string;
  type: 'string';
}

export interface NumberSetting extends BaseSetting {
  key: string;
  value: number;
  type: 'string';
}

export interface DateSetting extends BaseSetting {
  key: string;
  value: Date;
  type: 'date';
}

export interface SubSetting extends BaseSetting {
  key: string;
  value: Setting;
  type: 'sub';
}

export interface UserInfo {
  name?: string;
  locationCity?: string;
  locationCityCoords?: [number, number];
}

export interface UserInfoDish extends UserInfo {
  age?: number;
}

export interface UserInfoBasePrivate extends UserInfo {
  exactLocation?: string;
}

export interface UserInfoPrivate extends UserInfoBasePrivate {
  dateOfBirth?: Date;
  infosSet: boolean;
  identityConfirmed: boolean;
  preferencesSet: boolean;
}

export interface User extends UserInfoPrivate {
  customId: string;
  email: string;
  registerDate: Date;
  hash?: string;
  verifyHash?: string;
  verifyExpiration?: Date;
  verifyStay?: boolean;
  resetHash?: string;
  resetExpiration?: Date;
  lastLogin?: Date;
  verifyDate?: Date;
  changedDate?: Date;
}

export interface DBUser extends User {
  fake?: boolean;
  showFake?: boolean;
}

export type Setting = StringSetting | NumberSetting | DateSetting | SubSetting;
