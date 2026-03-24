import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/guard/decorator.roles';
import { CourseService } from '../course.service';
import { CreateCourseDto } from './create-course.dto';

@Controller('course')
@ApiBearerAuth()
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}` })
  @Get('all')
  getAllCourse() {
    return this.courseService.getAllCourse();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}` })
  @Post()
  createCourse(@Body() payload: CreateCourseDto) {
    return this.courseService.createCourse(payload);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}` })
  @Patch(':id')
  updateCourse(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: Partial<CreateCourseDto>,
  ) {
    return this.courseService.updateCourse(id, payload);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}` })
  @Delete(':id')
  deleteCourse(@Param('id', ParseIntPipe) id: number) {
    return this.courseService.deleteCourse(id);
  }
}