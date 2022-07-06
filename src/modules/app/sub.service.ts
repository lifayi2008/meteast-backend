import { OrderBy } from '../common/interfaces';

export class SubService {
  static composeOrderClauseForMarketToken(orderBy: OrderBy) {
    switch (orderBy) {
      case OrderBy.PriceHTL:
        return { orderPrice: -1 };
      case OrderBy.PriceLTH:
        return { orderPrice: 1 };
      case OrderBy.MOST_VIEWED:
        return { 'token.views': -1 };
      case OrderBy.MOST_LIKED:
        return { 'token.likes': -1 };
      case OrderBy.MOST_RECENT:
        return { createTime: -1 };
      case OrderBy.OLDEST:
        return { createTime: 1 };
      default:
        return { createTime: -1 };
    }
  }

  static composeOrderClauseForMarketBlindBox(orderBy: OrderBy): { [key: string]: number } {
    switch (orderBy) {
      case OrderBy.PriceHTL:
        return { blindPrice: -1 };
      case OrderBy.PriceLTH:
        return { blindPrice: 1 };
      case OrderBy.MOST_VIEWED:
        return { views: -1 };
      case OrderBy.MOST_LIKED:
        return { likes: -1 };
      case OrderBy.MOST_RECENT:
        return { createTime: -1 };
      case OrderBy.OLDEST:
        return { createTime: 1 };
      default:
        return { createTime: -1 };
    }
  }

  static composeOrderClauseForToken(orderBy: OrderBy) {
    switch (orderBy) {
      case OrderBy.PriceHTL:
        return { 'order.orderPrice': -1 };
      case OrderBy.PriceLTH:
        return { 'order.orderPrice': 1 };
      case OrderBy.MOST_VIEWED:
        return { views: -1 };
      case OrderBy.MOST_LIKED:
        return { likes: -1 };
      case OrderBy.MOST_RECENT:
        return { createTime: -1 };
      case OrderBy.OLDEST:
        return { createTime: 1 };
      default:
        return { createTime: -1 };
    }
  }

  static composeOrderClauseForOrder(orderBy: OrderBy) {
    switch (orderBy) {
      case OrderBy.PriceHTL:
        return { orderPrice: -1 };
      case OrderBy.PriceLTH:
        return { orderPrice: 1 };
      case OrderBy.MOST_VIEWED:
        return { 'token.views': -1 };
      case OrderBy.MOST_LIKED:
        return { 'token.likes': -1 };
      case OrderBy.MOST_RECENT:
        return { createTime: -1 };
      case OrderBy.OLDEST:
        return { createTime: 1 };
      default:
        return { createTime: -1 };
    }
  }

  static composeOrderClauseForFavorite(orderBy: OrderBy) {
    switch (orderBy) {
      case OrderBy.PriceHTL:
        return { 'order.orderPrice': -1 };
      case OrderBy.PriceLTH:
        return { 'order.orderPrice': 1 };
      case OrderBy.MOST_VIEWED:
        return { 'token.views': -1 };
      case OrderBy.MOST_LIKED:
        return { 'token.likes': -1 };
      case OrderBy.MOST_RECENT:
        return { 'token.createTime': -1 };
      case OrderBy.OLDEST:
        return { 'token.createTime': 1 };
      default:
        return { 'token.createTime': -1 };
    }
  }
}
