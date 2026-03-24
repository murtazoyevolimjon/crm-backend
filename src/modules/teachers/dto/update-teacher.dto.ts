import { PartialType } from '@nestjs/swagger';
import { CreateTeacherDto } from './create-teacher.dto';

export class UpdateTeachersDto extends PartialType(CreateTeacherDto) {}