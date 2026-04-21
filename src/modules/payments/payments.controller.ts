import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@/common/guard/jwt-auth.guard';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { ConfirmCardPaymentOtpDto, CreatePaymentDto, PaymentCallbackDto } from './dto/payment.dto';

type AuthenticatedRequest = Request & {
    user: {
        id?: number;
        sub?: number;
        role?: string;
    };
};

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    /**
     * Yangi to'lov yaratish
     */
    @Post('create')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: "Yangi to'lov yaratish" })
    async createPayment(
        @Body() createPaymentDto: CreatePaymentDto,
        @Req() req: AuthenticatedRequest,
    ) {
        const requesterId = req.user.id ?? req.user.sub;
        return this.paymentsService.createPayment(createPaymentDto, requesterId ?? 0);
    }

    @Post('confirm-card-otp')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: "Karta to'lovi uchun SMS kodni tasdiqlash" })
    async confirmCardOtp(
        @Body() confirmDto: ConfirmCardPaymentOtpDto,
        @Req() req: AuthenticatedRequest,
    ) {
        const requesterId = req.user.id ?? req.user.sub;
        return this.paymentsService.confirmCardPaymentOtp(confirmDto, requesterId ?? 0);
    }

    /**
     * Kyn webhook callback
     */
    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Kyn webhook callback' })
    async handleWebhook(@Body() payload: PaymentCallbackDto) {
        return this.paymentsService.handleKynWebhook(payload);
    }

    /**
     * To'lov statusini tekshirish
     */
    @Get('status/:transactionId')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: "To'lov statusini tekshirish" })
    async checkStatus(@Param('transactionId') transactionId: string) {
        return this.paymentsService.checkPaymentStatus(transactionId);
    }

    /**
     * Talaba uchun barcha to'lovlarni olish
     */
    @Get('my-payments')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: "Mening to'lovlarim" })
    async getMyPayments(@Req() req: AuthenticatedRequest) {
        const studentId = req.user.id ?? req.user.sub;
        if (!studentId) {
            throw new ForbiddenException('Foydalanuvchi aniqlanmadi');
        }
        return this.paymentsService.getStudentPayments(studentId);
    }

    @Get('admin-notifications')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: "Admin uchun to'lov bildirishnomalari" })
    async getAdminNotifications(@Req() req: AuthenticatedRequest) {
        return this.paymentsService.getAdminPaymentNotifications(req.user.role);
    }

    /**
     * To'lovlarning statistikasini olish
     */
    @Get('stats/:studentGroupId')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: "Guruh to'lovlari statistikasi" })
    async getPaymentStats(@Param('studentGroupId', ParseIntPipe) studentGroupId: number) {
        return this.paymentsService.getPaymentStats(studentGroupId);
    }
}
