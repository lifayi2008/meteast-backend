export interface User {
  address: string;
  role: number;
  did?: string;
  name?: string;
  avatar?: string;
  description?: string;
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
