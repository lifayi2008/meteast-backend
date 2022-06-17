import { OrderBy } from '../../common/interfaces';
import { QueryPageDTO } from '../../common/QueryPageDTO';

export class BlindBoxQueryDTO extends QueryPageDTO {
  keyword: string;
  orderType: OrderBy;
  minPrice: number;
  maxPrice: number;
}
