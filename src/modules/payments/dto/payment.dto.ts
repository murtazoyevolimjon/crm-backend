import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export enum PaymentMethodValue {
    KYN = 'KYN',
    CARD = 'CARD',
    TRANSFER = 'TRANSFER',
}

export enum PaymentStatusValue {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
    REFUNDED = 'REFUNDED',
}

export class CreatePaymentDto {
    @IsNumber()
    @Min(1000, { message: "Miqdori kamida 1000 bo'lishi kerak" })
    amount!: number;

    @IsInt()
    studentGroupId!: number;

    @IsInt()
    studentId!: number;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(PaymentMethodValue)
    paymentMethod?: PaymentMethodValue;

    @IsOptional()
    @IsString()
    @Matches(/^\d{4}$/, { message: "Karta raqamining oxirgi 4 ta belgisi noto'g'ri" })
    cardLast4?: string;

    @IsOptional()
    @IsString()
    @Matches(/^(0[1-9]|1[0-2])\/(\d{2})$/, {
        message: "Karta muddati MM/YY formatida bo'lishi kerak",
    })
    cardExpiry?: string;

    @IsOptional()
    @IsString()
    @Matches(/^\+?\d{9,15}$/, {
        message: "Telefon raqami noto'g'ri formatda",
    })
    phoneNumber?: string;
}

export class ConfirmCardPaymentOtpDto {
    @IsString()
    otpSessionId!: string;

    @IsString()
    @Matches(/^\d{6}$/, { message: 'SMS kod 6 ta raqam bo\'lishi kerak' })
    otpCode!: string;
}

export class PaymentCallbackDto {
    @IsString()
    transactionId!: string;

    @IsString()
    orderId!: string;

    @IsNumber()
    amount!: number;

    @IsEnum(PaymentStatusValue)
    status!: PaymentStatusValue;

    @IsString()
    timestamp!: string;

    @IsOptional()
    @IsString()
    signature?: string;
}

export class CheckPaymentStatusDto {
    @IsString()
    transactionId!: string;

    @IsString()
    orderId!: string;
}
