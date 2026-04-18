#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Phase 3 dry-run миграций 1700000013 + 1700000014 на локальной Postgres.app.
 *
 * Стратегия:
 *   1. Запустить ТОЛЬКО миграцию 000 (мастер-консолидация).
 *   2. Помесить 001..012 как выполненные в migrations-таблице (они — историческая
 *      пыль, всё что в них нужное уже есть в 000 на прод-инстансе).
 *   3. Прогнать 013, 014 через TypeORM.
 *   4. Seed тестовых паллет в форме прода (1 mixed-SKU + одно-SKU).
 *   5. Проверить инварианты DOMAIN.
 */
const { Client } = require('pg');
const { execSync } = require('child_process');
const path = require('path');

const DSN = process.env.DATABASE_URL
  || 'postgres://postgres@localhost:5432/cleanshop_dry_run';

const ROOT = path.resolve(__dirname, '..', '..');

async function main() {
  const c = new Client({ connectionString: DSN });
  await c.connect();

  console.log('━━━ Phase A: prepare DB ━━━');
  await c.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public');
  await c.end();

  console.log('━━━ Phase B: run migration 000 via TypeORM (all to 014) ━━━');
  // Сначала выключим 001..012 — подменим их через миграционную таблицу
  // после 000. Но TypeORM запустит их в порядке timestamp. Поэтому идём
  // по-другому: запустим миграцию 000 в ручную через raw SQL, потом
  // populate migrations_table, потом typeorm migration:run только 013+014.

  // 1) Выполним up() миграции 000 напрямую — упрощение.
  // Для этого вызовем typeorm-ts-node-commonjs с query_limit на 000 нельзя.
  // Поэтому: создадим temp-файл data-source где migrations = только 000.
  // Проще: исполнить SQL из миграций через вручную через ts-node.

  // Пробуем прямой путь: скопируем файлы 001-012 во временную папку, удалим
  // их из src/migrations, прогоним migration:run (только 000), вернём файлы,
  // вставим записи migrations, и прогоним migration:run для 013/014.

  const fs = require('fs');
  const migDir = path.join(ROOT, 'src', 'migrations');
  const tempDir = path.join(ROOT, '.dry_run_tmp_migrations');

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir);

  // Hide 001..014 so only migration 000 runs first
  const toHide = fs.readdirSync(migDir)
    .filter(f => /^17000000(0[1-9]|1[0-4])/.test(f));
  console.log('  hiding migrations:', toHide);
  for (const f of toHide) {
    fs.renameSync(path.join(migDir, f), path.join(tempDir, f));
  }
  const toRestoreLater = []; // 013+014 restored after fake rows + seed

  try {
    console.log('  running migration 000 only...');
    execSync('npm run migration:run', {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: DSN, NODE_ENV: 'development' },
    });

    console.log('━━━ Phase C: fake rows for 001..012 in migrations table ━━━');
    const c2 = new Client({ connectionString: DSN });
    await c2.connect();
    const fakeRows = [
      [1700000001000, 'CreateCompanies1700000001000'],
      [1700000002000, 'CreateUsers1700000002000'],
      [1700000003000, 'CreateProducts1700000003000'],
      [1700000004000, 'CreateOrdersAndTrucks1700000004000'],
      [1700000005000, 'CreatePalletsAndItems1700000005000'],
      [1700000006000, 'CreateInvoices1700000006000'],
      [1700000007000, 'CreateChatAndNotifications1700000007000'],
      [1700000008000, 'AddTruckTypeToOrders1700000008000'],
      [1700000009000, 'AddWindowOpensAt1700000009000'],
      [1700000010000, 'AddIntentToChat1700000010000'],
      [1700000011000, 'CreateOrderStatusHistory1700000011000'],
      [1700000012000, 'AddIdempotencyKeyToPalletItems1700000012000'],
    ];
    for (const [ts, name] of fakeRows) {
      await c2.query(
        'INSERT INTO migrations (timestamp, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [ts, name]
      );
    }
    console.log('  fake rows inserted:', fakeRows.length);
    await c2.end();
  } finally {
    console.log('  restoring migrations 013 + 014 only (001..012 stay hidden-as-fake-rows)');
    for (const f of toHide) {
      if (/^170000001[34]/.test(f)) {
        fs.renameSync(path.join(tempDir, f), path.join(migDir, f));
      }
    }
  }

  console.log('━━━ Phase D: seed test fixtures (prod-shape) ━━━');
  const c3 = new Client({ connectionString: DSN });
  await c3.connect();

  // migration 000 запихнула свой seed — чистим в FK-порядке (views тоже
  // через CASCADE не удаляем, только данные).
  await c3.query(`DELETE FROM pallet_items`);
  await c3.query(`DELETE FROM pallets`);
  await c3.query(`DELETE FROM trucks`);
  await c3.query(`DELETE FROM invoice_deliveries`);
  await c3.query(`DELETE FROM invoices`);
  await c3.query(`DELETE FROM chat_messages`);
  await c3.query(`DELETE FROM orders`);
  await c3.query(`DELETE FROM products`);
  await c3.query(`DELETE FROM users`);
  await c3.query(`DELETE FROM companies`);

  await c3.query(`INSERT INTO companies (id, name) VALUES (1, 'Test Co')`);
  await c3.query(`
    INSERT INTO products (id, sku, name, category, units_per_box, volume_l, price_eur, box_weight_kg, boxes_per_pallet, pallets_per_truck, pallet_weight_kg, is_active)
    VALUES
      (1, 'AQ-115-1L', '{"en":"Aquaclean 1L"}'::jsonb,      'concentrate', 12, 1,   5.00, 14,    48, 21, NULL, true),
      (2, 'Dixan',     '{"en":"Dixan"}'::jsonb,             'powder',      12, 1,   6.00, 12,    48, 21, NULL, true),
      (3, '121',       '{"en":"121 All-purpose"}'::jsonb,   'concentrate',  6, 5,   9.00, 15.47, 54, 21, NULL, true),
      (4, 'gel',       '{"en":"Gel cleaner"}'::jsonb,       'gel',          8, 1,   4.00, 13.50, 48, 21, NULL, true),
      (5, 'GC-028-5L', '{"en":"Inactive A"}'::jsonb,        'concentrate', 10, 5,   7.00, 10,    40, 21, NULL, true),
      (6, 'CP-003-3K', '{"en":"Inactive B"}'::jsonb,        'powder',       6, 3,   8.00, 12,    40, 21, NULL, true)
  `);

  // order shell
  await c3.query(`
    INSERT INTO orders (id, company_id, status, total_pallets, total_weight_kg, total_amount_eur)
    VALUES (1, 1, 'building', 0, 0, 0)
  `);

  // pallets (pre-migration13 shape: no product_id, has total_* columns)
  // Test cases:
  //   A — single-SKU pallet (product 1, 48 boxes → 1 pallet)
  //   B — single-SKU pallet, >1 pallet worth (product 3, 108 boxes → 2 pallets)
  //   C — mixed-SKU pallet (product 1 30 boxes + product 2 18 boxes)
  //   D — empty pallet (no items) → should be deleted by 013
  await c3.query(`
    INSERT INTO pallets (id, company_id, order_id, total_boxes, total_weight_kg, total_amount_eur)
    VALUES
      (10, 1, 1, 48,  672.00, 240.00),
      (11, 1, 1, 108, 1670.76, 972.00),
      (12, 1, 1, 48,  636.00, 258.00),
      (13, 1, 1, 0,   0,      0)
  `);
  await c3.query(`
    INSERT INTO pallet_items (pallet_id, product_id, boxes, price_eur, subtotal_eur)
    VALUES
      (10, 1, 48, 5.00, 240.00),
      (11, 3, 108, 9.00, 972.00),
      (12, 1, 30, 5.00, 150.00),
      (12, 2, 18, 6.00, 108.00)
  `);

  console.log('  seed OK');
  await c3.end();

  console.log('━━━ Phase E: run migrations 013 + 014 ━━━');
  try {
    execSync('npm run migration:run', {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: DSN, NODE_ENV: 'development' },
    });
  } finally {
    // restore remaining hidden files (001..012)
    if (fs.existsSync(tempDir)) {
      for (const f of fs.readdirSync(tempDir)) {
        fs.renameSync(path.join(tempDir, f), path.join(migDir, f));
      }
      fs.rmdirSync(tempDir);
    }
  }

  console.log('━━━ Phase F: invariants ━━━');
  const c4 = new Client({ connectionString: DSN });
  await c4.connect();

  const checks = [];
  const q = async (sql, args = []) => (await c4.query(sql, args)).rows;

  // 1. pallets.product_id NOT NULL
  const productIdCol = await q(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_name='pallets' AND column_name='product_id'`
  );
  checks.push(['pallets.product_id IS NOT NULL', productIdCol[0]?.is_nullable === 'NO']);

  // 2. empty pallet (id=13) удалён
  const empty = await q(`SELECT id FROM pallets WHERE id = 13`);
  checks.push(['empty pallet (id=13) removed', empty.length === 0]);

  // 3. single-SKU pallets: product_id, pallets_count correct
  const p10 = await q(`SELECT product_id, pallets_count, is_legacy FROM pallets WHERE id=10`);
  checks.push([
    'pallet 10: product_id=1, pallets_count=1, is_legacy=false',
    p10[0]?.product_id === 1 && p10[0]?.pallets_count === 1 && p10[0]?.is_legacy === false,
  ]);

  const p11 = await q(`SELECT product_id, pallets_count, is_legacy FROM pallets WHERE id=11`);
  checks.push([
    'pallet 11: product_id=3, pallets_count=2, is_legacy=false',
    p11[0]?.product_id === 3 && p11[0]?.pallets_count === 2 && p11[0]?.is_legacy === false,
  ]);

  // 4. mixed-SKU pallet → is_legacy=true, product_id = dominant (1, 30 boxes > 18)
  const p12 = await q(`SELECT product_id, pallets_count, is_legacy FROM pallets WHERE id=12`);
  checks.push([
    'pallet 12 (mixed): is_legacy=true, product_id=1',
    p12[0]?.product_id === 1 && p12[0]?.is_legacy === true,
  ]);

  // 5. pallet_items остаётся (historical read-only)
  const piTable = await q(
    `SELECT 1 FROM information_schema.tables WHERE table_name='pallet_items'`
  );
  checks.push(['pallet_items table preserved', piTable.length === 1]);

  // 6. backup tables exist
  const backups = await q(
    `SELECT tablename FROM pg_tables WHERE tablename LIKE 'pallets_backup_%' OR tablename LIKE 'pallet_items_backup_%'`
  );
  checks.push(['backup tables created', backups.length === 2]);

  // 7. BackfillProductPhysics: active SKUs have pallet_weight_kg
  const phys = await q(
    `SELECT sku, pallet_weight_kg FROM products WHERE sku IN ('AQ-115-1L','Dixan','121','gel') ORDER BY sku`
  );
  const physMap = Object.fromEntries(phys.map(r => [r.sku, Number(r.pallet_weight_kg)]));
  checks.push(['AQ-115-1L pallet_weight_kg=672', physMap['AQ-115-1L'] === 672]);
  checks.push(['Dixan pallet_weight_kg=576',     physMap['Dixan']     === 576]);
  checks.push(['121 pallet_weight_kg=835.20',    physMap['121']       === 835.2]);
  checks.push(['gel pallet_weight_kg=648',       physMap['gel']       === 648]);

  // 8. Inactive SKUs deactivated
  const inact = await q(
    `SELECT sku, is_active FROM products WHERE sku IN ('GC-028-5L','CP-003-3K')`
  );
  checks.push([
    'GC-028-5L + CP-003-3K deactivated',
    inact.every(r => r.is_active === false) && inact.length === 2,
  ]);

  // 9. CHECK constraint enforced: try insert active product w/o pallet_weight_kg → must FAIL
  let checkEnforced = false;
  try {
    await c4.query(`
      INSERT INTO products (sku, name, category, units_per_box, volume_l, price_eur, box_weight_kg, boxes_per_pallet, pallets_per_truck, pallet_weight_kg, is_active)
      VALUES ('TEST-FAIL', '{"en":"x"}'::jsonb, 'gel', 6, 1, 1.00, 1, 40, 21, NULL, true)
    `);
  } catch (e) {
    checkEnforced = /chk_active_product_has_pallet_weight/.test(e.message);
  }
  checks.push(['CHECK constraint blocks active product w/o weight', checkEnforced]);

  // 10. Idempotency unique index
  const idx = await q(
    `SELECT indexname FROM pg_indexes WHERE indexname = 'pallets_order_idem_uq'`
  );
  checks.push(['pallets_order_idem_uq index exists', idx.length === 1]);

  // 11. Old aggregate columns dropped
  const cols = await q(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name='pallets' AND column_name IN ('total_boxes','total_weight_kg','total_amount_eur')`
  );
  checks.push(['old aggregate columns dropped from pallets', cols.length === 0]);

  console.log('\n━━━ RESULTS ━━━');
  let pass = 0;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${label}`);
    if (ok) pass++;
  }
  console.log(`\n  ${pass}/${checks.length} passed`);

  await c4.end();
  process.exit(pass === checks.length ? 0 : 1);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(2);
});
