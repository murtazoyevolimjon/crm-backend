import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/guard/decorator.roles';
import { CreateGroupDto } from './dto/create-group.dto';

@Controller('groups')
@ApiBearerAuth()
export class GroupsController {
  constructor(private readonly groupService: GroupsService) {}

  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}, ${Role.TEACHER}` })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN', 'TEACHER')
  @Get('students/:groupId')
  getAllStudentGroupById(
    @Param('groupId', ParseIntPipe) groupId: number
  ) {
    return this.groupService.getAllStudentGroupById(groupId);
  }

  @ApiOperation({ summary: `${Role.SUPERADMIN}, ${Role.ADMIN}, ${Role.TEACHER}` })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN', 'TEACHER')
  @Get('lesson/:groupId')
  getGroupLessons(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Req() req: Request,
  ) {
    return this.groupService.getGroupLessons(groupId, req['user']);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('all')
  getAllGroup() {
    return this.groupService.getAllGroup();
  }

  // ✅ Yangi: GET /groups/:id
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.TEACHER)
  @Get(':id')
  getGroupById(@Param('id', ParseIntPipe) id: number) {
    return this.groupService.getGroupById(id);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post()
  createGroup(@Body() payload: CreateGroupDto, @Req() req: Request) {
    return this.groupService.createGroup(payload, req['user']);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Patch(':id')
  updateGroup(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: Partial<CreateGroupDto>,
  ) {
    return this.groupService.updateGroup(id, payload);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Delete(':id')
  deleteGroup(@Param('id', ParseIntPipe) id: number) {
    return this.groupService.deleteGroup(id);
  }
}