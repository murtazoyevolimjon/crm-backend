import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { AuthGuard } from 'src/common/guard/jwt-auth.guard';
import { Roles } from 'src/common/guard/decorator.roles';

@Controller('lessons')
@ApiBearerAuth()
export class LessonsController {
  constructor(private readonly lessonServise: LessonsService) {}

  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}, ${Role.TEACHER}`})
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("ADMIN", "SUPERADMIN", "TEACHER")
  @Get(":groupId")
  getLessonById(@Param("groupId", ParseIntPipe) groupId: number) {
    return this.lessonServise.getLessonById(groupId);
  }

  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}, ${Role.TEACHER}`})
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN', 'TEACHER')
  @Post()
  createStudentGroup(@Body() payload: CreateLessonDto, @Req() req: Request) {
    return this.lessonServise.createLesson(payload, req['user']);
  }
}