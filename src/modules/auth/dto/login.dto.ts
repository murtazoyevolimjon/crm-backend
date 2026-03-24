import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: "murtazoyevolimjon54@gmail.com"})
  @ApiProperty()
  @IsEmail()
  email: string

  @ApiProperty({ example: "qwerty123"})
  @IsString()
  password: string
}