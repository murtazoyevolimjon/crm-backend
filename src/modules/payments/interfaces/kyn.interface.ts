/**
 * Kyn Payment Gateway Integration Interface
 * Defines types for Kyn API requests and responses
 */

export interface KynPaymentRequest {
    amount: number;
    currency?: string;
    orderId: string;
    description: string;
    returnUrl: string;
    callbackUrl: string;
    phone?: string;
    email?: string;
}

export interface KynPaymentResponse {
    success: boolean;
    transactionId?: string;
    paymentUrl?: string;
    orderId: string;
    amount: number;
    status: string;
    message?: string;
    error?: string;
}

export interface KynWebhookPayload {
    transactionId: string;
    orderId: string;
    amount: number;
    status: 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PENDING';
    timestamp: string;
    signature?: string;
}

export interface KynCheckStatusRequest {
    transactionId: string;
    orderId: string;
}

export interface KynCheckStatusResponse {
    transactionId: string;
    orderId: string;
    status: 'COMPLETED' | 'FAILED' | 'PENDING' | 'CANCELLED';
    amount: number;
    completedAt?: string;
    error?: string;
}
