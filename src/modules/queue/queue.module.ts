import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';
import { TokenDataConsumer } from './token-data.consumer';
import { OrderDataConsumer } from './order-data.consumer';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'token-data-queue',
      },
      { name: 'order-data-queue' },
    ),
  ],
  providers: [QueueService, TokenDataConsumer, OrderDataConsumer],
})
export class QueueModule {}
