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
    await this.queueService.onOffSale(
      job.data.tokenId,
      job.data.from,
      job.data.to,
      job.data.blockNumber,
    );
  }

  @Process('token-create')
  async tokenCreate(
    job: Job<{
      tokenId: string;
      blockNumber: number;
      createTime: number;
      category: string;
      name: string;
      description: string;
      royaltyOwner: string;
      thumbnail: string;
    }>,
  ) {
    this.logger.log(`Processing job ['token-create'] data: ${JSON.stringify(job.data)}`);
    await this.queueService.createToken(
      job.data.tokenId,
      job.data.blockNumber,
      job.data.createTime,
      job.data.category,
      job.data.name,
      job.data.description,
      job.data.royaltyOwner,
      job.data.thumbnail,
    );
  }
}
