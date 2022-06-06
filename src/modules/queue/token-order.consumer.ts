import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { QueueService } from './queue.service';

@Processor('tokenOnOffSaleQueue')
export class TokenOrderConsumer {
  private readonly logger = new Logger('TokenOrderConsumer');

  constructor(
    private queueService: QueueService,
    @InjectQueue('tokenOnOffSaleQueue') private tokenOnOffSaleQueue: Queue,
  ) {}

  @Process()
  async transcode(job: Job<{ blockNumber: number; tokenId: string; from: string; to: string }>) {
    this.logger.log(
      `Processing job [${this.tokenOnOffSaleQueue.name}] data: ${JSON.stringify(job.data)}`,
    );
    await this.tokenOnOffSaleQueue.pause();
    await this.queueService.onOffSale(
      job.data.tokenId,
      job.data.from,
      job.data.to,
      job.data.blockNumber,
    );
    await this.tokenOnOffSaleQueue.resume();
    await this.tokenOnOffSaleQueue.clean(5000);
  }
}
