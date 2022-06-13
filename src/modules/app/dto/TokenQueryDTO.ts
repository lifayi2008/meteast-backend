import { OrderBy } from '../../common/interfaces';
import { QueryPageDTO } from '../../common/QueryPageDTO';

export class TokenQueryDTO extends QueryPageDTO {
  keyword: string;
  orderType: OrderBy;
  filterStatus: string;
  minPrice: number;
  maxPrice: number;
  category: string;
}
