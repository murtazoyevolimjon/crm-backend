import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { comparePassword } from 'src/common/bcrypt/bcrypt';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { Role } from '@prisma/client';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private async generateToken(payload: { id: number; email: string; role: Role }) {
    return await this.jwtService.sign(payload);
  }

  async login(payload: LoginDto) {
    const existEmail = await this.prisma.user.findFirst({
      where: { email: payload.email },
    });

    if (!existEmail) throw new BadRequestException('Login or password wrong');

    if (!(await comparePassword(payload.password, existEmail.password))) {
      throw new BadRequestException('Login or password wrong');
    }

    const accessToken = await this.generateToken({
      id: existEmail.id,
      email: existEmail.email,
      role: existEmail.role,
    });

    return {
      success: true,
      accessToken,
      user: {
        id: String(existEmail.id),
        fullName: existEmail.fullName,
        role: existEmail.role,
        avatar: existEmail.photo ?? null,
      },
    };
  }

  async loginTeacher(payload: LoginDto) {
    const existEmail = await this.prisma.teacher.findFirst({
      where: { email: payload.email },
    });

    if (!existEmail) throw new BadRequestException('Login or password wrong');

    if (!(await comparePassword(payload.password, existEmail.password))) {
      throw new BadRequestException('Login or password wrong');
    }

    const accessToken = await this.generateToken({
      id: existEmail.id,
      email: existEmail.email,
      role: Role.TEACHER,
    });

    return {
      success: true,
      accessToken,
      user: {
        id: String(existEmail.id),
        fullName: existEmail.fullName,
        role: Role.TEACHER,
        avatar: existEmail.photo ?? null,
      },
    };
  }

  async loginStudent(payload: LoginDto) {
    const existEmail = await this.prisma.student.findFirst({
      where: { email: payload.email },
    });

    if (!existEmail) throw new BadRequestException('Login or password wrong');

    if (!(await comparePassword(payload.password, existEmail.password))) {
      throw new BadRequestException('Login or password wrong');
    }

    const accessToken = await this.generateToken({
      id: existEmail.id,
      email: existEmail.email,
      role: Role.STUDENT,
    });

    return {
      success: true,
      accessToken,
      user: {
        id: String(existEmail.id),
        fullName: existEmail.fullName,
        role: Role.STUDENT,
        avatar: existEmail.photo ?? null,
      },
    };
  }
}