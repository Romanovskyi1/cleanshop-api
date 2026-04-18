/* eslint-disable no-console */
/**
 * Pre-flight audit для миграций 1700000013 + 1700000014.
 * READ-ONLY: только SELECT, никаких UPDATE/ALTER/DELETE.
 *
 * Проверяет:
 *  1) Схема совместима (нужные столбцы/триггеры/функции существуют)
 *  2) Данные совместимы (ни одна паллета не останется без product_id
 *     после шага 6+7+8; SKU 1700000014 существуют)
 *  3) Backup-таблиц с сегодняшней датой ещё нет
 *
 * Запуск:
 *   node scripts/audit/preflight_1700000013_14.js
 */
const { Client } = require('pg');
require('dotenv').config();

const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

const checks = [
  {
    name: 'products: все 6 ожидаемых SKU существуют',
    sql: `SELECT sku FROM products WHERE sku IN ('AQ-115-1L','Dixan','121','gel','GC-028-5L','CP-003-3K') ORDER BY sku`,
    assert: (rows) => rows.length === 6 || `expected 6 SKUs, got ${rows.length}: ${rows.map(r=>r.sku).join(',')}`,
  },
  {
    name: 'products: столбцы is_active, pallet_weight_kg, box_weight_kg существуют',
    sql: `SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name IN ('is_active','pallet_weight_kg','box_weight_kg','boxes_per_pallet','sku')`,
    assert: (rows) => rows.length >= 5 || `missing columns in products: got ${rows.map(r=>r.column_name).join(',')}`,
  },
  {
    name: 'pallets: столбцы total_boxes/total_weight_kg/total_amount_eur/status/order_id существуют',
    sql: `SELECT column_name FROM information_schema.columns WHERE table_name='pallets' AND column_name IN ('total_boxes','total_weight_kg','total_amount_eur','status','order_id')`,
    assert: (rows) => rows.length === 5 || `missing columns in pallets: ${rows.map(r=>r.column_name).join(',')}`,
  },
  {
    name: 'pallets: новые столбцы (product_id и др.) ещё НЕ существуют',
    sql: `SELECT column_name FROM information_schema.columns WHERE table_name='pallets' AND column_name IN ('product_id','pallets_count','is_legacy','idempotency_key')`,
    assert: (rows) => rows.length === 0 || `migration already partially applied: ${rows.map(r=>r.column_name).join(',')}`,
  },
  {
    name: 'pallet_items: столбцы pallet_id/product_id/boxes существуют',
    sql: `SELECT column_name FROM information_schema.columns WHERE table_name='pallet_items' AND column_name IN ('pallet_id','product_id','boxes')`,
    assert: (rows) => rows.length === 3 || `missing pallet_items columns: ${rows.map(r=>r.column_name).join(',')}`,
  },
  {
    name: 'Триггеры pallet_items_recalc и pallets_recalc_order существуют',
    sql: `SELECT tgname FROM pg_trigger WHERE tgname IN ('pallet_items_recalc','pallets_recalc_order') AND NOT tgisinternal`,
    assert: (rows) => rows.length === 2 || `expected 2 triggers, got: ${rows.map(r=>r.tgname).join(',')}`,
  },
  {
    name: 'Backup-таблицы с сегодняшней датой ещё НЕ существуют',
    sql: `SELECT tablename FROM pg_tables WHERE tablename IN ('pallets_backup_${today}','pallet_items_backup_${today}')`,
    assert: (rows) => rows.length === 0 || `backup tables already exist: ${rows.map(r=>r.tablename).join(',')}`,
  },
  {
    name: 'Всего pallets в прод',
    sql: `SELECT COUNT(*)::int AS c FROM pallets`,
    assert: () => true,
    info: true,
  },
  {
    name: 'Всего pallet_items в прод',
    sql: `SELECT COUNT(*)::int AS c FROM pallet_items`,
    assert: () => true,
    info: true,
  },
  {
    name: 'Паллеты по числу distinct SKU (single/mixed/empty)',
    sql: `
      WITH sku_per_pallet AS (
        SELECT p.id AS pallet_id, COUNT(DISTINCT pi.product_id) AS distinct_skus
        FROM pallets p LEFT JOIN pallet_items pi ON pi.pallet_id = p.id
        GROUP BY p.id
      )
      SELECT
        SUM(CASE WHEN distinct_skus = 0 THEN 1 ELSE 0 END)::int AS empty,
        SUM(CASE WHEN distinct_skus = 1 THEN 1 ELSE 0 END)::int AS single_sku,
        SUM(CASE WHEN distinct_skus > 1 THEN 1 ELSE 0 END)::int AS mixed
      FROM sku_per_pallet`,
    assert: () => true,
    info: true,
  },
  {
    name: 'Mixed-паллеты в разрезе статуса (после миграции → is_legacy=true)',
    sql: `
      SELECT p.status, COUNT(*)::int AS c
      FROM pallets p
      JOIN (
        SELECT pallet_id FROM pallet_items
        GROUP BY pallet_id HAVING COUNT(DISTINCT product_id) > 1
      ) mx ON mx.pallet_id = p.id
      GROUP BY p.status ORDER BY p.status`,
    assert: () => true,
    info: true,
  },
  {
    name: 'Single-SKU паллеты: есть ли pallet_items с product_id, у которого deleted/NULL product?',
    sql: `
      WITH sku_per_pallet AS (
        SELECT pi.pallet_id, MAX(pi.product_id) AS any_product_id, COUNT(DISTINCT pi.product_id) AS distinct_skus
        FROM pallet_items pi GROUP BY pi.pallet_id
      )
      SELECT COUNT(*)::int AS orphans
      FROM sku_per_pallet s
      LEFT JOIN products pr ON pr.id = s.any_product_id
      WHERE s.distinct_skus = 1 AND pr.id IS NULL`,
    assert: (rows) => (rows[0].orphans === 0) || `${rows[0].orphans} single-SKU pallets reference non-existent product`,
  },
  {
    name: 'products с boxes_per_pallet = 0 или NULL (сломает CEIL)',
    sql: `SELECT sku, boxes_per_pallet FROM products WHERE boxes_per_pallet IS NULL OR boxes_per_pallet = 0`,
    assert: (rows) => rows.length === 0 || `${rows.length} products with bad boxes_per_pallet: ${rows.map(r=>r.sku).join(',')}`,
  },
  {
    name: '1700000014: текущий pallet_weight_kg для 4 активных SKU (должен быть NULL)',
    sql: `SELECT sku, pallet_weight_kg FROM products WHERE sku IN ('AQ-115-1L','Dixan','121','gel') ORDER BY sku`,
    assert: () => true,
    info: true,
  },
  {
    name: '1700000014: текущий is_active для 2 деактивируемых SKU',
    sql: `SELECT sku, is_active FROM products WHERE sku IN ('GC-028-5L','CP-003-3K') ORDER BY sku`,
    assert: () => true,
    info: true,
  },
];

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL отсутствует в .env'); process.exit(2); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  let failed = 0;
  for (const check of checks) {
    try {
      const r = await c.query(check.sql);
      const verdict = check.assert(r.rows);
      const tag = check.info ? 'INFO' : (verdict === true ? 'PASS' : 'FAIL');
      if (tag === 'FAIL') failed++;
      console.log(`[${tag}] ${check.name}`);
      if (check.info || tag === 'FAIL') {
        console.log('       ' + JSON.stringify(r.rows));
      }
      if (verdict !== true && !check.info) console.log('       ' + verdict);
    } catch (e) {
      failed++;
      console.log(`[ERROR] ${check.name}`);
      console.log('       ' + e.message);
    }
  }
  await c.end();
  console.log(`\n${failed === 0 ? '✅ PRE-FLIGHT PASSED' : `❌ ${failed} checks failed`}`);
  process.exit(failed === 0 ? 0 : 1);
})();
