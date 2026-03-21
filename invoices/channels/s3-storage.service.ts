import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }       from '@nestjs/config';
import {
  S3Client, PutObjectCommand,
  GetObjectCommand, DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable }     from 'stream';

@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');

    this.client = new S3Client({
      region:      config.getOrThrow<string>('S3_REGION'),
      credentials: {
        accessKeyId:     config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
      // Cloudflare R2: задать endpoint
      ...(config.get<string>('S3_ENDPOINT')
        ? { endpoint: config.get<string>('S3_ENDPOINT') }
        : {}),
    });
  }

  /**
   * Загрузить PDF-буфер в S3/R2.
   * Возвращает публичный URL объекта.
   *
   * Ключ: invoices/{year}/{invoiceNumber}.pdf
   * Пример: invoices/2025/INV-2025-0047.pdf
   */
  async uploadPdf(
    buffer:        Buffer,
    invoiceNumber: string,
    contentType = 'application/pdf',
  ): Promise<string> {
    const year = new Date().getFullYear();
    const key  = `invoices/${year}/${invoiceNumber}.pdf`;

    await this.client.send(new PutObjectCommand({
      Bucket:             this.bucket,
      Key:                key,
      Body:               buffer,
      ContentType:        contentType,
      ContentDisposition: `attachment; filename="${invoiceNumber}.pdf"`,
      // PDF/A для архивного хранения
      Metadata: {
        'invoice-number': invoiceNumber,
        'uploaded-at':    new Date().toISOString(),
      },
    }));

    const url = this.buildUrl(key);
    this.logger.log(`Uploaded PDF: ${key} → ${url}`);
    return url;
  }

  /**
   * Загрузить PDF из потока (Multer stream upload).
   */
  async uploadFromStream(
    stream:        Readable,
    invoiceNumber: string,
  ): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return this.uploadPdf(Buffer.concat(chunks), invoiceNumber);
  }

  /**
   * Скачать PDF из S3 как Buffer.
   */
  async downloadPdf(invoiceNumber: string): Promise<Buffer> {
    const year = new Date().getFullYear();
    const key  = `invoices/${year}/${invoiceNumber}.pdf`;

    const res = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key:    key,
    }));

    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Получить presigned URL (временная ссылка для скачивания клиентом).
   * Действует 1 час.
   */
  async getPresignedUrl(invoiceNumber: string, expiresIn = 3600): Promise<string> {
    const year = new Date().getFullYear();
    const key  = `invoices/${year}/${invoiceNumber}.pdf`;

    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  private buildUrl(key: string): string {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    if (endpoint) {
      // Cloudflare R2 public URL
      return `${endpoint}/${this.bucket}/${key}`;
    }
    const region = this.config.get<string>('S3_REGION', 'eu-central-1');
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }
}
