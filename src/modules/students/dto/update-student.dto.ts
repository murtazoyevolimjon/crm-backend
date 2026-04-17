import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStudentDto {
    @ApiPropertyOptional({ example: 'Ali Valiyev' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsOptional()
    @IsString()
    @MaxLength(120)
    fullName?: string;

    @ApiPropertyOptional({ example: 'student@mail.com' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: 'qwerty123' })
    @IsOptional()
    @IsString()
    password?: string;

    @ApiPropertyOptional({ example: '2007-01-25' })
    @IsOptional()
    @IsDateString()
    birth_date?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    photo?: string;
}