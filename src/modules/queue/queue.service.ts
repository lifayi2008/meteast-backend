import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QueueService {
  public contractMarket;
  private readonly logger = new Logger('QueueService');

  constructor(
    private configService: ConfigService,
    @InjectConnection() private readonly connection: Connection,
    @InjectQueue('tokenOnOffSaleQueue') private tokenOnOffSaleQueue: Queue,
  ) {
    this.contractMarket = this.configService.get('CONTRACT_MARKET');
  }

  async onOffSale(tokenId: string, from: string, to: string, blockNumber: number) {
    if (to === this.contractMarket) {
      await this.connection.collection('token_on_order').insertOne({ tokenId, blockNumber });
    } else if (from === this.contractMarket) {
      await this.connection
        .collection('token_on_order')
        .deleteOne({ tokenId, blockNumber: { $lt: blockNumber } });
    } else {
      this.logger.warn(`Token ${tokenId} is in unknow status`);
    }
  }
}
