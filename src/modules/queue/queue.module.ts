import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';
import { TokenOrderConsumer } from './token-order.consumer';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'tokenOnOffSaleQueue',
    }),
    BullModule.registerQueue({
      name: 'tokenCreateQueue',
    }),
  ],
  providers: [QueueService, TokenOrderConsumer],
})
export class QueueModule {}
