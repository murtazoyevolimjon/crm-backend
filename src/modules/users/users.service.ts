import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { MailerService } from 'src/common/email/mailer.service';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { CreateUserDto } from './dto/create-user.dto';
import { hashPassword } from 'src/common/bcrypt/bcrypt';
import { isPrismaUniqueConstraintError } from 'src/common/prisma/prisma-error.helper';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService,
    private cloudinaryService: CloudinaryService,
  ) { }

  async createUser(payload: CreateUserDto, file?: Express.Multer.File) {
    const parsedHireDate = new Date(payload.hire_date);
    if (Number.isNaN(parsedHireDate.getTime())) {
      throw new BadRequestException('Ishga kirgan sana noto‘g‘ri formatda yuborilgan');
    }

    try {
      const [hashedPassword, photoUrl] = await Promise.all([
        hashPassword(payload.password),
        file ? this.cloudinaryService.uploadFile(file, 'users') : Promise.resolve<string | null>(null),
      ]);

      await this.prisma.user.create({
        data: {
          ...payload,
          password: hashedPassword,
          hire_date: parsedHireDate,
          photo: photoUrl,
        },
      });

      // Employee creation should not fail because of mail server issues.
      this.mailerService
        .sendEmail(payload.email, payload.email, payload.password)
        .catch((mailError: unknown) => {
          const message = mailError instanceof Error ? mailError.message : 'Unknown mailer error';
          this.logger.warn(`User created, but email not sent: ${message}`);
        });

      return {
        success: true,
        message: 'User successfully created',
      };
    } catch (error: unknown) {
      if (isPrismaUniqueConstraintError(error, 'email')) {
        throw new ConflictException('Bu email allaqachon mavjud');
      }

      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Create user failed: ${message}`);
      throw new InternalServerErrorException('Xodim yaratishda server xatoligi');
    }
  }

  async getAllUsers() {
    const users = await this.prisma.user.findMany();

    return {
      success: true,
      data: users,
    };
  }

  async getOneUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User is Not found');
    }

    return {
      success: true,
      data: user,
    };
  }

  async updateUser(id: number, payload: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User is Not found');
    }

    const updateData = { ...payload };
    if (payload.password) {
      updateData.password = await hashPassword(payload.password);
    }

    await this.prisma.user.update({ where: { id }, data: updateData });

    return {
      success: true,
      message: 'User updated successfully',
    };
  }

  async deleteUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User is Not found');
    }
    await this.prisma.user.delete({ where: { id } });

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }
}