import { Module } from '@nestjs/common';
import { MailerModule as NestMilerModule } from '@nestjs-modules/mailer';

@Module({
  imports: [
    NestMilerModule.forRoot({
      transport: {
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
      },
      defaults: {
        from: `Murtazoyev Olimjon" <${process.env.GMAIL_USER}>`,
      },
    }),
  ],
})
export class MailerModule {}
