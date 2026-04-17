import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CreateLessonVideosDto } from './dto/create-lesson-video.dto';
import { Role } from '@prisma/client';

@Injectable()
export class LessonVideosService {
  constructor(private readonly prisma: PrismaService) { }

  async getAllLessonVideosByGroup(groupId: number, currentUser: { id: number; role: Role }) {
    const existGroup = await this.prisma.group.findUnique({
      where: {
        id: groupId,
        status: 'ACTIVE'
      }
    })

    if (!existGroup) {
      throw new NotFoundException('Group not found');
    }

    if (currentUser.role === Role.TEACHER && existGroup.teacherId !== currentUser.id) {
      throw new ForbiddenException('Bu sening guruhing emas');
    }

    const lessonVideos = await this.prisma.lessonVideo.findMany({
      where: {
        groupId
      },
      select: {
        id: true,
        file: true,
        lessonId: true,
        created_at: true,
        lesson: {
          select: {
            title: true,
            created_at: true,
          }
        }
      }

    })
    return {
      success: true,
      data: lessonVideos

    }
  }

  async createLessonVideo(
    payload: CreateLessonVideosDto,
    currentUser: { id: number; role: Role },
    filename?: string
  ) {
    if (!filename) {
      throw new BadRequestException('File is required')
    }

    const existGroup = await this.prisma.group.findUnique({
      where: {
        id: payload.groupId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        teacherId: true,
      },
    });

    if (!existGroup) {
      throw new NotFoundException('Group not found');
    }

    if (currentUser.role === Role.TEACHER && existGroup.teacherId !== currentUser.id) {
      throw new ForbiddenException('Bu sening guruhing emas');
    }

    const existLesson = await this.prisma.lesson.findUnique({
      where: { id: payload.lessonId },
      select: { id: true, groupId: true },
    });

    if (!existLesson) {
      throw new NotFoundException('Lesson not found with this id');
    }

    if (existLesson.groupId !== payload.groupId) {
      throw new BadRequestException('Bu dars shu guruhga tegishli emas');
    }

    const teacherId = currentUser.role === Role.TEACHER ? currentUser.id : null;
    const userId = currentUser.role === Role.TEACHER ? null : currentUser.id;

    await this.prisma.lessonVideo.create({
      data: {
        ...payload,
        file: filename,
        teacherId,
        userId,
      }
    })

    return {
      success: true,
      message: 'Lesson video created successfully'
    }
  }
}
