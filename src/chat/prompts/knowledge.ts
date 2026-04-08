/**
 * База знаний CleanShop для AI-ассистента.
 * Содержит политики, FAQ, информацию о платформе.
 * Обновляй по мере изменения бизнес-правил.
 */
export const PRODUCT_KNOWLEDGE = `
## CleanShop Platform Knowledge Base

### Company
CleanShop is a B2B wholesale platform for household chemicals in Europe.
Products: detergents, gels, powders, concentrates.
Minimum order: 1 pallet. Payment: EUR, SEPA. Terms: NET-30 (standard) or NET-60.

### Ordering Process
1. Client browses catalog in Telegram Mini App
2. Adds products to pallets (max 300 boxes per pallet)
3. Submits order → manager confirms loading date
4. Invoice issued via PDF → sent by email/Telegram
5. Payment within NET-30 days from invoice date

### Order Statuses
- draft: created, not confirmed
- confirmed: loading date agreed
- loaded: goods loaded, invoice issued
- shipped: in transit
- delivered: received by client
- cancelled: cancelled

### Pricing Rules
- All prices in EUR
- Prices in catalog: per unit, per box, per pallet
- VAT: applied per country regulations
- Discounts >15%: require manager approval (escalate)

### Pallets
- 1 pallet = up to 300 boxes (standard EUR pallet)
- Multiple SKUs per pallet allowed
- Client assigns pallets to trucks in Pallet Builder
- Truck capacity: up to 33 pallets (standard truck)

### Payment
- Bank transfer (SEPA)
- Invoice due date = issue date + 30 days (NET-30) or + 60 days (NET-60)
- Overdue invoices trigger reminder notifications

### Support Hours
- AI assistant: 24/7 (automated)
- Human managers: weekdays 10:00-15:00 CET
- Outside hours: AI handles, escalates if needed

### What AI Cannot Do
- Confirm custom prices or special discounts >15%
- Modify confirmed/shipped orders
- Process payments directly
- Access another client's data
`;
