import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class CourseService {
  constructor(private prisma: PrismaService) {}

  async getAllCourse() {
    const courses = await this.prisma.course.findMany({
      where: { status: 'ACTIVE' },
    });
    return { success: true, data: courses };
  }

  async createCourse(payload: CreateCourseDto) {
    const existCourse = await this.prisma.course.findUnique({
      where: { name: payload.name },
    });
    if (existCourse) {
      throw new ConflictException('Course name already exist');
    }
    await this.prisma.course.create({ data: payload });
    return { success: true, message: 'Course created' };
  }

  async updateCourse(id: number, payload: Partial<CreateCourseDto>) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');

    await this.prisma.course.update({
      where: { id },
      data: payload,
    });
    return { success: true, message: 'Course updated' };
  }

  async deleteCourse(id: number) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');

    await this.prisma.course.delete({ where: { id } });
    return { success: true, message: 'Course deleted' };
  }
}