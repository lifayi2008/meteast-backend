import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { QueueService } from './queue.service';

@Processor('token-data-queue')
export class TokenDataConsumer {
  private readonly logger = new Logger('TokenDataConsumer');

  constructor(
    private queueService: QueueService,
    @InjectQueue('token-data-queue') private tokenDataQueue: Queue,
  ) {}

  @Process('token-on-off-sale')
  async tokenSale(job: Job<{ blockNumber: number; tokenId: string; from: string; to: string }>) {
    this.logger.log(`Processing job ['token-on-off-sale'] data: ${JSON.stringify(job.data)}`);
    await this.tokenDataQueue.pause();
    await this.queueService.onOffSale(
      job.data.tokenId,
      job.data.from,
      job.data.to,
      job.data.blockNumber,
    );
    await this.tokenDataQueue.resume();
  }

  @Process('token-create')
  async tokenCreate(job: Job<{ tokenId: string; createTime: number }>) {
    this.logger.log(`Processing job ['token-create'] data: ${JSON.stringify(job.data)}`);
    await this.tokenDataQueue.pause();
    await this.queueService.createToken(job.data.tokenId, job.data.createTime);
    await this.tokenDataQueue.resume();
  }
}
