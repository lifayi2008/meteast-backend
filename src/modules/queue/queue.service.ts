import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Sleep } from '../../utils/utils';

@Injectable()
export class QueueService {
  public contractMarket;
  private readonly logger = new Logger('QueueService');

  constructor(
    private configService: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {
    this.contractMarket = this.configService.get('CONTRACT_MARKET');
  }

  async onOffSale(tokenId: string, from: string, to: string, blockNumber: number) {
    if (to === this.contractMarket) {
      await this.connection
        .collection('token_on_order')
        .updateOne({ tokenId, blockNumber }, { $inc: { count: 1 } }, { upsert: true });
    } else if (from === this.contractMarket) {
      const result = await this.connection
        .collection('token_on_order')
        .updateOne({ tokenId, count: { $gt: 0 } }, { $inc: { count: -1 } });
      if (result.modifiedCount === 0) {
        this.logger.warn(`Token ${tokenId} is not on sale`);
        await Sleep(5000);
        await this.onOffSale(tokenId, to, from, blockNumber);
      }
    }
  }

  async createToken(tokenId: string, createTime: number) {
    await this.connection
      .collection('tokens')
      .updateOne({ tokenId }, { $set: { createTime } }, { upsert: true });
  }
}
