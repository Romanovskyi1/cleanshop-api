# CleanShop B2B API

## Stack
- Backend: NestJS + TypeORM + PostgreSQL (Supabase EU)
- Frontend: React TMA (Telegram Mini App)
- Deploy: Railway
- Package manager: npm

## Key paths
- API:     /Users/romanovskaya/Projects/cleanshop/cleanshop-api
- Manager: /Users/romanovskaya/Projects/cleanshop/cleanshop-manager
- TMA:     /Users/romanovskaya/Projects/cleanshop/cleanshop-tma

## Domain
- Паллета = 1 SKU (моно-паллета). См. ~/.claude/memory/cleanshop/DOMAIN.md
- Источник истины физики паллеты: products (boxes_per_pallet, pallet_weight_kg, box_weight_kg, units_per_box)

## Rules
- Always run npm run build before railway up --service
- Run migrations: npm run migration:run
- Entity column names must match actual DB columns
- Use --detach flag for railway up

## Active services
- API:     https://cleanshop-api-production.up.railway.app
- TMA:     https://cleanshop-tma-production.up.railway.app
- Manager: https://cleanshop-manager-production.up.railway.app
