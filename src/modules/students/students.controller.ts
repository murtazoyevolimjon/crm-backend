import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { StudentsService } from './students.service';
import { AuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { CreateStudentDto } from './dto/create-student.dto';
import { Roles } from 'src/common/guard/decorator.roles';
import { AuthService } from 'src/modules/auth/auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('students')
@ApiBearerAuth()
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly authService: AuthService,
  ) { }

  @ApiOperation({ summary: `${Role.STUDENT}` })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Get("my/groups")
  GetMyGroups(@Req() req: Request) {
    return this.studentsService.getMyGroups(req["user"])
  }

  @ApiOperation({ summary: `${Role.STUDENT}` })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Get("my/group/lessonVideo/:groupId")
  GetMyGroupLessonVideo(
    @Param("groupId", ParseIntPipe) groupId: number,
    @Req() req: Request
  ) {
    return this.studentsService.getMyGroupLessonVideo(groupId, req["user"])
  }

  @ApiOperation({ summary: `${Role.STUDENT}` })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Get("my/lessons/:groupId")
  GetMyLessons(
    @Param("groupId", ParseIntPipe) groupId: number,
    @Req() req: Request
  ) {
    return this.studentsService.getMyLessons(groupId, req["user"])
  }

  @ApiOperation({ summary: `${Role.STUDENT}` })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Get("my/group/homework/:groupId")
  GetMyGroupsHomework(
    @Param("groupId", ParseIntPipe) groupId: number,
    @Query("lessonId", ParseIntPipe) lessonId: number,
    @Req() req: Request
  ) {
    return this.studentsService.getMyGroupHomework(groupId, lessonId, req["user"])
  }

  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}` })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: { type: 'string' },
        email: { type: 'string' },
        password: { type: 'string' },
        birth_date: { type: 'string', example: '2026-01-02' },
        photo: { type: 'string', format: 'binary', nullable: true },
      },
    },
  })
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage() }))
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post()
  createStudent(
    @Body() payload: CreateStudentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.studentsService.createStudent(payload, file);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}` })
  @Get('all')
  getAllStudent() {
    return this.studentsService.getAllStudents();
  }

  @Get(':id')
  getOneStudent(@Param('id') id: string) {
    return this.studentsService.getOneStudent(+id);
  }

  // ← DELETE endpoint qo'shildi
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}` })
  @Delete(':id')
  deleteStudent(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.deleteStudent(id);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}