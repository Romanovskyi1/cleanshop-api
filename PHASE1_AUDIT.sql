-- CleanShop: Phase 1 аудит перед миграцией в моно-паллета.
-- Запустить в Supabase SQL Editor на ПРОД-БД. Выгрузить результаты каждого запроса.

-- ────────────────────────────────────────────────────────────────────────
-- Q1. Сколько паллет содержат несколько SKU (нужно разбить миграцией)
-- ────────────────────────────────────────────────────────────────────────
SELECT
  p.status,
  COUNT(*) AS mixed_pallets
FROM pallets p
JOIN (
  SELECT pallet_id
  FROM pallet_items
  GROUP BY pallet_id
  HAVING COUNT(DISTINCT product_id) > 1
) mixed ON mixed.pallet_id = p.id
GROUP BY p.status
ORDER BY p.status;

-- ────────────────────────────────────────────────────────────────────────
-- Q2. Список mixed-паллет с разрезом по статусу + содержимое
-- ────────────────────────────────────────────────────────────────────────
SELECT
  p.id          AS pallet_id,
  p.status,
  p.order_id,
  p.total_weight_kg,
  p.total_boxes,
  string_agg(DISTINCT pi.product_id::text, ', ') AS product_ids,
  COUNT(DISTINCT pi.product_id) AS sku_count
FROM pallets p
JOIN pallet_items pi ON pi.pallet_id = p.id
GROUP BY p.id
HAVING COUNT(DISTINCT pi.product_id) > 1
ORDER BY p.status, p.id;

-- ────────────────────────────────────────────────────────────────────────
-- Q3. Паллеты с превышением product.pallet_weight_kg (overweight)
-- ────────────────────────────────────────────────────────────────────────
WITH pallet_primary_sku AS (
  SELECT pi.pallet_id,
         pi.product_id,
         ROW_NUMBER() OVER (PARTITION BY pi.pallet_id ORDER BY pi.boxes DESC) AS rn
  FROM pallet_items pi
)
SELECT
  p.id               AS pallet_id,
  p.status,
  p.total_weight_kg  AS actual_kg,
  prod.pallet_weight_kg AS limit_kg,
  p.total_weight_kg - COALESCE(prod.pallet_weight_kg, 1000) AS overage_kg
FROM pallets p
JOIN pallet_primary_sku pp ON pp.pallet_id = p.id AND pp.rn = 1
JOIN products prod ON prod.id = pp.product_id
WHERE p.total_weight_kg > COALESCE(prod.pallet_weight_kg, 1000)
ORDER BY overage_kg DESC;

-- ────────────────────────────────────────────────────────────────────────
-- Q4. Паллеты с превышением product.boxes_per_pallet (overbox)
-- ────────────────────────────────────────────────────────────────────────
WITH pallet_primary_sku AS (
  SELECT pi.pallet_id,
         pi.product_id,
         ROW_NUMBER() OVER (PARTITION BY pi.pallet_id ORDER BY pi.boxes DESC) AS rn
  FROM pallet_items pi
)
SELECT
  p.id               AS pallet_id,
  p.status,
  p.total_boxes      AS actual_boxes,
  prod.boxes_per_pallet AS limit_boxes,
  p.total_boxes - COALESCE(prod.boxes_per_pallet, 300) AS overage_boxes
FROM pallets p
JOIN pallet_primary_sku pp ON pp.pallet_id = p.id AND pp.rn = 1
JOIN products prod ON prod.id = pp.product_id
WHERE p.total_boxes > COALESCE(prod.boxes_per_pallet, 300)
ORDER BY overage_boxes DESC;

-- ────────────────────────────────────────────────────────────────────────
-- Q5. Продукты без обязательной физики (нужен backfill в Phase 4)
-- ────────────────────────────────────────────────────────────────────────
SELECT
  id,
  sku,
  name,
  units_per_box,
  boxes_per_pallet,
  box_weight_kg,
  pallet_weight_kg
FROM products
WHERE units_per_box    IS NULL OR units_per_box    <= 0
   OR boxes_per_pallet IS NULL OR boxes_per_pallet <= 0
   OR box_weight_kg    IS NULL OR box_weight_kg    <= 0
   OR pallet_weight_kg IS NULL OR pallet_weight_kg <= 0
ORDER BY sku;

-- ────────────────────────────────────────────────────────────────────────
-- Q6. Общая картина: распределение паллет по статусам
-- ────────────────────────────────────────────────────────────────────────
SELECT status, COUNT(*) AS n FROM pallets GROUP BY status ORDER BY status;

-- ────────────────────────────────────────────────────────────────────────
-- Q7. Общее количество записей для оценки миграции
-- ────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM pallets)       AS pallets_total,
  (SELECT COUNT(*) FROM pallet_items)  AS pallet_items_total,
  (SELECT COUNT(*) FROM products)      AS products_total;
