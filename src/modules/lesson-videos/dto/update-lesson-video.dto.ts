import { PartialType } from '@nestjs/swagger';
import { CreateLessonVideosDto } from './create-lesson-video.dto';

export class UpdateLessonVideoDto extends PartialType(CreateLessonVideosDto) {}
