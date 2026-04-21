import { ForbiddenException, Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';
import {
    ConfirmCardPaymentOtpDto,
    CreatePaymentDto,
    PaymentCallbackDto,
    PaymentMethodValue,
    PaymentStatusValue,
} from './dto/payment.dto';
import { KynPaymentRequest } from './interfaces/kyn.interface';
import * as crypto from 'crypto';
import { SmsService } from '@/common/sms/sms.service';

type PaymentDelegate = {
    create(args: unknown): Promise<any>;
    findUnique(args: unknown): Promise<any>;
    update(args: unknown): Promise<any>;
    findMany(args: unknown): Promise<any>;
    count(args: unknown): Promise<number>;
    aggregate(args: unknown): Promise<{ _sum: { amount: Prisma.Decimal | null } }>;
};

type PaymentTransactionDelegate = {
    upsert(args: unknown): Promise<any>;
};

type PrismaPaymentClient = PrismaService & {
    payment: PaymentDelegate;
    paymentTransaction: PaymentTransactionDelegate;
};

type CardOtpSession = {
    sessionId: string;
    otpCode: string;
    expiresAt: number;
    requesterId: number;
    amount: number;
    studentGroupId: number;
    studentId: number;
    description?: string;
    cardLast4: string;
    cardExpiry: string;
    phoneNumber: string;
};

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly kynClient: AxiosInstance;
    private readonly kynSecretKey: string;
    private readonly cardOtpSessions = new Map<string, CardOtpSession>();
    private readonly receiverCard: string;
    private readonly receiverOwner: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly smsService: SmsService,
    ) {
        const kynApiKey = this.configService.get<string>('KYN_API_KEY') ?? '';
        const kynApiUrl = this.configService.get<string>('KYN_API_URL') ?? 'https://api.kyn.uz';
        this.kynSecretKey = this.configService.get<string>('KYN_SECRET_KEY') ?? '';
        this.receiverCard = this.configService.get<string>('PAYMENT_RECEIVER_CARD') ?? '8600 0000 0000 0000';
        this.receiverOwner = this.configService.get<string>('PAYMENT_RECEIVER_OWNER') ?? "O'quv markaz hisob raqami";

        this.kynClient = axios.create({
            baseURL: kynApiUrl,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${kynApiKey}`,
            },
            timeout: 30000,
        });
    }

    private get db(): PrismaPaymentClient {
        return this.prisma as PrismaPaymentClient;
    }

    private get paymentModel(): PaymentDelegate {
        if (!this.db.payment) {
            throw new HttpException(
                'Payment model Prisma clientda yoq. npx prisma generate ni ishga tushiring.',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
        return this.db.payment;
    }

    private get paymentTransactionModel(): PaymentTransactionDelegate {
        if (!this.db.paymentTransaction) {
            throw new HttpException(
                'PaymentTransaction model Prisma clientda yoq. npx prisma generate ni ishga tushiring.',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
        return this.db.paymentTransaction;
    }

    /**
     * To'lov uchun Kyn-ga so'rov yuborish
     */
    async createPayment(createPaymentDto: CreatePaymentDto, _requesterId: number) {
        try {
            const {
                amount,
                studentGroupId,
                studentId,
                description,
                paymentMethod,
                cardLast4,
                cardExpiry,
                phoneNumber,
            } = createPaymentDto;
            const effectiveStudentId = _requesterId > 0 ? _requesterId : studentId;
            const invoiceNumber = this.generateInvoiceNumber();
            const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
            const backendUrl = this.configService.get<string>('BACKEND_URL') ?? 'http://localhost:3000';
            const method = paymentMethod ?? PaymentMethodValue.KYN;

            if (method === PaymentMethodValue.CARD && !cardLast4) {
                throw new HttpException('Karta raqamining oxirgi 4 ta belgisi talab qilinadi', HttpStatus.BAD_REQUEST);
            }

            if (method === PaymentMethodValue.CARD) {
                const safeCardLast4 = cardLast4;
                if (!safeCardLast4) {
                    throw new HttpException('Karta raqamining oxirgi 4 ta belgisi talab qilinadi', HttpStatus.BAD_REQUEST);
                }
                if (!cardExpiry) {
                    throw new HttpException('Karta muddati kiritilishi shart', HttpStatus.BAD_REQUEST);
                }
                if (!phoneNumber) {
                    throw new HttpException('SMS kod yuborish uchun telefon raqami kiritilishi shart', HttpStatus.BAD_REQUEST);
                }

                const otpSession = this.createCardOtpSession({
                    requesterId: _requesterId,
                    amount,
                    studentGroupId,
                    studentId: effectiveStudentId,
                    description,
                    cardLast4: safeCardLast4,
                    cardExpiry,
                    phoneNumber,
                });

                this.logger.log(
                    `CARD OTP sent to ${this.maskPhone(phoneNumber)}. Session=${otpSession.sessionId}, code=${otpSession.otpCode}`,
                );

                await this.smsService.sendOtpCode(phoneNumber, otpSession.otpCode);

                return {
                    success: true,
                    requiresOtp: true,
                    otpSessionId: otpSession.sessionId,
                    otpExpiresInSeconds: 180,
                    maskedPhone: this.maskPhone(phoneNumber),
                    receiver: {
                        owner: this.receiverOwner,
                        card: this.maskCard(this.receiverCard),
                    },
                    ...(this.configService.get<string>('NODE_ENV') !== 'production'
                        ? { devOtpCode: otpSession.otpCode }
                        : {}),
                };
            }

            const paymentDescription = [
                description ?? "Kurs uchun to'lov",
                cardLast4 ? `CARD ****${cardLast4}` : null,
            ]
                .filter(Boolean)
                .join(' | ');

            const kynRequest: KynPaymentRequest = {
                amount: Math.round(amount),
                currency: 'UZS',
                orderId: invoiceNumber,
                description: paymentDescription || `Kurs uchun to'lov: ${studentGroupId}`,
                returnUrl: `${frontendUrl}/student/payment/success`,
                callbackUrl: `${backendUrl}/api/payments/webhook`,
            };

            const kynResponse = await this.kynClient.post('/v1/payments/create', kynRequest);

            if (!kynResponse.data?.success) {
                throw new HttpException("Kyn bilan bog'lanishda xato", HttpStatus.BAD_GATEWAY);
            }

            const payment = await this.paymentModel.create({
                data: {
                    studentGroupId,
                    studentId: effectiveStudentId,
                    amount: new Prisma.Decimal(amount),
                    currency: 'UZS',
                    status: PaymentStatusValue.PENDING,
                    paymentMethod: method,
                    invoiceNumber,
                    paymentUrl: kynResponse.data.paymentUrl,
                    kynTransactionId: kynResponse.data.transactionId,
                    description: paymentDescription || "Kurs uchun to'lov",
                },
            });

            return {
                success: true,
                paymentId: payment.id,
                paymentUrl: payment.paymentUrl,
                invoiceNumber: payment.invoiceNumber,
                amount: payment.amount,
                receiver: {
                    owner: this.receiverOwner,
                    card: this.maskCard(this.receiverCard),
                },
            };
        } catch (error: unknown) {
            this.logger.error(`Payment creation error: ${this.getErrorMessage(error)}`);
            if (error instanceof HttpException) throw error;
            throw new HttpException("To'lov yaratishda xato", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async confirmCardPaymentOtp(confirmDto: ConfirmCardPaymentOtpDto, requesterId: number) {
        const session = this.cardOtpSessions.get(confirmDto.otpSessionId);
        if (!session) {
            throw new HttpException('OTP sessiyasi topilmadi yoki muddati tugagan', HttpStatus.BAD_REQUEST);
        }

        if (Date.now() > session.expiresAt) {
            this.cardOtpSessions.delete(confirmDto.otpSessionId);
            throw new HttpException('SMS kod muddati tugagan', HttpStatus.BAD_REQUEST);
        }

        if (session.requesterId && requesterId && session.requesterId !== requesterId) {
            throw new ForbiddenException('Bu OTP sessiyasi sizga tegishli emas');
        }

        if (session.otpCode !== confirmDto.otpCode) {
            throw new HttpException('SMS kod noto\'g\'ri', HttpStatus.BAD_REQUEST);
        }

        const invoiceNumber = this.generateInvoiceNumber();
        const description = [
            session.description ?? "Kurs uchun to'lov",
            `CARD ****${session.cardLast4}`,
            `EXP ${session.cardExpiry}`,
        ].join(' | ');

        const payment = await this.paymentModel.create({
            data: {
                studentGroupId: session.studentGroupId,
                studentId: session.studentId,
                amount: new Prisma.Decimal(session.amount),
                currency: 'UZS',
                status: PaymentStatusValue.COMPLETED,
                paymentMethod: PaymentMethodValue.CARD,
                invoiceNumber,
                description,
                paidAt: new Date(),
            },
        });

        await this.paymentTransactionModel.upsert({
            where: { transactionId: `CARD-${invoiceNumber}` },
            create: {
                paymentId: payment.id,
                transactionId: `CARD-${invoiceNumber}`,
                status: PaymentStatusValue.COMPLETED,
                amount: new Prisma.Decimal(session.amount),
                currency: 'UZS',
                kynResponse: {
                    source: 'CARD_OTP',
                    phone: this.maskPhone(session.phoneNumber),
                    card: `****${session.cardLast4}`,
                },
            },
            update: {
                status: PaymentStatusValue.COMPLETED,
                amount: new Prisma.Decimal(session.amount),
            },
        });

        this.cardOtpSessions.delete(confirmDto.otpSessionId);

        return {
            success: true,
            requiresOtp: false,
            paymentId: payment.id,
            status: PaymentStatusValue.COMPLETED,
            invoiceNumber,
            receiver: {
                owner: this.receiverOwner,
                card: this.maskCard(this.receiverCard),
            },
            message: 'To\'lov muvaffaqiyatli yakunlandi',
        };
    }

    /**
     * Kyn webhook - to'lov statusini yangilash
     */
    async handleKynWebhook(payload: PaymentCallbackDto) {
        try {
            if (!this.verifyWebhookSignature(payload)) {
                throw new HttpException('Invalid webhook signature', HttpStatus.UNAUTHORIZED);
            }

            const { transactionId, orderId, status, amount } = payload;
            const mappedStatus = this.mapKynStatusToPaymentStatus(status);

            const payment = await this.paymentModel.findUnique({
                where: { invoiceNumber: orderId },
            });

            if (!payment) {
                throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
            }

            const kynResponse: Prisma.JsonObject = {
                transactionId: payload.transactionId,
                orderId: payload.orderId,
                amount: payload.amount,
                status: payload.status,
                timestamp: payload.timestamp,
                ...(payload.signature ? { signature: payload.signature } : {}),
            };

            await this.paymentTransactionModel.upsert({
                where: { transactionId },
                create: {
                    paymentId: payment.id,
                    transactionId,
                    status: mappedStatus,
                    amount: new Prisma.Decimal(amount),
                    currency: 'UZS',
                    kynResponse,
                },
                update: {
                    status: mappedStatus,
                    amount: new Prisma.Decimal(amount),
                    kynResponse,
                },
            });

            await this.paymentModel.update({
                where: { id: payment.id },
                data: {
                    status:
                        mappedStatus === PaymentStatusValue.CANCELLED
                            ? PaymentStatusValue.FAILED
                            : mappedStatus,
                    paidAt: mappedStatus === PaymentStatusValue.COMPLETED ? new Date() : null,
                },
            });

            return { success: true, transactionId };
        } catch (error: unknown) {
            this.logger.error(`Webhook handling error: ${this.getErrorMessage(error)}`);
            if (error instanceof HttpException) throw error;
            throw new HttpException('Webhookni qayta ishlashda xato', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * To'lov statusini tekshirish
     */
    async checkPaymentStatus(transactionId: string) {
        try {
            const response = await this.kynClient.get(`/v1/payments/${transactionId}/status`);

            if (!response.data) {
                throw new HttpException('Kyn API xatosi', HttpStatus.BAD_GATEWAY);
            }

            const status = String(response.data.status);
            const dbStatus = this.mapKynStatusToPaymentStatus(status);

            return {
                success: true,
                transactionId,
                status: dbStatus,
                kynStatus: status,
            };
        } catch (error: unknown) {
            this.logger.error(`Check status error: ${this.getErrorMessage(error)}`);
            if (error instanceof HttpException) throw error;
            throw new HttpException('Statusni tekshirishda xato', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Talaba uchun barcha to'lovlarni olish
     */
    async getStudentPayments(studentId: number) {
        try {
            return await this.paymentModel.findMany({
                where: { studentId },
                include: {
                    transactions: {
                        orderBy: { created_at: 'desc' },
                    },
                },
                orderBy: { created_at: 'desc' },
            });
        } catch (error: unknown) {
            this.logger.error(`Get payments error: ${this.getErrorMessage(error)}`);
            throw new HttpException("To'lovlarni olishda xato", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * To'lovlarning statistikasini olish
     */
    async getPaymentStats(studentGroupId: number) {
        try {
            const [totalPayments, completedPayments, pendingPayments] = await Promise.all([
                this.paymentModel.count({
                    where: { studentGroupId },
                }),
                this.paymentModel.aggregate({
                    where: { studentGroupId, status: PaymentStatusValue.COMPLETED },
                    _sum: { amount: true },
                }),
                this.paymentModel.count({
                    where: { studentGroupId, status: PaymentStatusValue.PENDING },
                }),
            ]);

            return {
                totalPayments,
                completedAmount: completedPayments._sum.amount ?? new Prisma.Decimal(0),
                pendingCount: pendingPayments,
            };
        } catch (error: unknown) {
            this.logger.error(`Get stats error: ${this.getErrorMessage(error)}`);
            throw new HttpException('Statistikani olishda xato', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getAdminPaymentNotifications(role?: string) {
        const adminRoles = new Set(['ADMIN', 'SUPERADMIN', 'ADMINSTRATOR', 'MANAGEMENT']);
        if (!role || !adminRoles.has(String(role).toUpperCase())) {
            throw new ForbiddenException('Faqat adminlar uchun');
        }

        const completedPayments = await this.paymentModel.findMany({
            where: { status: PaymentStatusValue.COMPLETED },
            orderBy: { paidAt: 'desc' },
            take: 20,
        });

        const studentIds: number[] = Array.from(
            new Set(
                completedPayments
                    .map((payment: any) => Number(payment.studentId))
                    .filter((id): id is number => Number.isFinite(id)),
            ),
        );

        const students = studentIds.length
            ? await this.prisma.student.findMany({
                where: { id: { in: studentIds } },
                select: { id: true, fullName: true },
            })
            : [];

        const studentMap = new Map(students.map((student) => [student.id, student.fullName]));

        return completedPayments.map((payment: any) => {
            const numericAmount = Number(payment.amount ?? 0);
            const studentName = studentMap.get(Number(payment.studentId)) ?? `Student #${payment.studentId}`;

            return {
                id: payment.id,
                paymentId: payment.id,
                invoiceNumber: payment.invoiceNumber,
                studentId: payment.studentId,
                studentName,
                amount: numericAmount,
                currency: payment.currency ?? 'UZS',
                paidAt: payment.paidAt ?? payment.updated_at,
                message: `${studentName}dan ${numericAmount.toLocaleString('uz-UZ')} so'm to'lov tushdi`,
            };
        });
    }

    /**
     * Webhook signature tekshirish
     */
    private verifyWebhookSignature(payload: PaymentCallbackDto): boolean {
        try {
            if (!this.kynSecretKey) return true;

            const signature = payload.signature;
            if (!signature) return false;

            const dataForSign = `${payload.transactionId}${payload.orderId}${payload.amount}${payload.status}`;
            const calculatedSignature = crypto
                .createHmac('sha256', this.kynSecretKey)
                .update(dataForSign)
                .digest('hex');

            return calculatedSignature === signature;
        } catch (error: unknown) {
            this.logger.error(`Signature verification error: ${this.getErrorMessage(error)}`);
            return false;
        }
    }

    /**
     * Kyn status-ini DB status-iga o'tkazish
     */
    private mapKynStatusToPaymentStatus(kynStatus: string): PaymentStatusValue {
        const statusMap: Record<string, PaymentStatusValue> = {
            COMPLETED: PaymentStatusValue.COMPLETED,
            PENDING: PaymentStatusValue.PENDING,
            FAILED: PaymentStatusValue.FAILED,
            CANCELLED: PaymentStatusValue.CANCELLED,
            REFUNDED: PaymentStatusValue.REFUNDED,
        };
        return statusMap[kynStatus] ?? PaymentStatusValue.PENDING;
    }

    private generateInvoiceNumber(): string {
        return `INV-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    }

    private generateOtpCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    private createCardOtpSession(input: {
        requesterId: number;
        amount: number;
        studentGroupId: number;
        studentId: number;
        description?: string;
        cardLast4: string;
        cardExpiry: string;
        phoneNumber: string;
    }): CardOtpSession {
        const sessionId = `OTP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const otpCode = this.generateOtpCode();
        const session: CardOtpSession = {
            sessionId,
            otpCode,
            expiresAt: Date.now() + 3 * 60 * 1000,
            requesterId: input.requesterId,
            amount: input.amount,
            studentGroupId: input.studentGroupId,
            studentId: input.studentId,
            description: input.description,
            cardLast4: input.cardLast4,
            cardExpiry: input.cardExpiry,
            phoneNumber: input.phoneNumber,
        };

        this.cardOtpSessions.set(sessionId, session);
        return session;
    }

    private maskPhone(phone: string): string {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length < 5) return phone;
        return `${cleaned.slice(0, 3)}****${cleaned.slice(-2)}`;
    }

    private maskCard(card: string): string {
        const cleaned = card.replace(/\D/g, '');
        if (cleaned.length < 8) return card;
        return `${cleaned.slice(0, 4)} **** **** ${cleaned.slice(-4)}`;
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) return error.message;
        return 'Unknown error';
    }
}
