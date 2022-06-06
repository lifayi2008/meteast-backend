import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';
import { TokenDataConsumer } from './token-data.consumer';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'token-data-queue',
    }),
  ],
  providers: [QueueService, TokenDataConsumer],
})
export class QueueModule {}
