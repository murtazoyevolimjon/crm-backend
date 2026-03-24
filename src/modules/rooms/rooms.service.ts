import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async getAllRoom() {
    const rooms = await this.prisma.room.findMany({
      where: { status: 'ACTIVE' },
    });

    return {
      success: true,
      data: rooms,
    };
  }

  async createRoom(payload: CreateRoomDto) {
    const existRoom = await this.prisma.room.findUnique({
      where: { name: payload.name },
    });
    if (existRoom) {
      throw new ConflictException('Room name already exist');
    }

    await this.prisma.room.create({
      data: payload,
    });

    return {
      success: true,
      message: 'Room created',
    };
  }

  async updateRoom(id: string, payload: UpdateRoomDto) {
    const room = await this.prisma.room.findUnique({
      where: { id: Number(id) },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    await this.prisma.room.update({
      where: { id: Number(id) },
      data: payload,
    });

    return {
      success: true,
      message: 'Room updated',
    };
  }

  async deleteRoom(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: Number(id) },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    await this.prisma.room.delete({
      where: { id: Number(id) },
    });

    return {
      success: true,
      message: 'Room deleted',
    };
  }
}