import { OrderBy } from '../interfaces';
import { QueryPageDTO } from '../../common/QueryPageDTO';
import { IsEnum, IsIn, Min } from 'class-validator';

export class TokenQueryDTO extends QueryPageDTO {
  keyword: string;

  @IsEnum(OrderBy)
  orderType: OrderBy;

  @IsIn(['BUY NOW', 'ON AUCTION', ''])
  filterStatus: string;

  @Min(0)
  minPrice: number;
  @Min(0)
  maxPrice: number;

  category: string;
}
