import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'tokenOnOffSaleQueue',
    }),
  ],
  providers: [QueueService],
})
export class QueueModule {}
