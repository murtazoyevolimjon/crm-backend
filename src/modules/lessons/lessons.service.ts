import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { Role, Status } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class LessonsService {
    constructor(private prisma: PrismaService) { }

    async getLessonById(groupId: number) {
        const existGroup = await this.prisma.group.findUnique({
            where: { id: groupId, status: Status.ACTIVE }
        })

        if (!existGroup) {
            throw new NotFoundException("Group not found with this id")
        }

        const lessons = await this.prisma.lesson.findMany({
            where: {
                groupId
            },
            select: {
                id: true,
                title: true,
            }
        })
        return {
            success: true,
            data: lessons
        }
    }  
             
    async createLesson(payload: CreateLessonDto, currentUser: { id: number, role: Role }) {
        const existGroup = await this.prisma.group.findUnique({
            where: { id: payload.groupId, status: Status.ACTIVE }
        })

        if (!existGroup) {
            throw new NotFoundException("Group not found with this id")
        }

        await this.prisma.lesson.create({
            data: {
                ...payload,
                teacherId: currentUser.role == Role.TEACHER ? currentUser.id : null,
                userId: currentUser.role != Role.TEACHER ? currentUser.id : null
            }
        })
        return {
            success: true,
            message: "Lesson created successfully"
        }
    }
}