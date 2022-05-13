import type { Dish, DishEvent, DishInfo } from '../../backend/src/model';

export interface DisplayDish extends Dish {
  image?: string;
}

export interface DisplayDishInfo extends DishInfo {
  image?: string;
}

export interface DisplayDishEvent extends DishEvent {
  image?: string;
}

interface BaseCurrentDish {
  type: string;
  dish: DisplayDish | DisplayDishInfo | DisplayDishEvent;
}

export interface NormalCurrentDish extends BaseCurrentDish {
  type: 'normal';
  dish: DisplayDish;
}

interface InfoCurrentDish extends BaseCurrentDish {
  type: 'info';
  dish: DisplayDishInfo;
}

interface EventCurrentDish extends BaseCurrentDish {
  type: 'event';
  dish: DisplayDishEvent;
}

export type PlanDish = InfoCurrentDish | EventCurrentDish;

export type CurrentDish = NormalCurrentDish | PlanDish;
