import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { QueueService } from './queue.service';
import { OrderState, OrderType } from '../common/interfaces';

@Processor('order-data-queue')
export class OrderDataConsumer {
  private readonly logger = new Logger('OrderDataConsumer');

  constructor(
    private queueService: QueueService,
    @InjectQueue('order-data-queue') private orderDataQueue: Queue,
  ) {}

  @Process('new-order')
  async updateOrder(
    job: Job<{
      blockNumber: number;
      tokenId: string;
      orderId: number;
      seller: string;
      orderType: OrderType;
      orderState: OrderState;
      orderPrice: number;
      createTime: number;
      isBlindBox: boolean;
    }>,
  ) {
    this.logger.log(`Processing job ['new-order'] orderId: ${JSON.stringify(job.data.orderId)}`);
    await this.queueService.updateOrder(
      job.data.blockNumber,
      job.data.tokenId,
      job.data.orderId,
      job.data.seller,
      job.data.orderType,
      job.data.orderState,
      job.data.orderPrice,
      job.data.createTime,
      job.data.isBlindBox,
    );

    return true;
  }

  @Process('update-order-price')
  async updateOrderPrice(
    job: Job<{ blockNumber: number; orderId: number; orderPrice: number; orderState: OrderState }>,
  ) {
    this.logger.log(`Processing job ['update-order-price'] data: ${JSON.stringify(job.data)}`);
    await this.queueService.updateOrderPrice(
      job.data.blockNumber,
      job.data.orderId,
      job.data.orderPrice,
    );

    return true;
  }

  @Process('update-order-state')
  async updateOrderState(
    job: Job<{ blockNumber: number; orderId: number; orderState: OrderState }>,
  ) {
    this.logger.log(`Processing job ['update-order-state'] data: ${JSON.stringify(job.data)}`);
    await this.queueService.updateOrderState(
      job.data.blockNumber,
      job.data.orderId,
      job.data.orderState,
    );

    return true;
  }

  @Process('update-order-buyer')
  async updateOrderBuyer(job: Job<{ blockNumber: number; orderId: number; buyer: string }>) {
    this.logger.log(`Processing job ['update-order-buyer'] data: ${JSON.stringify(job.data)}`);
    await this.queueService.updateOrderBuyer(
      job.data.blockNumber,
      job.data.orderId,
      job.data.buyer,
    );

    return true;
  }
}
