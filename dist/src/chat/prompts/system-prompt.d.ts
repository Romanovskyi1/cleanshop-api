export interface ClientContext {
    companyName: string;
    contactName: string;
    languageCode: string;
    activeOrders: Array<{
        id: number;
        status: string;
        confirmedDate?: string;
    }>;
    pendingPallets: number;
    pendingInvoices: number;
    recentProducts: Array<{
        sku: string;
        name: string;
    }>;
}
export declare function buildSystemPrompt(ctx: ClientContext): string;
export declare function buildEscalationContext(ctx: ClientContext, userMessage: string, aiResponse: string): string;
