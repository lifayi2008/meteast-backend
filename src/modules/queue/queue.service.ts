import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class QueueService {
  constructor(@InjectQueue('tokenOnOffSaleQueue') private tokenOnOffSaleQueue: Queue) {}
}
