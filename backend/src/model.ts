export interface DishBase {
  dish: string;
}

export interface DBDishBase extends DishBase {
  description: string;
  populated?: boolean;
}

export interface DishPlan extends DishBase {
  date: Date;
  customId: string;
}

export interface DishBasic extends DishPlan, UserInfoDish {
  slots: number;
  filled: number;
  dishDescription?: string;
}

export interface Dish extends DishBasic {
  image?: string;
}

export interface DishInfoBase extends Dish {
  lastAcceptedDate?: Date;
  createdDate: Date;
}

export interface DishInfo extends DishInfoBase, UserInfoBasePrivate {
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
  dishId: string;
}

export interface DishEventGeneral extends DishEventBase, Dish {}

export interface DishEventAccepted
  extends DishEventGeneral,
    UserInfoBasePrivate {
  accepted: true;
}

export interface DishEventNotAccepted
  extends DishEventGeneral,
    UserInfoBasePrivate {
  accepted: false;
}

export type DishEvent = DishEventAccepted | DishEventNotAccepted;

export interface DBDishEvent extends DishEventBase, DBDishBase {
  participantId: string;
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

export interface BooleanSetting extends BaseSetting {
  key: string;
  value: boolean;
  type: 'boolean';
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
  value: Setting[];
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
  showPopulated?: boolean;
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
  populated?: boolean;
}

export type Setting =
  | StringSetting
  | BooleanSetting
  | NumberSetting
  | DateSetting
  | SubSetting;
