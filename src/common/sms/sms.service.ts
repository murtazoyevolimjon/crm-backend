import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

type EskizLoginResponse = {
    data?: {
        token?: string;
    };
};

@Injectable()
export class SmsService {
    private readonly logger = new Logger(SmsService.name);
    private readonly provider: string;
    private readonly eskizBaseUrl: string;
    private readonly eskizClient: AxiosInstance;

    private eskizToken: string | null = null;
    private eskizTokenExpiresAt = 0;

    constructor(private readonly configService: ConfigService) {
        this.provider = (this.configService.get<string>('SMS_PROVIDER') ?? 'mock').toLowerCase();
        this.eskizBaseUrl = this.configService.get<string>('SMS_ESKIZ_BASE_URL') ?? 'https://notify.eskiz.uz';

        this.eskizClient = axios.create({
            baseURL: this.eskizBaseUrl,
            timeout: 20000,
        });
    }

    async sendOtpCode(phoneNumber: string, code: string): Promise<void> {
        const message = this.buildOtpMessage(code);

        if (this.provider !== 'eskiz') {
            this.logger.log(`[MOCK SMS] ${phoneNumber} => ${message}`);
            return;
        }

        await this.sendViaEskiz(phoneNumber, message);
    }

    private buildOtpMessage(code: string): string {
        return `Tasdiqlash kodi: ${code}. Kod 3 daqiqa amal qiladi.`;
    }

    private normalizePhone(phone: string): string {
        const cleaned = phone.replace(/\D/g, '');

        if (cleaned.startsWith('998') && cleaned.length >= 12) {
            return cleaned;
        }

        if (cleaned.length === 9) {
            return `998${cleaned}`;
        }

        if (cleaned.length === 12) {
            return cleaned;
        }

        throw new InternalServerErrorException('Telefon raqami SMS yuborish uchun yaroqsiz');
    }

    private async getEskizToken(): Promise<string> {
        if (this.eskizToken && Date.now() < this.eskizTokenExpiresAt) {
            return this.eskizToken;
        }

        const email = this.configService.get<string>('SMS_ESKIZ_EMAIL');
        const password = this.configService.get<string>('SMS_ESKIZ_PASSWORD');

        if (!email || !password) {
            throw new InternalServerErrorException('SMS_ESKIZ_EMAIL yoki SMS_ESKIZ_PASSWORD sozlanmagan');
        }

        try {
            const response = await this.eskizClient.post<EskizLoginResponse>('/api/auth/login', {
                email,
                password,
            });

            const token = response.data?.data?.token;
            if (!token) {
                throw new Error('Eskiz token olinmadi');
            }

            this.eskizToken = token;
            this.eskizTokenExpiresAt = Date.now() + 1000 * 60 * 55;
            return token;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown eskiz login error';
            this.logger.error(`Eskiz login xatosi: ${message}`);
            throw new InternalServerErrorException('SMS gatewayga ulanishda xato');
        }
    }

    private async sendViaEskiz(phoneNumber: string, message: string): Promise<void> {
        const from = this.configService.get<string>('SMS_ESKIZ_FROM') ?? '4546';
        const normalizedPhone = this.normalizePhone(phoneNumber);

        const send = async (token: string) => {
            return this.eskizClient.post(
                '/api/message/sms/send',
                {
                    mobile_phone: normalizedPhone,
                    message,
                    from,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            );
        };

        try {
            const token = await this.getEskizToken();
            await send(token);
        } catch (error) {
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
            if (status === 401 || status === 403) {
                this.eskizToken = null;
                this.eskizTokenExpiresAt = 0;
                const token = await this.getEskizToken();
                await send(token);
                return;
            }

            const messageText = error instanceof Error ? error.message : 'Unknown eskiz send error';
            this.logger.error(`Eskiz SMS yuborishda xato: ${messageText}`);
            throw new InternalServerErrorException('SMS yuborishda xato');
        }
    }
}
