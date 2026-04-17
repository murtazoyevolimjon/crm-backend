import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MailerService } from 'src/common/email/mailer.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { hashPassword } from 'src/common/bcrypt/bcrypt';
import { UpdateStudentDto } from './dto/update-student.dto';
import { isPrismaUniqueConstraintError } from 'src/common/prisma/prisma-error.helper';
import { Prisma, Status, UserStatus } from '@prisma/client';
import { generateRandomPassword } from 'src/common/utils/password.util';

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService,
    private cloudinaryService: CloudinaryService,
  ) { }

  private parseBirthDateOrThrow(value: string): Date {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('birth_date noto‘g‘ri formatda yuborilgan');
    }

    return parsedDate;
  }

  async getMyGroups(currentUser: { id: number }) {
    const groups = await this.prisma.studentGroup.findMany({
      where: { studentId: currentUser.id, status: 'ACTIVE' },
      select: {
        group: {
          select: {
            id: true,
            name: true,
            startDate: true,
            course: { select: { name: true } },
            teacher: { select: { fullName: true } },
          },
        },
      },
    });
    return {
      success: true,
      data: groups.map((g) => ({
        id: g.group.id,
        name: g.group.name,
        startDate: g.group.startDate,
        courseName: g.group.course?.name ?? null,
        teacherName: g.group.teacher?.fullName ?? null,
      })),
    };
  }

  async getMyDashboard(currentUser: { id: number }) {
    const groups = await this.prisma.studentGroup.findMany({
      where: { studentId: currentUser.id, status: 'ACTIVE' },
      select: { groupId: true },
    });

    const groupIds = groups.map((g) => g.groupId);
    if (groupIds.length === 0) {
      return { success: true, data: [] };
    }

    const lessons = await this.prisma.lesson.findMany({
      where: { groupId: { in: groupIds } },
      select: {
        id: true,
        title: true,
        created_at: true,
        group: {
          select: {
            name: true,
            startTime: true,
            room: { select: { name: true } },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    return {
      success: true,
      data: lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        date: lesson.created_at,
        time: lesson.group.startTime,
        roomName: lesson.group.room?.name || null,
        groupName: lesson.group.name,
      })),
    };
  }

  async getMyGroupLessonVideo(groupId: number, currentUser: { id: number }) {
    const exitGroup = await this.prisma.studentGroup.findFirst({
      where: { groupId, studentId: currentUser.id, status: 'ACTIVE' },
    });
    if (!exitGroup) throw new NotFoundException('Group not found');

    const lessonVideo = await this.prisma.lessonVideo.findMany({
      where: { lesson: { groupId } },
      select: {
        id: true,
        file: true,
        created_at: true,
        lesson: { select: { id: true, title: true } },
        teacher: { select: { fullName: true } },
        user: { select: { fullName: true } },
      },
    });
    return {
      success: true,
      data: lessonVideo.map((item) => ({
        id: item.id,
        file: item.file,
        created_at: item.created_at,
        lesson: item.lesson,
        uploadedBy: item.teacher?.fullName || item.user?.fullName || null,
      })),
    };
  }

  async getMyGroupHomework(groupId: number, lessonId: number, currentUser: { id: number }) {
    const existsGroup = await this.prisma.studentGroup.findFirst({
      where: { studentId: currentUser.id, groupId, status: 'ACTIVE' },
      select: { id: true },
    });

    if (!existsGroup) throw new NotFoundException('Group not found');

    const group = await this.prisma.homework.findFirst({
      where: { lesson: { groupId }, lessonId },
      select: {
        id: true,
        title: true,
        file: true,
        durationTime: true,
        created_at: true,
        teacher: { select: { fullName: true } },
        user: { select: { fullName: true } },
      },
    });
    if (!group) throw new NotFoundException('Homework is Not found');

    const [response, result] = await this.prisma.$transaction([
      this.prisma.homeworkResponse.findFirst({
        where: { homeworkId: group.id, studentId: currentUser.id },
        select: { id: true, title: true, file: true, created_at: true },
      }),
      this.prisma.homeworkResult.findFirst({
        where: { homeworkId: group.id, studentId: currentUser.id },
        select: { id: true, score: true, status: true, title: true },
      }),
    ]);

    return {
      success: true,
      data: {
        homework: {
          id: group.id,
          title: group.title,
          file: group.file,
          durationTime: group.durationTime,
          created_at: group.created_at,
          uploadedBy: group.teacher?.fullName || group.user?.fullName || null,
        },
        response,
        result,
      },
    };
  }

  async getMyLessons(groupId: number, currentUser: { id: number }) {
    const existsGroup = await this.prisma.studentGroup.findFirst({
      where: { studentId: currentUser.id, groupId, status: 'ACTIVE' },
    });
    if (!existsGroup) throw new NotFoundException('Group not found');

    const lessons = await this.prisma.lesson.findMany({
      where: { groupId },
      select: { id: true, title: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: lessons };
  }

  async uploadStudentPhoto(file: Express.Multer.File) {
    const photoUrl = await this.cloudinaryService.uploadFile(file, 'students');
    return {
      success: true,
      message: 'Student rasmi muvaffaqiyatli yuklandi',
      data: {
        photo: photoUrl,
      },
    };
  }

  async createStudent(payload: CreateStudentDto, file?: Express.Multer.File) {
    const birthDate = this.parseBirthDateOrThrow(payload.birth_date);

    const passwordHashPromise = hashPassword(payload.password);
    const photoUrlPromise = file
      ? this.cloudinaryService.uploadFile(file, 'students')
      : Promise.resolve(payload.photo ?? null);

    try {
      const [passwordHash, photoUrl] = await Promise.all([
        passwordHashPromise,
        photoUrlPromise,
      ]);

      const createdStudent = await this.prisma.student.create({
        data: {
          fullName: payload.fullName,
          email: payload.email,
          password: passwordHash,
          photo: photoUrl,
          birth_date: birthDate,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          created_at: true,
        },
      });

      // Mail yuborishni background rejimda qoldiramiz, create javobini sekinlashtirmaydi.
      this.mailerService.sendEmail(payload.email, payload.email, payload.password)
        .catch((err) => console.error('Email error:', err));

      return {
        success: true,
        message: 'Student muvaffaqiyatli yaratildi',
        data: createdStudent,
      };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error, 'email')) {
        throw new ConflictException('Bu email bilan student allaqachon mavjud');
      }
      throw error;
    }
  }

  async getAllStudents(status?: string) {
    const normalizedStatus = status?.trim().toUpperCase();

    const where: Prisma.StudentWhereInput =
      normalizedStatus === 'ACTIVE'
        ? { status: UserStatus.ACTIVE }
        : normalizedStatus === 'FREEZE' || normalizedStatus === 'FROZEN'
          ? { status: { in: [UserStatus.FREEZE, UserStatus.INACTIVE] } }
          : normalizedStatus === 'INACTIVE'
            ? { status: UserStatus.INACTIVE }
            : {};

    const Students = await this.prisma.student.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        photo: true,
        birth_date: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: Students };
  }

  async resetStudentPassword(id: number) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!student) {
      throw new NotFoundException('Student is Not found');
    }

    const temporaryPassword = generateRandomPassword(8);
    const hashedPassword = await hashPassword(temporaryPassword);

    await this.prisma.student.update({
      where: { id },
      data: { password: hashedPassword },
    });

    this.mailerService
      .sendEmail(student.email, student.email, temporaryPassword)
      .catch((err) => console.error('Email error:', err));

    return {
      success: true,
      message: 'Student paroli yangilandi',
      data: {
        temporaryPassword,
      },
    };
  }

  async getDashboardSummaryStats() {
    const [totalStudents, activeStudents, frozenStudents, groupsCount] = await this.prisma.$transaction([
      this.prisma.student.count(),
      this.prisma.student.count({
        where: {
          status: UserStatus.ACTIVE,
        },
      }),
      this.prisma.student.count({
        where: {
          status: {
            in: [UserStatus.FREEZE, UserStatus.INACTIVE],
          },
        },
      }),
      this.prisma.group.count({
        where: {
          status: Status.ACTIVE,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        activeStudents,
        totalStudents,
        groups: groupsCount,
        frozen: frozenStudents,
        archived: 0,
      },
    };
  }

  async getOneStudent(id: number) {
    const Student = await this.prisma.student.findUnique({ where: { id } });
    if (!Student) throw new NotFoundException('Student is Not found');
    return { success: true, data: Student };
  }

  async updateStudent(id: number, payload: UpdateStudentDto, file?: Express.Multer.File) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!student) throw new NotFoundException('Student is Not found');

    if (payload.email && payload.email !== student.email) {
      const existingStudent = await this.prisma.student.findUnique({
        where: { email: payload.email },
        select: { id: true },
      });

      if (existingStudent) {
        throw new ConflictException('Bu email bilan student allaqachon mavjud');
      }
    }

    const updateData: Prisma.StudentUpdateInput = {};

    if (payload.fullName !== undefined) {
      updateData.fullName = payload.fullName;
    }

    if (payload.email !== undefined) {
      updateData.email = payload.email;
    }

    if (file) {
      updateData.photo = await this.cloudinaryService.uploadFile(file, 'students');
    } else if (payload.photo !== undefined) {
      updateData.photo = payload.photo;
    }

    if (payload.password) {
      updateData.password = await hashPassword(payload.password);
    }

    if (payload.birth_date) {
      updateData.birth_date = this.parseBirthDateOrThrow(payload.birth_date);
    }

    try {
      const updatedStudent = await this.prisma.student.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          updated_at: true,
        },
      });

      return {
        success: true,
        message: 'Student muvaffaqiyatli yangilandi',
        data: updatedStudent,
      };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error, 'email')) {
        throw new ConflictException('Bu email bilan student allaqachon mavjud');
      }
      throw error;
    }
  }

  async deleteStudent(id: number) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student is Not found');

    if (student.status === UserStatus.FREEZE) {
      return { success: true, message: 'Student allaqachon muzlatilgan' };
    }

    await this.prisma.studentGroup.deleteMany({ where: { studentId: id } });
    await this.prisma.attendance.deleteMany({ where: { studentId: id } });

    await this.prisma.student.update({
      where: { id },
      data: { status: UserStatus.FREEZE },
    });

    return { success: true, message: 'Student muzlatildi' };
  }
}