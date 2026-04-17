import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, Matches } from 'class-validator';

export class CreateHomeworkResponseDto {
  @ApiProperty({ example: 'string' })
  @IsString()
  @Matches(/\S/, { message: "Izoh majburiy" })
  title!: string;

  @ApiProperty({ example: "string" })
  @IsNumber()
  @Type(() => Number)
  homeworkId!: number;
}