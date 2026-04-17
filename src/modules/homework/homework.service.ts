import { HomeworkStatus, Role } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { HomeworkStatusDto } from './dto/homework.status.dto';
import { UpdateHomeworkDto } from './dto/update-homework.dto';

@Injectable()
export class HomeworkService {
  constructor(private prisma: PrismaService) { }

  async getHomeworkById(
    homeworkId: number,
    query: HomeworkStatusDto,
    currentUser: { id: number; role: Role },
  ) {
    const existHomework = await this.prisma.homework.findUnique({
      where: {
        id: homeworkId,
      },
      select: {
        id: true,
        groupId: true,
        teacherId: true,
        userId: true,
      },
    });

    if (!existHomework) {
      throw new NotFoundException('Homework not found');
    }

    if (currentUser.role === Role.TEACHER) {
      const group = await this.prisma.group.findUnique({
        where: { id: existHomework.groupId },
        select: { teacherId: true },
      });
      if (existHomework.teacherId !== currentUser.id && group?.teacherId !== currentUser.id) {
        throw new ForbiddenException('Bu sening homeworking emas');
      }
    }

    if (
      currentUser.role === Role.STUDENT &&
      existHomework.userId !== currentUser.id
    ) {
      throw new ForbiddenException('Bu sening homeworking emas');
    }

    if (query.status === HomeworkStatus.PENDING) {
      const homeworkResponses = await this.prisma.homeworkResponse.findMany({
        where: {
          homeworkId,
        },
        select: {
          id: true,
          title: true,
          file: true,
          created_at: true,
          student: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      const existingResults = await this.prisma.homeworkResult.findMany({
        where: { homeworkId },
        select: { studentId: true },
      });
      const gradedStudentIds = new Set(existingResults.map((r) => r.studentId));

      const pendingResponses = homeworkResponses.filter(
        (response) => !gradedStudentIds.has(response.student.id),
      );

      return {
        success: true,
        data: pendingResponses.map((response) => ({
          student: response.student,
          comment: response.title,
          file: response.file,
          submittedAt: response.created_at,
        })),
      };
    }

    if (query.status === HomeworkStatus.NOT_REVIEWED) {
      const allHomeworkResponses = await this.prisma.homeworkResponse.findMany({
        where: {
          homeworkId,
        },
        select: {
          studentId: true,
        },
      });

      const submittedStudentIds = allHomeworkResponses.map(
        (response) => response.studentId,
      );
      const notSubmittedStudents = await this.prisma.student.findMany({
        where: {
          studentGroups: {
            some: {
              groupId: existHomework.groupId,
              status: 'ACTIVE',
            },
          },
          id: {
            notIn: submittedStudentIds,
          },
        },
        select: {
          id: true,
          fullName: true,
        },
      });

      return {
        success: true,
        data: notSubmittedStudents,
      };
    }

    if (query.status === HomeworkStatus.REJECTED) {
      const rejectedResults = await this.prisma.homeworkResult.findMany({
        where: {
          homeworkId,
          status: HomeworkStatus.REJECTED,
        },
        select: {
          id: true,
          student: {
            select: {
              id: true,
              fullName: true,
            },
          },
          score: true,
          title: true,
          created_at: true,
          updated_at: true,
        },
      });

      const responseMap = await this.prisma.homeworkResponse.findMany({
        where: {
          homeworkId,
          studentId: { in: rejectedResults.map((r) => r.student.id) },
        },
        select: {
          studentId: true,
          title: true,
          file: true,
          created_at: true,
        },
      });

      const responseByStudent = new Map(
        responseMap.map((response) => [response.studentId, response]),
      );

      return {
        success: true,
        data: rejectedResults.map((result) => {
          const response = responseByStudent.get(result.student.id);
          return {
            resultId: result.id,
            student: result.student,
            score: result.score,
            teacherComment: result.title,
            reviewedAt: result.updated_at,
            submittedAt: response?.created_at || null,
            comment: response?.title || null,
            file: response?.file || null,
          };
        }),
      };
    }

    if (query.status === HomeworkStatus.APPROVED) {
      const approvedResults = await this.prisma.homeworkResult.findMany({
        where: {
          homeworkId,
          status: HomeworkStatus.APPROVED,
        },
        select: {
          id: true,
          student: {
            select: {
              id: true,
              fullName: true,
            },
          },
          score: true,
          title: true,
          created_at: true,
          updated_at: true,
        },
      });

      const responseMap = await this.prisma.homeworkResponse.findMany({
        where: {
          homeworkId,
          studentId: { in: approvedResults.map((r) => r.student.id) },
        },
        select: {
          studentId: true,
          title: true,
          file: true,
          created_at: true,
        },
      });

      const responseByStudent = new Map(
        responseMap.map((response) => [response.studentId, response]),
      );

      return {
        success: true,
        data: approvedResults.map((result) => {
          const response = responseByStudent.get(result.student.id);
          return {
            resultId: result.id,
            student: result.student,
            score: result.score,
            teacherComment: result.title,
            reviewedAt: result.updated_at,
            submittedAt: response?.created_at || null,
            comment: response?.title || null,
            file: response?.file || null,
          };
        }),
      };
    }

    return {
      success: true,
      data: existHomework,
    };
  }

  async getAllHomeworkByGroup(
    groupId: number,
    currentUser: { id: number; role: Role },
  ) {
    const existGroup = await this.prisma.group.findUnique({
      where: {
        id: groupId,
        status: 'ACTIVE',
      },
    });

    if (!existGroup) {
      throw new NotFoundException('Group not found');
    }

    if (
      currentUser.role === Role.TEACHER &&
      existGroup.teacherId !== currentUser.id
    ) {
      throw new ForbiddenException('Bu sening guruhing emas');
    }
    const homeworks = await this.prisma.homework.findMany({
      where: {
        groupId,
      },
      select: {
        id: true,
        title: true,
        lessonId: true,
        created_at: true,
        durationTime: true,
      },
    });

    return {
      success: true,
      data: homeworks,
    };
  }

  async createHomework(
    payload: any,
    currentUser: { id: number; role: string },
    filename?: string,
  ) {
    const existGroup = await this.prisma.group.findUnique({
      where: {
        id: payload.groupId,
        status: 'ACTIVE',
      },
    });

    if (!existGroup) {
      throw new NotFoundException('Group not found');
    }

    if (
      currentUser.role == Role.TEACHER &&
      existGroup.teacherId != currentUser.id
    ) {
      throw new ForbiddenException('Bu sening guruhing emas');
    }

    const existLesson = await this.prisma.lesson.findUnique({
      where: {
        id: payload.lessonId,
      },
    });

    if (!existLesson) {
      throw new NotFoundException('Lesson not found with this id');
    }

    if (existLesson.groupId != payload.groupId) {
      throw new ForbiddenException('Bu dars shu guruhga tegishli emas');
    }

    await this.prisma.homework.create({
      data: {
        title: payload.title,
        file: filename,
        groupId: payload.groupId,
        lessonId: payload.lessonId,
        teacherId: currentUser.role === Role.TEACHER ? currentUser.id : null,
        userId: currentUser.role === Role.STUDENT ? currentUser.id : null,
      },
    });

    return {
      success: true,
      message: 'Homework created successfully',
    };
  }

  async updateHomework(
    homeworkId: number,
    payload: UpdateHomeworkDto,
    currentUser: { id: number; role: Role },
    filename?: string,
  ) {
    const existHomework = await this.prisma.homework.findUnique({
      where: {
        id: homeworkId,
      },
    });

    if (!existHomework) {
      throw new NotFoundException('Homework not found with this id');
    }

    if (
      currentUser.role === Role.TEACHER &&
      existHomework.teacherId !== currentUser.id
    ) {
      throw new ForbiddenException('Bu sening homeworking emas');
    }

    const targetGroupId = payload.groupId ?? existHomework.groupId;
    const targetLessonId = payload.lessonId ?? existHomework.lessonId;

    const existGroup = await this.prisma.group.findUnique({
      where: {
        id: targetGroupId,
        status: 'ACTIVE',
      },
    });

    if (!existGroup) {
      throw new NotFoundException('Group not found');
    }

    if (
      currentUser.role === Role.TEACHER &&
      existGroup.teacherId !== currentUser.id
    ) {
      throw new ForbiddenException('Bu sening guruhing emas');
    }

    const existLesson = await this.prisma.lesson.findUnique({
      where: {
        id: targetLessonId,
      },
    });

    if (!existLesson) {
      throw new NotFoundException('Lesson not found with this id');
    }

    if (existLesson.groupId !== targetGroupId) {
      throw new BadRequestException('Bu dars shu guruhga tegishli emas');
    }

    await this.prisma.homework.update({
      where: {
        id: homeworkId,
      },
      data: {
        title: payload.title,
        groupId: payload.groupId,
        lessonId: payload.lessonId,
        file: filename ?? undefined,
      },
    });

    return {
      success: true,
      message: 'Homework updated successfully',
    };
  }

  async updateHomeworkByTeacher(
    homeworkId: number,
    payload: UpdateHomeworkDto,
    currentUser: { id: number; role: Role },
    filename?: string,
  ) {
    if (currentUser.role !== Role.TEACHER) {
      throw new ForbiddenException('Faqat teacher update qila oladi');
    }

    return this.updateHomework(homeworkId, payload, currentUser, filename);
  }
}