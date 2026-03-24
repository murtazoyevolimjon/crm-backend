import { Injectable, NotFoundException } from '@nestjs/common';
import { MailerService } from 'src/common/email/mailer.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { hashPassword } from 'src/common/bcrypt/bcrypt';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async getMyGroups(currentUser: { id: number }) {
    const groups = await this.prisma.studentGroup.findMany({
      where: { studentId: currentUser.id, status: 'ACTIVE' },
      select: { group: { select: { id: true, name: true } } },
    });
    return { success: true, data: groups.map((g) => g.group) };
  }

  async getMyGroupLessonVideo(groupId: number, currentUser: { id: number }) {
    const exitGroup = await this.prisma.studentGroup.findFirst({
      where: { groupId, studentId: currentUser.id, status: 'ACTIVE' },
    });
    if (!exitGroup) throw new NotFoundException('Group not found');

    const lessonVideo = await this.prisma.lessonVideo.findMany({
      where: { lesson: { groupId } },
      select: {
        id: true, file: true, created_at: true,
        lesson: { select: { id: true, title: true } },
      },
    });
    return { success: true, data: lessonVideo };
  }

  async getMyGroupHomework(groupId: number, lessonId: number, currentUser: { id: number }) {
    const group = await this.prisma.homework.findFirst({
      where: { lesson: { groupId }, lessonId },
      select: { id: true, title: true, file: true, durationTime: true, created_at: true },
    });
    if (!group) throw new NotFoundException('Homework is Not found');
    return { success: true, data: group };
  }

  async getMyLessons(groupId: number, currentUser: { id: number }) {
    const existsGroup = await this.prisma.studentGroup.findFirst({
      where: { studentId: currentUser.id, groupId, status: 'ACTIVE' },
    });
    if (!existsGroup) throw new NotFoundException('Group not found');

    const lessons = await this.prisma.lesson.findMany({
      where: { groupId },
      select: { id: true, title: true },
    });
    return { success: true, data: lessons };
  }

  async createStudent(payload: CreateStudentDto, file?: Express.Multer.File) {
    let photoUrl: string | null = null;
    if (file) {
      photoUrl = await this.cloudinaryService.uploadFile(file, 'students');
    }

    await this.prisma.student.create({
      data: {
        ...payload,
        password: await hashPassword(payload.password),
        photo: photoUrl,
        birth_date: new Date(payload.birth_date),
      },
    });

    // await yo'q — background da ishlaydi, kutmaydi
    this.mailerService.sendEmail(payload.email, payload.email, payload.password)
      .catch((err) => console.error('Email error:', err));

    return { success: true, message: 'Student successfully created' };
  }

  async getAllStudents() {
    const Students = await this.prisma.student.findMany();
    return { success: true, data: Students };
  }

  async getOneStudent(id: number) {
    const Student = await this.prisma.student.findUnique({ where: { id } });
    if (!Student) throw new NotFoundException('Student is Not found');
    return { success: true, data: Student };
  }

  async updateStudent(id: number, payload: UpdateStudentDto) {
    const Student = await this.prisma.student.findUnique({ where: { id } });
    if (!Student) throw new NotFoundException('Student is Not found');
    await this.prisma.student.update({ where: { id }, data: payload });
    return { success: true, message: 'Student updated successfully' };
  }

  async deleteStudent(id: number) {
  const student = await this.prisma.student.findUnique({ where: { id } });
  if (!student) throw new NotFoundException('Student is Not found');

  await this.prisma.studentGroup.deleteMany({ where: { studentId: id } });
  await this.prisma.attendance.deleteMany({ where: { studentId: id } });

  await this.prisma.student.delete({ where: { id } });

  return { success: true, message: 'Student deleted successfully' };
}
}