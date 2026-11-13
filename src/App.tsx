import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { DuckDBProvider } from '@/hooks/useDuckDB'
import { AppStoreProvider } from '@/components/AppStoreProvider'
import { Dashboard } from '@/pages/Dashboard'
import { DataIngestion } from '@/pages/DataIngestion'
import { DataMapping } from '@/pages/DataMapping'
import { ExceptionLog } from '@/pages/ExceptionLog'
import { Settings } from '@/pages/Settings'
import { Methodology } from '@/pages/Methodology'
import { DataProcessing } from '@/pages/DataProcessing'
import { AccountingReview } from '@/pages/AccountingReview'

export default function App() {
  return (
    <DuckDBProvider>
      <AppStoreProvider>
        {/* Hash routing keeps deep links working on any static file host. */}
        <HashRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="ingestion" element={<DataIngestion />} />
              <Route path="ingestion/mapping" element={<DataMapping />} />
              <Route path="exceptions" element={<ExceptionLog />} />
              <Route path="settings" element={<Settings />} />
              <Route path="methodology" element={<Methodology />} />
              <Route path="processing" element={<DataProcessing />} />
              <Route path="accounting-review" element={<AccountingReview />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </AppStoreProvider>
    </DuckDBProvider>
  )
}
