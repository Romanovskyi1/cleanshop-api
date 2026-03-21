"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const helmet_1 = require("helmet");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = app.get(config_1.ConfigService);
    const logger = new common_1.Logger('Bootstrap');
    const isProd = config.get('NODE_ENV') === 'production';
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
    }));
    const origins = (config.get('CORS_ORIGINS', '') || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    app.enableCors({
        origin: origins.length ? origins : true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.enableShutdownHooks();
    const port = config.get('PORT', 3000);
    await app.listen(port);
    logger.log(`🚀 CleanShop API запущен: http://localhost:${port}/api/v1`);
    logger.log(`   NODE_ENV: ${config.get('NODE_ENV')}`);
    logger.log(`   CORS origins: ${origins.join(', ') || 'all'}`);
    if (!isProd) {
        logger.warn('⚠️  synchronize=true — только для разработки!');
    }
}
bootstrap();
//# sourceMappingURL=main.js.map