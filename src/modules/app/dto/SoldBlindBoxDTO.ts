import { IsArray, IsNotEmpty } from 'class-validator';

export class SoldBlindBoxDTO {
  @IsNotEmpty()
  id: string;
  @IsArray()
  orderIds: string[];
}
