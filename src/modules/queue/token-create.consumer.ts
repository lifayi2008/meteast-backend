import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { QueueService } from './queue.service';

@Processor('tokenCreateTimeQueue')
export class TokenCreateConsumer {
  private readonly logger = new Logger('TokenTimeConsumer');

  constructor(
    private queueService: QueueService,
    @InjectQueue('tokenCreateQueue') private tokenCreateQueue: Queue,
  ) {}

  @Process()
  async transcode(job: Job<{ tokenId: string; createTime: number }>) {
    this.logger.log(
      `Processing job [${this.tokenCreateQueue.name}] data: ${JSON.stringify(job.data)}`,
    );
    await this.tokenCreateQueue.pause();
    await this.queueService.createToken(job.data.tokenId, job.data.createTime);
    await this.tokenCreateQueue.resume();
    await this.tokenCreateQueue.clean(5000);
  }
}
