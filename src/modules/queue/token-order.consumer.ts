import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('tokenOnOffSaleQueue')
export class TokenOrderConsumer {
  @Process()
  async transcode(job: Job<unknown>) {
    // let progress = 0;
    // for (i = 0; i < 100; i++) {
    //   await doSomething(job.data);
    //   progress += 1;
    //   await job.progress(progress);
    // }
    // return {};
    console.log(job.data);
  }
}
