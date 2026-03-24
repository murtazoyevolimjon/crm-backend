import { MailerService as NestMailerService } from "@nestjs-modules/mailer";
import { Injectable } from "@nestjs/common";

@Injectable()
export class MailerService {
  constructor(private mailerService: NestMailerService) {}

  async sendEmail(email: string, login: string, password: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: "CRM tizimiga kirish",
      template: "index",
      context: { text: `email : ${login}\nparol : ${password}` },
    });
  }

  async sendOtpEmail(email: string, code: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: "Tasdiqlash kodi",
      template: "index",
      context: {
        text: `Sizning tasdiqlash kodingiz: ${code}\n\nKod 10 daqiqa davomida amal qiladi.`,
      },
    });
  }
}