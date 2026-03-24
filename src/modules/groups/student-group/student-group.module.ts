import { Module } from '@nestjs/common';
import { StudentGroupService } from './student-group.service';
import { StudentGroupController } from './student-group.controller';

@Module({
  controllers: [StudentGroupController],
  providers: [StudentGroupService],
})
export class StudentGroupModule {}
