import type { Dish, DishEvent, DishInfo } from '../../backend/src/model';
interface BaseCurrentDish {
  type: string;
  dish: Dish | DishInfo | DishEvent;
}

export interface NormalCurrentDish extends BaseCurrentDish {
  type: 'normal';
  dish: Dish;
}

interface InfoCurrentDish extends BaseCurrentDish {
  type: 'info';
  dish: DishInfo;
}

interface EventCurrentDish extends BaseCurrentDish {
  type: 'event';
  dish: DishEvent;
}

export type PlanDish = InfoCurrentDish | EventCurrentDish;

export type CurrentDish = NormalCurrentDish | PlanDish;
