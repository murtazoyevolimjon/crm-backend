import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Status, UserStatus } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CreateStudentGroupDto } from './dto/create-student-group.dto';

@Injectable()
export class StudentGroupService {
    constructor(private prisma: PrismaService) { }

    async createStudentGroup(payload: CreateStudentGroupDto, currentUser: { id: number }) {

        const groupStudentsCount = await this.prisma.studentGroup.count({
            where: {
                groupId: payload.groupId
            }
        })

        const existGroup = await this.prisma.group.findUnique({
            where: { id: payload.groupId, status: Status.ACTIVE },
            select: {
                room: {
                    select: {
                        capacity: true
                    }
                }
            }
        })

        if (!existGroup) {
            throw new NotFoundException("Group not found with this id")
        }

        const existStudent = await this.prisma.student.findUnique({
            where: { id: payload.studentId, status: UserStatus.ACTIVE }
        })

        if (!existStudent) {
            throw new NotFoundException("Student topilmadi yoki faol holatda emas")
        }

        if (groupStudentsCount >= existGroup!.room.capacity) {
            throw new BadRequestException("Group limit to'lgan")
        }

        const alreadyJoined = await this.prisma.studentGroup.findFirst({
            where: {
                groupId: payload.groupId,
                studentId: payload.studentId,
            },
            select: { id: true },
        });

        if (alreadyJoined) {
            throw new ConflictException("Bu o'quvchi ushbu guruhga allaqachon qo'shilgan")
        }

        await this.prisma.studentGroup.create({
            data: {
                ...payload,
                userId: currentUser.id
            }
        })

        return {
            success: true,
            message: "Student added group"
        }
    }
}