import { Module } from '@nestjs/common';
import { HomeworkResultsService } from './homework-results.service';
import { HomeworkResultsController } from './homework-results.controller';

@Module({
  controllers: [HomeworkResultsController],
  providers: [HomeworkResultsService],
})
export class HomeworkResultsModule {}
