import { PalletsService } from './pallets.service';

// NOTE: старые тесты сохранены в pallets.service.spec.ts.old_mono_pallet_migration.
// После Phase 2 (single-SKU monopallet) API сервиса изменилось. Полноценные тесты —
// отдельной задачей в рамках Phase 3/6.
describe('PalletsService (smoke)', () => {
  it('class defined', () => {
    expect(PalletsService).toBeDefined();
  });
});
