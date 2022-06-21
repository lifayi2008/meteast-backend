import { IsNotEmpty } from 'class-validator';

export class UserProfileDTO {
  @IsNotEmpty()
  address: string;
  @IsNotEmpty()
  signature: string;
  name?: string;
  avatar?: string;
  description?: string;
  coverImage?: string;
}
