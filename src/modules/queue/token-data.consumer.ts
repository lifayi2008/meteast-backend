import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { QueueService } from './queue.service';

@Processor('token-data-queue')
export class TokenDataConsumer {
  private readonly logger = new Logger('TokenDataConsumer');

  constructor(private queueService: QueueService) {}

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
      royaltyFee: number;
      thumbnail: string;
    }>,
  ) {
    this.logger.log(`Processing job ['token-create'] tokenId: ${JSON.stringify(job.data.tokenId)}`);
    await this.queueService.createToken(
      job.data.tokenId,
      job.data.blockNumber,
      job.data.createTime,
      job.data.category,
      job.data.name,
      job.data.description,
      job.data.royaltyOwner,
      job.data.royaltyFee,
      job.data.thumbnail,
    );

    return true;
  }
}
