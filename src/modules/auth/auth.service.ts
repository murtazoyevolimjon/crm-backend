import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';
import { compare as comparePassword } from 'bcrypt';

type JwtPayload = {
  id: number;
  email: string;
  role: Role;
};

type AuthResponseUser = {
  id: number;
  email: string;
  role: Role;
  fullName: string;
  avatar: string | null;
};

type LoginCandidate = AuthResponseUser & {
  password: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  private async generateToken(payload: JwtPayload): Promise<string> {
    if (!payload.id || !payload.email || !payload.role) {
      throw new InternalServerErrorException('Token payload noto‘g‘ri shakllangan');
    }

    if (!this.configService.get<string>('JWT_SECRET')) {
      throw new InternalServerErrorException('JWT konfiguratsiyasi topilmadi');
    }

    try {
      return await this.jwtService.signAsync(payload);
    } catch {
      throw new InternalServerErrorException(
        'Token yaratishda xatolik yuz berdi. JWT sozlamalarini tekshiring',
      );
    }
  }


  private async authorizeCandidate(
    candidate: LoginCandidate | null,
    password: string,
    errorMessage: string,
  ) {
    if (!candidate) {
      throw new UnauthorizedException(errorMessage);
    }

    await this.verifyPasswordOrThrow(password, candidate.password, errorMessage);

    const { password: _password, ...user } = candidate;
    return this.buildLoginResponse(user);
  }
  private async verifyPasswordOrThrow(
    password: string,
    hash: string | null,
    message: string,
  ): Promise<void> {
    if (!hash) {
      throw new UnauthorizedException(message);
    }

    const isPasswordValid = await comparePassword(password, hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException(message);
    }
  }

  private async buildLoginResponse(user: AuthResponseUser) {
    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.generateToken(payload);

    return {
      success: true,
      message: 'Login muvaffaqiyatli bajarildi',
      accessToken,
      user,
    };
  }

  async loginAdmin(loginDto: LoginDto) {
    const message = 'Admin login yoki parol noto‘g‘ri';
    const user = await this.prisma.user.findFirst({
      where: {
        email: loginDto.email,
        role: {
          in: [Role.ADMIN, Role.SUPERADMIN, Role.ADMINSTRATOR],
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        password: true,
        fullName: true,
        photo: true,
      },
    });

    const candidate: LoginCandidate | null = user
      ? {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        avatar: user.photo ?? null,
        password: user.password,
      }
      : null;

    return this.authorizeCandidate(candidate, loginDto.password, message);
  }

  async loginTeacher(loginDto: LoginDto) {
    const message = 'Teacher login yoki parol noto‘g‘ri';
    const teacher = await this.prisma.teacher.findUnique({
      where: { email: loginDto.email },
      select: {
        id: true,
        email: true,
        password: true,
        fullName: true,
        photo: true,
      },
    });

    const candidate: LoginCandidate | null = teacher
      ? {
        id: teacher.id,
        email: teacher.email,
        role: Role.TEACHER,
        fullName: teacher.fullName,
        avatar: teacher.photo ?? null,
        password: teacher.password,
      }
      : null;

    return this.authorizeCandidate(candidate, loginDto.password, message);
  }

  async loginStudent(loginDto: LoginDto) {
    const message = 'Student login yoki parol noto‘g‘ri';
    const student = await this.prisma.student.findUnique({
      where: { email: loginDto.email },
      select: {
        id: true,
        email: true,
        password: true,
        fullName: true,
        photo: true,
      },
    });

    const candidate: LoginCandidate | null = student
      ? {
        id: student.id,
        email: student.email,
        role: Role.STUDENT,
        fullName: student.fullName,
        avatar: student.photo ?? null,
        password: student.password,
      }
      : null;

    return this.authorizeCandidate(candidate, loginDto.password, message);
  }
}