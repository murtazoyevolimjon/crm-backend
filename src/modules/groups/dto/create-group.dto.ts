import { IsInt, IsString, IsEnum, IsArray, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { WeekDays } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGroupDto {
    @ApiProperty({ example: 1})
    @IsInt()
    @Type(() => Number)
    teacherId: number

    @ApiProperty({ example: 1})
    @IsInt()
    @Type(() => Number)
    roomId: number

    @ApiProperty({ example: 1})
    @IsInt()
    @Type(() => Number)
    courseId: number

    @ApiProperty({ example: "string"})
    @IsString()
    name: string

    @ApiProperty({ example: new Date().toLocaleDateString()})
    @IsDateString()
    startDate: string

    @ApiProperty({ example: new Date().toLocaleTimeString()})
    @IsString()
    startTime: string

    @ApiProperty()
    @IsArray()
    @IsEnum(WeekDays, { each: true })
    weekDays: WeekDays[]

}