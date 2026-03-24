import { Injectable, NotFoundException } from '@nestjs/common';
import { MailerService } from 'src/common/email/mailer.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { hashPassword } from 'src/common/bcrypt/bcrypt';
import { UpdateTeachersDto } from './dto/update-teacher.dto';

@Injectable()
export class TeachersService {
  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createTeacher(payload: CreateTeacherDto, file?: Express.Multer.File) {
    console.time('total');

    let photoUrl: string | null = null;
    if (file) {
      console.time('cloudinary');
      photoUrl = await this.cloudinaryService.uploadFile(file, 'teachers');
      console.timeEnd('cloudinary');
    }

    console.time('prisma');
    await this.prisma.teacher.create({
      data: {
        ...payload,
        experience: Number(payload.experience),
        password: await hashPassword(payload.password),
        photo: photoUrl,
      },
    });
    console.timeEnd('prisma');

    this.mailerService.sendEmail(payload.email, payload.email, payload.password)
      .catch((err) => console.error('Email error:', err));

    console.timeEnd('total');
    return { success: true, message: 'Teacher successfully created' };
  }

  async getAllTeachers() {
    const Teachers = await this.prisma.teacher.findMany();
    return { success: true, data: Teachers };
  }

  async getOneTeacher(id: number) {
    const Teacher = await this.prisma.teacher.findUnique({ where: { id } });
    if (!Teacher) throw new NotFoundException('Teacher is Not found');
    return { success: true, data: Teacher };
  }

  async updateTeacher(id: number, payload: UpdateTeachersDto) {
    const teacher = await this.prisma.teacher.findUnique({ where: { id } });
    if (!teacher) throw new NotFoundException('Teacher is Not found');

    const updateData: any = { ...payload };
    if (payload.experience) {
      updateData.experience = Number(payload.experience);
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
}