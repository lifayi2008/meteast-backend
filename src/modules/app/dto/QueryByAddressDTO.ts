import { IsEthereumAddress } from 'class-validator';
import { TokenQueryDTO } from './TokenQueryDTO';

export class QueryByAddressDTO extends TokenQueryDTO {
  @IsEthereumAddress()
  address: string;
}
