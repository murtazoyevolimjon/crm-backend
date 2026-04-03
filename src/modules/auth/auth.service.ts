import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';
import { compare as comparePassword } from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) { }

  private async generateToken(payload: { id: number; email: string; role: Role }) {
    return await this.jwtService.sign(payload);
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findFirst({ where: { email: loginDto.email } });
    if (!user) {
      throw new BadRequestException('Login yoki parol noto‘g‘ri');
    }

    const isPasswordValid = await comparePassword(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Login yoki parol noto‘g‘ri');
    }

    const payload = { id: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      success: true,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        avatar: user.photo ?? null,
      },
    };
  }
}