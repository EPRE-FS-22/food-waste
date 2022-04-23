import { COLORS } from './constants.js';

export interface Points {
  color: keyof typeof COLORS;
  points: number;
  lastChanged: Date;
}

export interface PointsCategory {
  name: string;
  amount: number;
}

export interface PointsWithStats extends Points {
  categories: PointsCategory[];
}

export interface PointEvent {
  color: string;
  pointsDiff: number;
  date: Date;
  addedDate: Date;
  addedBy?: string;
  owner?: string;
  reason?: string;
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

export interface User {
  email: string;
  registerDate: Date;
  name?: string;
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

export type Setting = StringSetting | NumberSetting | DateSetting | SubSetting;
