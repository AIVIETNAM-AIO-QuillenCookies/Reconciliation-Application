import { createPortal } from 'react-dom'
import '@/expanded-view.css'

/** Dims and blurs everything behind an expanded view; click to close. */
export function ExpandBackdrop({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="expand-backdrop" aria-hidden="true" onClick={onClose} />,
    document.body,
  )
}
