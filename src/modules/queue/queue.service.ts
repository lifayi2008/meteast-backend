import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Sleep } from '../../utils/utils';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { OrderType } from '../common/interfaces';

@Injectable()
export class QueueService {
  public contractMarket;
  private readonly logger = new Logger('QueueService');

  constructor(
    private configService: ConfigService,
    @InjectConnection() private readonly connection: Connection,
    @InjectQueue('token-data-queue') private tokenDataQueue: Queue,
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
        this.logger.warn(
          `Token ${tokenId} is not in database, so put the related job into the queue again`,
        );
        await Sleep(1000);
        await this.tokenDataQueue.add('token-on-off-sale', {
          blockNumber,
          from,
          to,
          tokenId,
        });
      }
    }
  }

  async createToken(tokenId: string, blockNumber: number, createTime: number, category: string) {
    await this.connection
      .collection('tokens')
      .updateOne({ tokenId }, { $set: { blockNumber, createTime, category } }, { upsert: true });
  }

  async updateToken(
    blockNumber: number,
    tokenId: string,
    orderId: number,
    orderType: OrderType,
    orderPrice: number,
  ) {
    await this.connection
      .collection('tokens')
      .updateOne(
        { tokenId, blockNumber: { $gt: blockNumber } },
        { $set: { orderId, orderType, orderPrice } },
      );
  }

  async updateTokenPrice(orderId: number, orderPrice: number) {
    await this.connection.collection('tokens').updateOne({ orderId }, { $set: { orderPrice } });
  }
}
