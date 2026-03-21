import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
export declare class S3StorageService {
    private readonly config;
    private readonly logger;
    private readonly client;
    private readonly bucket;
    constructor(config: ConfigService);
    uploadPdf(buffer: Buffer, invoiceNumber: string, contentType?: string): Promise<string>;
    uploadFromStream(stream: Readable, invoiceNumber: string): Promise<string>;
    downloadPdf(invoiceNumber: string): Promise<Buffer>;
    getPresignedUrl(invoiceNumber: string, expiresIn?: number): Promise<string>;
    private buildUrl;
}
