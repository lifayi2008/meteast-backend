import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DbService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private configService: ConfigService,
  ) {}
}
