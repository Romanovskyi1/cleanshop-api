"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDevSeed = runDevSeed;
async function runDevSeed(dataSource) {
    const [company] = await dataSource.query(`
    INSERT INTO "companies"
      ("name", "vat_number", "address", "city", "country_code", "email", "invoice_terms")
    VALUES
      ('CleanService sp. z o.o.', 'PL9876543210',
       'ul. Marszałkowska 84', 'Warszawa', 'PL',
       'zakupy@cleanservice.pl', 'NET30')
    ON CONFLICT DO NOTHING
    RETURNING "id"
  `);
    const companyId = company?.id ?? 1;
    await dataSource.query(`
    INSERT INTO "users"
      ("telegram_id", "first_name", "last_name", "username",
       "language_code", "company_id", "role")
    VALUES
      -- Клиент
      (123456789, 'Klaus', 'Weber', 'klausw',
       'de', ${companyId}, 'client'),
      -- Менеджер GreenChem
      (987654321, 'Anna', 'Kowalska', 'anna_manager',
       'pl', NULL, 'manager')
    ON CONFLICT ("telegram_id") DO NOTHING
  `);
    const products = [
        {
            sku: 'GC-028-5L',
            name: JSON.stringify({ ru: 'GreenClean Гель для посуды 5L', en: 'GreenClean Dish Gel 5L', de: 'GreenClean Geschirrspülgel 5L', pl: 'GreenClean Żel do naczyń 5L' }),
            description: JSON.stringify({ ru: 'Концентрированный гель для ручного мытья посуды. Эффективен при температуре от 20°C.', en: 'Concentrated gel for hand dishwashing.' }),
            category: 'gel',
            volume_l: 5,
            price_eur: 12.40,
            units_per_box: 24,
            boxes_per_pallet: 40,
            pallet_weight_kg: 820,
            stock_pallets: 84,
            is_eco: true,
            certifications: '{EU Ecolabel,биоразлагаемый,без фосфатов}',
            images: '{https://cdn.cleanshop.eu/products/gc-028-5l.jpg}',
        },
        {
            sku: 'CP-003-3K',
            name: JSON.stringify({ ru: 'CleanPro Порошок универсальный 3кг', en: 'CleanPro Universal Powder 3kg', de: 'CleanPro Universalpulver 3kg', pl: 'CleanPro Proszek uniwersalny 3kg' }),
            description: JSON.stringify({ ru: 'Универсальный стиральный порошок для белого и цветного белья.', en: 'Universal laundry powder for whites and colors.' }),
            category: 'powder',
            volume_l: null,
            price_eur: 8.80,
            units_per_box: 24,
            boxes_per_pallet: 48,
            pallet_weight_kg: 920,
            stock_pallets: 120,
            is_eco: false,
            certifications: '{}',
            images: '{https://cdn.cleanshop.eu/products/cp-003-3k.jpg}',
        },
        {
            sku: 'AQ-115-1L',
            name: JSON.stringify({ ru: 'AquaFresh Концентрат для пола 1L', en: 'AquaFresh Floor Concentrate 1L', de: 'AquaFresh Bodenreiniger-Konzentrat 1L', pl: 'AquaFresh Koncentrat do podłóg 1L' }),
            description: JSON.stringify({ ru: 'Концентрат 1:50 для мытья всех видов напольных покрытий.', en: 'Concentrate 1:50 for all floor types.' }),
            category: 'concentrate',
            volume_l: 1,
            price_eur: 6.50,
            units_per_box: 24,
            boxes_per_pallet: 60,
            pallet_weight_kg: 780,
            stock_pallets: 7,
            is_eco: true,
            certifications: '{EU Ecolabel,биоразлагаемый}',
            images: '{https://cdn.cleanshop.eu/products/aq-115-1l.jpg}',
        },
        {
            sku: 'GC-041-3L',
            name: JSON.stringify({ ru: 'GreenClean Средство для стирки 3L', en: 'GreenClean Laundry Gel 3L', de: 'GreenClean Waschmittel 3L', pl: 'GreenClean Płyn do prania 3L' }),
            description: JSON.stringify({ ru: 'Гель для деликатной стирки шерсти и шёлка.', en: 'Gel for delicate wool and silk fabrics.' }),
            category: 'gel',
            volume_l: 3,
            price_eur: 9.20,
            units_per_box: 24,
            boxes_per_pallet: 42,
            pallet_weight_kg: 860,
            stock_pallets: 55,
            is_eco: true,
            certifications: '{EU Ecolabel,гипоаллергенный}',
            images: '{https://cdn.cleanshop.eu/products/gc-041-3l.jpg}',
        },
        {
            sku: 'CP-017-5K',
            name: JSON.stringify({ ru: 'CleanPro Порошок-автомат 5кг', en: 'CleanPro Auto Powder 5kg', de: 'CleanPro Maschinenwaschpulver 5kg', pl: 'CleanPro Proszek do pralek 5kg' }),
            description: JSON.stringify({ ru: 'Стиральный порошок для автоматических машин. Содержит кислородный отбеливатель.', en: 'Laundry powder for automatic washing machines.' }),
            category: 'powder',
            volume_l: null,
            price_eur: 14.60,
            units_per_box: 24,
            boxes_per_pallet: 36,
            pallet_weight_kg: 950,
            stock_pallets: 0,
            is_eco: false,
            certifications: '{}',
            images: '{https://cdn.cleanshop.eu/products/cp-017-5k.jpg}',
        },
        {
            sku: 'AQ-220-5L',
            name: JSON.stringify({ ru: 'AquaFresh Ополаскиватель 5L', en: 'AquaFresh Fabric Softener 5L', de: 'AquaFresh Weichspüler 5L', pl: 'AquaFresh Płyn do płukania 5L' }),
            description: JSON.stringify({ ru: 'Концентрированный ополаскиватель с ароматом лаванды.', en: 'Concentrated fabric softener with lavender scent.' }),
            category: 'concentrate',
            volume_l: 5,
            price_eur: 11.10,
            units_per_box: 24,
            boxes_per_pallet: 40,
            pallet_weight_kg: 800,
            stock_pallets: 30,
            is_eco: false,
            certifications: '{без парабенов}',
            images: '{https://cdn.cleanshop.eu/products/aq-220-5l.jpg}',
        },
    ];
    for (const p of products) {
        await dataSource.query(`
      INSERT INTO "products" (
        "sku", "name", "description", "category",
        "volume_l", "price_eur", "units_per_box",
        "boxes_per_pallet", "pallet_weight_kg",
        "stock_pallets", "is_eco",
        "certifications", "images", "is_active", "sort_order"
      )
      VALUES (
        $1, $2::jsonb, $3::jsonb, $4::product_category_enum,
        $5, $6, $7,
        $8, $9,
        $10, $11,
        $12, $13, true,
        ${products.indexOf(p) + 1}
      )
      ON CONFLICT ("sku") DO UPDATE SET
        "price_eur"       = EXCLUDED."price_eur",
        "stock_pallets"   = EXCLUDED."stock_pallets",
        "updated_at"      = now()
    `, [
            p.sku, p.name, p.description, p.category,
            p.volume_l, p.price_eur, p.units_per_box,
            p.boxes_per_pallet, p.pallet_weight_kg,
            p.stock_pallets, p.is_eco,
            p.certifications, p.images,
        ]);
    }
    console.log('✅ Dev seed завершён:');
    console.log(`   companies: 1  users: 2  products: ${products.length}`);
}
//# sourceMappingURL=dev.seed.js.map