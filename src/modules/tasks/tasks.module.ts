import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from '../database/db.module';

@Module({
  imports: [ScheduleModule.forRoot(), DbModule],
  providers: [],
})
export class TasksModule {}
