import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Sleep } from '../../utils/utils';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { NotificationType, OrderState, OrderType } from '../common/interfaces';

@Injectable()
export class QueueService {
  public contractMarket;
  private readonly logger = new Logger('QueueService');

  constructor(
    private configService: ConfigService,
    @InjectConnection() private readonly connection: Connection,
    @InjectQueue('token-data-queue') private tokenDataQueue: Queue,
    @InjectQueue('order-data-queue') private orderDataQueue: Queue,
  ) {
    this.contractMarket = this.configService.get('CONTRACT_MARKET');
  }

  // async onOffSale(tokenId: string, from: string, to: string, blockNumber: number) {
  //   if (to === this.contractMarket) {
  //     await this.connection
  //       .collection('token_on_order')
  //       .updateOne(
  //         { tokenId, blockNumber },
  //         { $inc: { count: 1 }, $set: { from } },
  //         { upsert: true },
  //       );
  //   } else if (from === this.contractMarket) {
  //     const result = await this.connection
  //       .collection('token_on_order')
  //       .updateOne({ tokenId, count: { $gt: 0 } }, { $inc: { count: -1 }, $set: { to } });
  //     if (result.modifiedCount === 0) {
  //       this.logger.warn(
  //         `Token ${tokenId} is not in database, so put the [ off-sale ] job into the queue`,
  //       );
  //       await Sleep(1000);
  //       await this.tokenDataQueue.add('token-on-off-sale', {
  //         blockNumber,
  //         from,
  //         to,
  //         tokenId,
  //       });
  //     }
  //   }
  // }

  async createToken(
    tokenId: string,
    blockNumber: number,
    createTime: number,
    category: string,
    name: string,
    description: string,
    royaltyOwner: string,
    royaltyFee: number,
    thumbnail: string,
  ) {
    await this.connection.collection('tokens').updateOne(
      { tokenId },
      {
        $set: {
          blockNumber,
          createTime,
          category,
          name,
          description,
          royaltyOwner,
          royaltyFee,
          thumbnail,
        },
      },
      { upsert: true },
    );
  }

  async updateOrder(
    blockNumber: number,
    tokenId: string,
    orderId: number,
    seller: string,
    orderType: OrderType,
    orderState: OrderState,
    orderPrice: number,
    createTime: number,
    isBlindBox: boolean,
  ) {
    await this.connection.collection('orders').updateOne(
      { orderId },
      {
        $set: {
          tokenId,
          seller,
          orderType,
          orderState,
          orderPrice,
          createTime,
          blockNumberForPrice: blockNumber,
          blockNumberForBuyer: blockNumber,
          isBlindBox,
        },
      },
      { upsert: true },
    );
  }

  async updateOrderPrice(blockNumber: number, orderId: number, orderPrice: number) {
    await this.connection
      .collection('orders')
      .updateOne(
        { orderId, blockNumberForPrice: { $lt: blockNumber } },
        { $set: { orderPrice, blockNumberForPrice: blockNumber } },
      );
  }

  async updateOrderState(blockNumber: number, orderId: number, orderState: OrderState) {
    const result = await this.connection
      .collection('orders')
      .updateOne({ orderId }, { $set: { orderState } });
    if (result.matchedCount === 0) {
      this.logger.warn(
        `Order ${orderId} is not in database, so put the [ update-order-state ] job into the queue again`,
      );
      await Sleep(1000);
      await this.orderDataQueue.add('update-order-state', {
        blockNumber,
        orderId,
        orderState,
      });
    }

    //send notifications to seller and royalty owner
    // if (orderState === OrderState.Filled && result.modifiedCount === 1) {
    //   await Sleep(1000);
    //   const date = Date.now();
    //   const order = await this.connection.collection('orders').findOne({ orderId });
    //   const token = await this.connection.collection('tokens').findOne({ tokenId: order.tokenId });
    //   await this.connection.collection('notifications').updateOne(
    //     {
    //       orderId,
    //       address: order.seller,
    //       type: NotificationType.Token_Sold,
    //     },
    //     {
    //       $set: {
    //         orderId,
    //         address: order.seller,
    //         type: NotificationType.Token_Sold,
    //         date,
    //         params: { tokenName: token.name, price: order.orderPrice, buyer: order.buyer },
    //       },
    //     },
    //     { upsert: true },
    //   );
    //   await this.connection.collection('notifications').updateOne(
    //     {
    //       orderId,
    //       address: order.seller,
    //       type: NotificationType.RoyaltyFee_Received,
    //     },
    //     {
    //       $set: {
    //         orderId,
    //         address: token.royaltyOwner,
    //         type: NotificationType.RoyaltyFee_Received,
    //         date,
    //         params: {
    //           tokenName: token.name,
    //           royaltyFee: (token.royaltyFee / 100 / 10000) * order.orderPrice,
    //         },
    //       },
    //     },
    //     { upsert: true },
    //   );
    // }
  }

  async updateOrderBuyer(blockNumber: number, orderId: number, buyer: string) {
    const result = await this.connection
      .collection('orders')
      .updateOne(
        { orderId, blockNumberForBuyer: { $lt: blockNumber } },
        { $set: { buyer, blockNumberForBuyer: blockNumber } },
      );
    if (result.modifiedCount === 1) {
      const order = await this.connection.collection('orders').findOne({ orderId });
      await this.connection.collection('notifications').updateOne(
        {
          orderId,
          address: order.seller,
          type: NotificationType.Token_Sold,
        },
        { $set: { 'params.buyer': order.buyer } },
      );
    }
  }
}
