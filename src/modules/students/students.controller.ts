import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { StudentsService } from './students.service';
import { AuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { CreateStudentDto } from './dto/create-student.dto';
import { Roles } from 'src/common/guard/decorator.roles';
import { AuthService } from 'src/modules/auth/auth.service';
import { LoginDto } from './dto/login.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

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
  @Get("my/dashboard")
  getMyDashboard(@Req() req: Request) {
    return this.studentsService.getMyDashboard(req["user"])
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
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: { type: 'string' },
        email: { type: 'string' },
        password: { type: 'string' },
        birth_date: { type: 'string', example: '2026-01-02' },
        photo: { type: 'string', nullable: true },
      },
    },
  })
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage() }))
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiConflictResponse({ description: 'Bu email bilan student allaqachon mavjud' })
  @ApiBadRequestResponse({ description: 'Yuborilgan ma’lumotlar noto‘g‘ri formatda' })
  @Post()
  createStudent(
    @Body() payload: CreateStudentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.studentsService.createStudent(payload, file);
  }

  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN} - Student photo upload` })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: { type: 'string', format: 'binary' },
      },
      required: ['photo'],
    },
  })
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage() }))
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiBadRequestResponse({ description: 'Yuklanayotgan fayl noto‘g‘ri yoki bo‘sh' })
  @Post('photo')
  uploadStudentPhoto(@UploadedFile() file: Express.Multer.File) {
    return this.studentsService.uploadStudentPhoto(file);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}` })
  @Get()
  listStudents(@Query('status') status?: string) {
    return this.studentsService.getAllStudents(status);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN} - Dashboard summary stats` })
  @Get('stats/summary')
  getDashboardSummaryStats() {
    return this.studentsService.getDashboardSummaryStats();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}` })
  @Get('all')
  getAllStudent(@Query('status') status?: string) {
    return this.studentsService.getAllStudents(status);
  }

  @Get(':id')
  getOneStudent(@Param('id') id: string) {
    return this.studentsService.getOneStudent(+id);
  }

  // ← DELETE endpoint qo'shildi
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
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
  @Patch(':id')
  updateStudent(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateStudentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.studentsService.updateStudent(id, payload, file);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
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
  @Put(':id')
  updateStudentPut(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateStudentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.studentsService.updateStudent(id, payload, file);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}` })
  @Delete(':id')
  deleteStudent(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.deleteStudent(id);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN} - Reset student password` })
  @Post(':id/reset-password')
  resetStudentPassword(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.resetStudentPassword(id);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.loginStudent(loginDto);
  }
}