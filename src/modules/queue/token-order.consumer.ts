import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

@Processor('tokenOnOffSaleQueue')
export class TokenOrderConsumer {
  private readonly logger = new Logger('TokenOrderConsumer');

  @Process()
  async transcode(job: Job<unknown>) {
    let progress = 0;
    for (let i = 0; i < 100; i++) {
      this.logger.log(`Progress: ${progress}%`);
      progress += 1;
      await job.progress(progress);
    }
    return {};
  }
}
