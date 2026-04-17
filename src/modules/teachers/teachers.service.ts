import { Injectable, NotFoundException } from '@nestjs/common';
import { Status } from '@prisma/client';
import { MailerService } from 'src/common/email/mailer.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { hashPassword } from 'src/common/bcrypt/bcrypt';
import { UpdateTeachersDto } from './dto/update-teacher.dto';
import { generateRandomPassword } from 'src/common/utils/password.util';

@Injectable()
export class TeachersService {
  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService,
    private cloudinaryService: CloudinaryService,
  ) { }

  async createTeacher(payload: CreateTeacherDto, file?: Express.Multer.File) {
    let photoUrl: string | null = payload.photo ?? null;
    if (file) {
      photoUrl = await this.cloudinaryService.uploadFile(file, 'teachers');
    }

    const createdTeacher = await this.prisma.teacher.create({
      data: {
        fullName: payload.fullName,
        email: payload.email,
        position: payload.position,
        experience: Number(payload.experience),
        password: await hashPassword(payload.password),
        photo: photoUrl,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        created_at: true,
      },
    });

    this.mailerService.sendEmail(payload.email, payload.email, payload.password)
      .catch((err) => console.error('Email error:', err));

    return {
      success: true,
      message: 'Teacher successfully created',
      data: createdTeacher,
    };
  }

  async getAllTeachers() {
    const Teachers = await this.prisma.teacher.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        photo: true,
        position: true,
        experience: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });
    return { success: true, data: Teachers };
  }

  async resetTeacherPassword(id: number) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!teacher) throw new NotFoundException('Teacher is Not found');

    const temporaryPassword = generateRandomPassword(8);
    const hashedPassword = await hashPassword(temporaryPassword);

    await this.prisma.teacher.update({
      where: { id },
      data: { password: hashedPassword },
    });

    this.mailerService.sendEmail(teacher.email, teacher.email, temporaryPassword)
      .catch((err) => console.error('Email error:', err));

    return {
      success: true,
      message: 'Teacher paroli yangilandi',
      data: {
        temporaryPassword,
      },
    };
  }

  async getOneTeacher(id: number) {
    const Teacher = await this.prisma.teacher.findUnique({ where: { id } });
    if (!Teacher) throw new NotFoundException('Teacher is Not found');
    return { success: true, data: Teacher };
  }

  async updateTeacher(id: number, payload: UpdateTeachersDto, file?: Express.Multer.File) {
    const teacher = await this.prisma.teacher.findUnique({ where: { id } });
    if (!teacher) throw new NotFoundException('Teacher is Not found');

    const updateData: any = {};

    if (payload.fullName !== undefined) {
      updateData.fullName = payload.fullName;
    }

    if (payload.email !== undefined) {
      updateData.email = payload.email;
    }

    if (payload.position !== undefined) {
      updateData.position = payload.position;
    }

    if (payload.experience !== undefined) {
      updateData.experience = Number(payload.experience);
    }

    if (payload.password !== undefined && payload.password.trim() !== '') {
      updateData.password = await hashPassword(payload.password);
    }

    if (file) {
      updateData.photo = await this.cloudinaryService.uploadFile(file, 'teachers');
    } else if (payload.photo !== undefined) {
      updateData.photo = payload.photo;
    }

    await this.prisma.teacher.update({ where: { id }, data: updateData });
    return { success: true, message: 'Teacher updated successfully' };
  }

  async deleteTeacher(id: number) {
    const teacher = await this.prisma.teacher.findUnique({ where: { id } });
    if (!teacher) throw new NotFoundException(`Not found teacherId ${id}`);

    // 1. Teacher ga bog'liq grouplarni topamiz
    const groups = await this.prisma.group.findMany({
      where: { teacherId: id },
      select: { id: true },
    });
    const groupIds = groups.map((g) => g.id);

    // 2. Grouplar ichidagi lessonlarni topamiz
    const lessons = await this.prisma.lesson.findMany({
      where: { groupId: { in: groupIds } },
      select: { id: true },
    });
    const lessonIds = lessons.map((l) => l.id);

    const homeworks = await this.prisma.homework.findMany({
      where: { lessonId: { in: lessonIds } },
      select: { id: true },
    });
    const homeworkIds = homeworks.map((h) => h.id);

    await this.prisma.homeworkResult.deleteMany({
      where: { homeworkId: { in: homeworkIds } },
    });

    await this.prisma.homeworkResponse.deleteMany({
      where: { homeworkId: { in: homeworkIds } },
    });

    await this.prisma.rating.deleteMany({
      where: { teacherId: id },
    });

    await this.prisma.homeworkResult.deleteMany({
      where: { teacherId: id },
    });

    await this.prisma.attendance.deleteMany({
      where: { lessonId: { in: lessonIds } },
    });

    await this.prisma.lessonVideo.deleteMany({
      where: { lessonId: { in: lessonIds } },
    });

    await this.prisma.homework.deleteMany({
      where: { lessonId: { in: lessonIds } },
    });

    await this.prisma.lesson.deleteMany({
      where: { groupId: { in: groupIds } },
    });

    await this.prisma.studentGroup.deleteMany({
      where: { groupId: { in: groupIds } },
    });

    await this.prisma.group.deleteMany({
      where: { teacherId: id },
    });

    await this.prisma.teacher.delete({ where: { id } });

    return { success: true, message: 'Teacher deleted successfully' };
  }

  async getMyGroups(currentUser: { id: number }) {
    const groups = await this.prisma.group.findMany({
      where: { teacherId: currentUser.id, status: Status.ACTIVE },
      include: {
        course: { select: { name: true } },
        room: { select: { name: true } },
        _count: { select: { studentGroup: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    return {
      success: true,
      data: groups.map((group) => ({
        id: group.id,
        name: group.name,
        courseName: group.course?.name || '-',
        startDate: group.startDate,
        lessonTime: group.startTime,
        roomName: group.room?.name || '-',
        lessonDays: group.weekDays,
        studentsCount: group._count?.studentGroup || 0,
      })),
    };
  }

  async getMyProfile(currentUser: { id: number }) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        experience: true,
        photo: true,
      },
    });

    if (!teacher) throw new NotFoundException('Teacher is Not found');

    const groupsCount = await this.prisma.group.count({
      where: { teacherId: currentUser.id },
    });

    return {
      success: true,
      data: {
        ...teacher,
        groupsCount,
      },
    };
  }
}