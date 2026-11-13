import type { QueuedFile, FactSource } from '../../src/lib/uploads.ts'
export const SAMPLE_PERIOD = { start: '2026-11-01', end: '2026-11-30' }
/** Generated demo data uses the supplied dataset schema and the production pipeline. */
export const SAMPLE_CSV: Record<FactSource, string> = {
  POS: `receipt_no,line_no,export_seq,store_key,business_date,posting_date,net_usd_month_end,discount_usd_daily
R1,01,1,S01,2026-11-05,2026-11-05,900.00,100.00
R1,01,2,S01,2026-11-05,2026-11-05,900.00,100.00
R2,01,1,S01,2026-11-06,2026-11-06,450.00,50.00
R3,01,1,S01,2026-10-31,2026-11-02,300.00,0.00
R4,01,1,S01,2026-11-30,2026-12-02,200.00,0.00`,
  WEB: `web_order_id,store_key,order_date,delivery_date,return_date,order_status,gross_usd_daily,net_usd_month_end,discount_usd_daily
W1,S01,2026-11-03,2026-11-04,,Delivered,800.00,720.00,80.00
W2,S01,2026-11-05,,,Cancelled,300.00,270.00,30.00
W3,S01,2026-11-29,2026-12-01,,Delivered,400.00,360.00,40.00
W4,S01,2026-10-30,2026-11-01,,Delivered,600.00,540.00,60.00
W5,S01,2026-11-10,2026-11-11,2026-11-20,Returned,500.00,450.00,50.00`,
  GL: `journal_id,posting_date,store_key,journal_type,amount_usd
G1,2026-11-05,S01,POS,-900.00
G2,2026-11-02,S01,POS_CATCHUP,-300.00
G3,2026-12-02,S01,POS,-200.00
G4,2026-11-04,S01,WEB,-720.00
G5,2026-12-01,S01,WEB,-360.00
G6,2026-11-01,S01,WEB,-540.00
G7,2026-11-11,S01,WEB,-450.00
G8,2026-11-20,S01,WEB_RETURN,450.00`,
  Flash: `month_end_date,revenue_usd
2026-11-30,4700.00`,
}
export function createSampleFiles(): QueuedFile[] {
  return (Object.entries(SAMPLE_CSV) as [FactSource, string][]).map(
    ([source, csv]) => ({
      id: crypto.randomUUID(),
      source,
      sample: true,
      file: new File([csv], `sample_${source.toLowerCase()}.csv`, {
        type: 'text/csv',
      }),
    }),
  )
}
