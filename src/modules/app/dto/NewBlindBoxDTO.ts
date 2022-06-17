import { IsArray, IsNotEmpty, Min } from 'class-validator';

export class NewBlindBoxDTO {
  @IsNotEmpty()
  name: string;
  @IsNotEmpty()
  description: string;
  @IsNotEmpty()
  asset: string;
  @IsNotEmpty()
  thumbnail: string;
  @IsArray()
  tokenIds: string[];
  maxQuantity: number;
  @Min(0)
  blindPrice: number;
  saleBegin: number;
  @Min(1)
  maxPurchase: number;
}
