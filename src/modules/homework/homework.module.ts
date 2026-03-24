import { Module } from '@nestjs/common';
import { HomeworkService } from './homework.service';
import { HomeworkController } from './homework.controller';
import { HomeworkResponseModule } from './homework-response/homework-response.module';
import { HomeworkResultsModule } from './homework-results/homework-results.module';
import { CloudinaryModule } from 'src/common/cloudinary/cloudinary.module';

@Module({
  controllers: [HomeworkController],
  providers: [HomeworkService],
  imports: [CloudinaryModule, HomeworkResponseModule, HomeworkResultsModule],
})
export class HomeworkModule {}
