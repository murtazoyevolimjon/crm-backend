import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { TeachersService } from './teachers.service';
import { AuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { Roles } from 'src/common/guard/decorator.roles';
import { UpdateTeachersDto } from './dto/update-teacher.dto';

@Controller('teachers')
@ApiBearerAuth()
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: { type: 'string' },
        email: { type: 'string' },
        password: { type: 'string' },
        position: { type: 'string' },
        experience: { type: 'number', example: 4 },
        photo: { type: 'string', format: 'binary', nullable: true },
      },
    },
  })
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage() }))
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}` })
  @Post()
  createTeacher(
    @Body() payload: CreateTeacherDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.teachersService.createTeacher(payload, file);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.ADMINSTRATOR, Role.MANAGEMENT)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}, ${Role.ADMINSTRATOR}, ${Role.MANAGEMENT}` })
  @Get('all')
  getAllTeacher() {
    return this.teachersService.getAllTeachers();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.ADMINSTRATOR, Role.MANAGEMENT)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}, ${Role.ADMINSTRATOR}, ${Role.MANAGEMENT}` })
  @Get(':id')
  getOneTeacher(@Param('id') id: string) {
    return this.teachersService.getOneTeacher(+id);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.ADMINSTRATOR, Role.MANAGEMENT)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}, ${Role.ADMINSTRATOR}, ${Role.MANAGEMENT}` })
  @Put(':id') // ✅ :id qo'shildi — oldin yo'q edi!
  updateTeacher(@Param('id') id: string, @Body() payload: UpdateTeachersDto) {
    return this.teachersService.updateTeacher(+id, payload);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}` })
  @Delete(':id')
  async deleteTeacher(@Param('id', ParseIntPipe) id: number) {
    return this.teachersService.deleteTeacher(id);
  }
}