import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { Sleep } from '../../utils/utils';

@Processor('tokenOnOffSaleQueue')
export class TokenOrderConsumer {
  private readonly logger = new Logger('TokenOrderConsumer');

  constructor(@InjectQueue('tokenOnOffSaleQueue') private tokenOnOffSaleQueue: Queue) {}

  @Process()
  async transcode(job: Job<unknown>) {
    await this.tokenOnOffSaleQueue.pause();
    await Sleep(3000);
    this.logger.log(JSON.stringify(job.data));
    await this.tokenOnOffSaleQueue.resume();
  }
}
