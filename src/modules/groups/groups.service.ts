import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, Status } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
    constructor(private prisma: PrismaService) { }

    async getAllStudentGroupById(groupId: number) {
        const groups = await this.prisma.studentGroup.findMany({
            where: { groupId, status: Status.ACTIVE },
            select: {
                id: true,
                student: {
                    select: { id: true, fullName: true, photo: true, email: true }
                }
            }
        });
        return { success: true, data: groups.map(g => g.student) };
    }

    async getGroupLessons(groupId: number, currentUser: { id: number, role: Role }) {
        const existGroup = await this.prisma.group.findUnique({
            where: { id: groupId, status: Status.ACTIVE }
        });
        if (!existGroup) throw new NotFoundException("Group not found");

        if (currentUser.role == Role.TEACHER && existGroup.teacherId != currentUser.id) {
            throw new ForbiddenException("Bu sening guruhing emas");
        }

        const lessons = await this.prisma.lesson.findMany({ where: { groupId } });
        return { success: true, data: lessons };
    }

    async getAllGroup() {
        const groups = await this.prisma.group.findMany({
            where: { status: Status.ACTIVE },
            include: {
                course: {
                    select: { name: true, durationLesson: true }
                },
                room: {
                    select: { name: true }
                },
                teacher: {
                    select: { fullName: true }
                },
                user: {
                    select: { fullName: true }
                },
                studentGroup: {
                    where: { status: Status.ACTIVE },
                    select: { id: true }
                }
            }
        });

        const formatted = groups.map(group => ({
            id: group.id,
            name: group.name,
            status: group.status,
            courseName: group.course?.name || '-',
            lessonDurationMinutes: group.course?.durationLesson || 0,
            lessonTime: group.startTime,
            weekDays: group.weekDays,
            startDate: group.startDate,
            roomName: group.room?.name || null,
            teacherName: group.teacher?.fullName || null,
            createdBy: group.user?.fullName || null,
            studentsCount: group.studentGroup.length,
        }));

        return { success: true, data: formatted };
    }

    async getGroupById(id: number) {
        const group = await this.prisma.group.findUnique({
            where: { id },
            include: {
                course: {
                    // ✅ Teacher da phone yo'q, Course da price Decimal
                    select: { id: true, name: true, durationLesson: true, price: true }
                },
                room: {
                    select: { id: true, name: true }
                },
                teacher: {
                    // ✅ Teacher modelida phone maydoni yo'q — olib tashlandi
                    select: { id: true, fullName: true, position: true }
                },
                studentGroup: {
                    where: { status: Status.ACTIVE },
                    select: {
                        student: {
                            select: { id: true, fullName: true, photo: true }
                        }
                    }
                }
            }
        });

        if (!group) throw new NotFoundException("Group not found");

        return {
            success: true,
            data: {
                id: group.id,
                name: group.name,
                status: group.status,
                courseName: group.course?.name || '-',
                courseId: String(group.courseId),
                roomId: group.roomId ? String(group.roomId) : null,
                roomName: group.room?.name || null,
                // ✅ Decimal → Number
                price: group.course?.price ? Number(group.course.price) : 0,
                lessonDays: group.weekDays,
                lessonTime: group.startTime,
                lessonDurationMinutes: group.course?.durationLesson || 0,
                startDate: group.startDate,
                endDate: null,
                teachers: group.teacher ? [{
                    id: String(group.teacher.id),
                    fullName: group.teacher.fullName,
                    // ✅ phone o'rniga position
                    phone: group.teacher.position || null,
                }] : [],
                students: group.studentGroup.map(sg => ({
                    id: String(sg.student.id),
                    fullName: sg.student.fullName,
                    photo: sg.student.photo,
                })),
            }
        };
    }

    async updateGroup(id: number, payload: Partial<CreateGroupDto>) {
        const existGroup = await this.prisma.group.findUnique({ where: { id } });
        if (!existGroup) throw new NotFoundException("Group not found");

        const { endDate, studentIds, ...groupData } = payload as any;

        await this.prisma.group.update({
            where: { id },
            data: {
                ...groupData,
                ...(groupData.startDate && { startDate: new Date(groupData.startDate) }),
            }
        });

        return { success: true, message: "Group updated" };
    }

    async deleteGroup(id: number) {
        const existGroup = await this.prisma.group.findUnique({ where: { id } });
        if (!existGroup) throw new NotFoundException("Group not found");

        await this.prisma.group.update({
            where: { id },
            data: { status: Status.INACTIVE }
        });

        return { success: true, message: "Group deleted" };
    }

    async createGroup(payload: CreateGroupDto, currentUser: { id: number }) {
        const existTeacher = await this.prisma.teacher.findFirst({
            where: { id: payload.teacherId, status: Status.ACTIVE }
        });
        if (!existTeacher) throw new NotFoundException("Teacher not found with this id");

        const existCourse = await this.prisma.course.findFirst({
            where: { id: payload.courseId, status: Status.ACTIVE },
            select: { durationLesson: true }
        });
        if (!existCourse) throw new NotFoundException("Course not found with this id");

        const existRoom = await this.prisma.room.findFirst({
            where: { id: payload.roomId, status: Status.ACTIVE }
        });
        if (!existRoom) throw new NotFoundException("Room not found with this id");

        const existGroup = await this.prisma.group.findUnique({
            where: { name: payload.name }
        });
        if (existGroup) throw new ConflictException("Group already exist with this name");

        function timeToMinutes(time: string): number {
            const [hour, minute] = time.split(':').map(Number);
            return hour * 60 + minute;
        }

        const roomGroups = await this.prisma.group.findMany({
            where: { roomId: payload.roomId, status: Status.ACTIVE },
            select: {
                startTime: true,
                weekDays: true,
                course: { select: { durationLesson: true } }
            }
        });

        const newStartMinute = timeToMinutes(payload.startTime);
        const newEndMinute = newStartMinute + existCourse.durationLesson;

        const roomBusy = roomGroups.every(roomGroup => {
            const startMinute = timeToMinutes(roomGroup.startTime);
            const endMinute = startMinute + roomGroup.course.durationLesson;
            return startMinute >= newEndMinute || endMinute <= newStartMinute;
        });

        if (!roomBusy) throw new BadRequestException("Bu vaqtga xona band");

        const { endDate, studentIds, ...groupData } = payload as any;

        await this.prisma.group.create({
            data: {
                ...groupData,
                userId: currentUser.id,
                startDate: new Date(payload.startDate),
            }
        });

        return { success: true, message: "Group created" };
    }
}