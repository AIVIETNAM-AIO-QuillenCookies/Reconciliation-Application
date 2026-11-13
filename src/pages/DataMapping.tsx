import { Navigate } from 'react-router-dom'

/** Preserve old mapping bookmarks while routing them into the guided import. */
export function DataMapping() {
  return <Navigate to="/ingestion" replace />
}
