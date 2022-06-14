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

  @Process('update-order-at-backend')
  async updateOrder(
    job: Job<{
      tokenId: string;
      orderId: number;
      orderType: OrderType;
      orderState: OrderState;
      orderPrice: number;
      createTime: number;
    }>,
  ) {
    this.logger.log(`Processing job ['update-order-at-backend'] data: ${JSON.stringify(job.data)}`);
    await this.queueService.updateOrder(
      job.data.tokenId,
      job.data.orderId,
      job.data.orderType,
      job.data.orderState,
      job.data.orderPrice,
      job.data.createTime,
    );
  }

  @Process('update-order-price')
  async updateOrderPrice(
    job: Job<{ orderId: number; orderPrice: number; orderState: OrderState }>,
  ) {
    this.logger.log(`Processing job ['update-order-price'] data: ${JSON.stringify(job.data)}`);
    await this.queueService.updateOrderPrice(
      job.data.orderId,
      job.data.orderPrice,
      job.data.orderState,
    );
  }

  @Process('update-order-state')
  async updateOrderState(job: Job<{ orderId: number; orderState: OrderState }>) {
    this.logger.log(`Processing job ['update-order-price'] data: ${JSON.stringify(job.data)}`);
    await this.queueService.updateOrderState(job.data.orderId, job.data.orderState);
  }
}
