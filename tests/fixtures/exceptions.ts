import type { ReconciliationException } from '../../src/lib/exceptions.ts'

/** Supplied cases plus illustrative examples. Dates use 2026; an unknown store stays unknown. */
export const mockExceptions: readonly ReconciliationException[] = [
  {
    id: 'EXC-001',
    storeKey: 'NX007',
    date: '2026-03-29',
    reference: 'POS-NX007-0329',
    category: 'Data Error',
    type: 'Duplicate POS',
    duplicateLineCount: 12,
    deltaCents: 1_262_200,
    description:
      '12 duplicate POS lines detected in the March 29 export. Investigate repeated export sequences before adjusting revenue.',
  },
  {
    id: 'EXC-002',
    storeKey: 'NX057',
    date: '2026-11-21',
    reference: 'GL-NX057-1121',
    category: 'Missing GL',
    type: 'Missing GL',
    deltaCents: 722_800,
    description:
      'The source store-day has revenue but no matching GL day. Review whether a POS catchup entry is needed.',
  },
  {
    id: 'EXC-003',
    storeKey: null,
    date: '2026-09-25',
    reference: 'ADJ-0925',
    category: 'Unexplained',
    type: 'Manual Journal',
    deltaCents: -125_000,
    description:
      'Unexplained manual journal ADJ-0925. Ask Finance for the supporting calculation and business rationale. The supplied case does not identify a store.',
  },
  {
    id: 'EXC-004',
    storeKey: 'NX014',
    date: '2026-10-04',
    reference: 'POS-NX014-1004',
    category: 'Data Error',
    type: 'Duplicate POS',
    duplicateLineCount: 4,
    deltaCents: 342_000,
    description:
      'Illustrative case: four POS lines were repeated in a second export batch.',
  },
  {
    id: 'EXC-005',
    storeKey: 'NX032',
    date: '2026-10-31',
    reference: 'GL-NX032-1031',
    category: 'Missing GL',
    type: 'Missing GL',
    deltaCents: 214_050,
    description:
      'Illustrative case: source net revenue has no GL store-day total for the reporting date.',
  },
  {
    id: 'EXC-006',
    storeKey: 'NX011',
    date: '2026-09-30',
    reference: 'ADJ-0930',
    category: 'Unexplained',
    type: 'Manual Journal',
    deltaCents: -87_500,
    description:
      'Illustrative case: a month-end manual revenue adjustment needs supporting documentation.',
  },
  {
    id: 'EXC-007',
    storeKey: 'NX022',
    date: '2026-11-03',
    reference: 'DAY-NX022-1103',
    category: 'Unexplained',
    type: 'Daily Variance',
    deltaCents: 31_575,
    description:
      'Illustrative case: the source and GL store-day totals differ after known adjustments.',
  },
  {
    id: 'EXC-008',
    storeKey: 'NX049',
    date: '2026-10-16',
    reference: 'GL-NX049-1016',
    category: 'Missing GL',
    type: 'Missing GL',
    deltaCents: 24_640,
    description:
      'Illustrative case: a small source store-day total has no GL posting.',
  },
  {
    id: 'EXC-009',
    storeKey: 'NX063',
    date: '2026-11-02',
    reference: 'DAY-NX063-1102',
    category: 'Unexplained',
    type: 'Daily Variance',
    deltaCents: -20_525,
    description:
      'Illustrative case: a negative difference exceeds the review threshold by $5.25.',
  },
]
