import { Module } from '@nestjs/common';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';
import { CloudinaryModule } from 'src/common/cloudinary/cloudinary.module';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { MailerService } from 'src/common/email/mailer.service';

@Module({
  imports: [CloudinaryModule, PrismaModule],
  controllers: [TeachersController],
  providers: [TeachersService, MailerService],
})
export class TeachersModule {}