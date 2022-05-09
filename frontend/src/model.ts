import { Dish, DishEvent, DishInfo } from '../../backend/src/model';

export interface DisplayDish extends Dish {
  image?: string;
  promo?: boolean;
}

export interface DisplayDishInfo extends DishInfo {
  image?: string;
  promo?: boolean;
}

export interface DisplayDishEvent extends DishEvent {
  image?: string;
  promo?: boolean;
}
