export interface CommonResponse {
  status: number;
  message: string;
  data?: any;
}

export interface User {
  address: string;
  role: number;
  did?: string;
  name?: string;
  avatar?: string;
  description?: string;
  userCoverImage?: string;
}

export enum OrderBy {
  PriceLTH = 'price_l_to_h',
  PriceHTL = 'price_h_to_l',
  MOST_VIEWED = 'mostviewed',
  MOST_LIKED = 'mostliked',
  MOST_RECENT = 'mostrecent',
  OLDEST = 'oldest',
  DEFAULT = '',
}

export enum UserType {
  Admin,
  User = 2,
  M,
}

export enum OrderType {
  Sale = 1,
  Auction,
}

export enum OrderState {
  Created = 1,
  Filled,
  Cancelled,
  TakenDown,
}

export enum NotificationType {
  Token_Sold = 1,
  RoyaltyFee_Received,
}
