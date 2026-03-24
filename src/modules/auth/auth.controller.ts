import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@Controller('auth')
@ApiBearerAuth()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'SuperAdmin login' })
  @Post('login/admin')
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @ApiOperation({ summary: 'Teacher login' })
  @Post('login/teacher')
  loginTeacher(@Body() payload: LoginDto) {
    return this.authService.loginTeacher(payload);
  }

  @ApiOperation({ summary: 'Student login' })
  @Post('login/student')
  loginStudent(@Body() payload: LoginDto) {
    return this.authService.loginStudent(payload);
  }
}