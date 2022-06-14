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

  static composeOrderClauseForMyToken(orderBy: OrderBy) {
    switch (orderBy) {
      case OrderBy.PriceHTL:
        return { 'orders.orderPrice': -1 };
      case OrderBy.PriceLTH:
        return { 'orders.orderPrice': 1 };
      case OrderBy.MOST_VIEWED:
        return { 'token_orders.views': -1 };
      case OrderBy.MOST_LIKED:
        return { 'token_orders.likes': -1 };
      case OrderBy.MOST_RECENT:
        return { createTime: -1 };
      case OrderBy.OLDEST:
        return { createTime: 1 };
      default:
        return { createTime: -1 };
    }
  }
}
