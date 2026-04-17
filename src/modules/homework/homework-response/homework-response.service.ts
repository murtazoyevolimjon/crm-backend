import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CreateHomeworkResponseDto } from './dto/create-homework-response.dto';

@Injectable()
export class HomeworkResponseService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) { }

  private async getHomeworkOrThrow(homeworkId: number) {
    const homework = await this.prisma.homework.findUnique({
      where: { id: homeworkId },
    });

    if (!homework) {
      throw new NotFoundException('Homework not found');
    }

    return homework;
  }

  private async uploadIfProvided(file?: Express.Multer.File) {
    if (!file) return undefined;
    return this.cloudinary.uploadFile(file, 'homework/responses');
  }

  async createHomeworkResponse(
    payload: CreateHomeworkResponseDto,
    currentUser: { id: number },
    file?: Express.Multer.File,
  ) {
    await this.getHomeworkOrThrow(payload.homeworkId);

    const existingResponse = await this.prisma.homeworkResponse.findFirst({
      where: {
        homeworkId: payload.homeworkId,
        studentId: currentUser.id,
      },
      select: { id: true },
    });

    if (existingResponse) {
      throw new ConflictException('Uyga vazifa allaqachon topshirilgan');
    }

    const fileUrl = await this.uploadIfProvided(file);

    await this.prisma.homeworkResponse.create({
      data: {
        title: payload.title,
        file: fileUrl,
        homeworkId: payload.homeworkId,
        studentId: currentUser.id,
      },
    });

    return {
      success: true,
      message: 'Homework response created successfully',
    };
  }

  async updateHomeworkResponse(
    payload: CreateHomeworkResponseDto,
    currentUser: { id: number },
    file?: Express.Multer.File,
  ) {
    await this.getHomeworkOrThrow(payload.homeworkId);

    const existHomeworkResponse = await this.prisma.homeworkResponse.findFirst({
      where: {
        homeworkId: payload.homeworkId,
        studentId: currentUser.id,
      },
      orderBy: {
        id: 'desc',
      },
    });

    if (!existHomeworkResponse) {
      throw new NotFoundException('Homework response not found');
    }

    const fileUrl = await this.uploadIfProvided(file);

    await this.prisma.homeworkResponse.update({
      where: {
        id: existHomeworkResponse.id,
      },
      data: {
        title: payload.title,
        file: fileUrl ?? undefined,
      },
    });

    return {
      success: true,
      message: 'Homework response updated successfully',
    };
  }
}