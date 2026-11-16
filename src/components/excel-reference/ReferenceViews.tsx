/**
 * Public entry point for the Excel reference ("Tạm xem theo Excel") views.
 * Each view lives in its own module next to this file; pages and tests keep
 * importing from here. The shared stylesheet is imported after the views so
 * the bundled CSS order stays exactly as it was before the split.
 */
export {
  ReferencePeriodControl,
  type ReferenceSheetName,
  type ReferenceViewProps,
} from './ReferencePrimitives'
export { ReferenceDashboard } from './ReferenceDashboard'
export { ReferenceExceptions } from './ReferenceExceptions'
export { ReferenceTables } from './ReferenceTables'
export { ReferenceMethodology } from './ReferenceMethodology'
export { ReferenceAccountingSummary } from './ReferenceAccountingSummary'
import './reference-views.css'
