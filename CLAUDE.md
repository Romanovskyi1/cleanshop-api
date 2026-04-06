# CleanShop B2B API

## Stack
- Backend: NestJS + TypeORM + PostgreSQL (Supabase EU)
- Frontend: React TMA (Telegram Mini App)
- Deploy: Railway
- Package manager: npm

## Key paths
- Frontend: /Users/romanovskaya/Downloads/CHCH/files/Фронтенд/cleanshop-tma
- Backend: /Users/romanovskaya/Downloads/cleanshop/cleanshop-api

## Rules
- Always run npm run build before railway up --service
- Run migrations: npm run migration:run
- Entity column names must match actual DB columns
- Use --detach flag for railway up

## Active services
- API: https://cleanshop-api-production.up.railway.app
- TMA: https://cleanshop-tma-production.up.railway.app
