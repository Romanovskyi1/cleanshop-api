"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var S3StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3StorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
let S3StorageService = S3StorageService_1 = class S3StorageService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(S3StorageService_1.name);
        this.bucket = config.getOrThrow('S3_BUCKET');
        this.client = new client_s3_1.S3Client({
            region: config.getOrThrow('S3_REGION'),
            credentials: {
                accessKeyId: config.getOrThrow('S3_ACCESS_KEY'),
                secretAccessKey: config.getOrThrow('S3_SECRET_KEY'),
            },
            ...(config.get('S3_ENDPOINT')
                ? { endpoint: config.get('S3_ENDPOINT') }
                : {}),
        });
    }
    async uploadPdf(buffer, invoiceNumber, contentType = 'application/pdf') {
        const year = new Date().getFullYear();
        const key = `invoices/${year}/${invoiceNumber}.pdf`;
        await this.client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            ContentDisposition: `attachment; filename="${invoiceNumber}.pdf"`,
            Metadata: {
                'invoice-number': invoiceNumber,
                'uploaded-at': new Date().toISOString(),
            },
        }));
        const url = this.buildUrl(key);
        this.logger.log(`Uploaded PDF: ${key} → ${url}`);
        return url;
    }
    async uploadFromStream(stream, invoiceNumber) {
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return this.uploadPdf(Buffer.concat(chunks), invoiceNumber);
    }
    async downloadPdf(invoiceNumber) {
        const year = new Date().getFullYear();
        const key = `invoices/${year}/${invoiceNumber}.pdf`;
        const res = await this.client.send(new client_s3_1.GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));
        const chunks = [];
        for await (const chunk of res.Body) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }
    async getPresignedUrl(invoiceNumber, expiresIn = 3600) {
        const year = new Date().getFullYear();
        const key = `invoices/${year}/${invoiceNumber}.pdf`;
        return (0, s3_request_presigner_1.getSignedUrl)(this.client, new client_s3_1.GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
    }
    buildUrl(key) {
        const endpoint = this.config.get('S3_ENDPOINT');
        if (endpoint) {
            return `${endpoint}/${this.bucket}/${key}`;
        }
        const region = this.config.get('S3_REGION', 'eu-central-1');
        return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
    }
};
exports.S3StorageService = S3StorageService;
exports.S3StorageService = S3StorageService = S3StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], S3StorageService);
//# sourceMappingURL=s3-storage.service.js.map