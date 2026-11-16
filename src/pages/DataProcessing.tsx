import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Database, Workflow, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EvidenceTable } from '@/components/methodology/EvidenceTable'
import { SelectionInspector } from '@/components/methodology/SelectionInspector'
import { useAppStore } from '@/lib/store'
import { InformationNote } from '@/components/PageInformation'
import { ReferenceTables } from '@/components/excel-reference/ReferenceViews'
import { viMessage } from '@/lib/i18n'
import {
  EMPTY_EVIDENCE_FILTERS,
  type WorkspaceSelection,
} from '@/lib/model-workspace'
import {
  resolveProcessingTable,
  processingTableUrl,
  posBranchLabel,
} from '@/lib/processing-workspace'
import type {
  RunEvidence,
  EvidenceTable as Table,
} from '@/lib/reconciliation-evidence'
import '@/methodology.css'
import '@/processing.css'
import { PosDiagnosticsView } from '@/components/processing/PosDiagnosticsView'
import { GLDiagnosticsView } from '@/pages/AccountingReview'

const tableGroups = [
  ['input', 'Nguồn đã đọc'],
  ['normalized', 'Chuẩn hóa & làm sạch'],
  ['logical', 'Sự kiện ghi nhận'],
  ['aggregate', 'Tổng hợp & đối soát'],
  ['dimension', 'Tham chiếu đã nạp'],
] as const
function DataPanels({
  evidence,
  table,
}: {
  evidence: RunEvidence
  table: Table
}) {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(EMPTY_EVIDENCE_FILTERS)
  const [selection, setSelection] = useState<WorkspaceSelection>({
    kind: 'table',
    id: table.id,
    runId: evidence.runId,
  })
  const changeTable = (id: string) =>
    navigate(processingTableUrl(evidence.runId, id))
  return (
    <div className="processing-data-panels">
      <nav
        className="processing-table-tree"
        aria-label="Các bảng trong snapshot"
      >
        {tableGroups.map(([kind, title]) => {
          const tables = evidence.tables.filter((item) => item.kind === kind)
          return (
            tables.length > 0 && (
              <section key={kind}>
                <h2>{title}</h2>
                {tables.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    data-tour={`processing-table-${item.id}`}
                    aria-current={item.id === table.id ? 'true' : undefined}
                    onClick={() => changeTable(item.id)}
                  >
                    {posBranchLabel(item.id) !== item.id
                      ? posBranchLabel(item.id)
                      : viMessage(item.label)}
                    <span className="processing-table-count">
                      {item.rowCount.toLocaleString('vi-VN')} dòng
                    </span>
                  </button>
                ))}
              </section>
            )
          )
        })}
      </nav>
      <div
        className="processing-data-main"
        data-tour="processing-table"
        data-table-id={table.id}
        data-row-count={table.rowCount}
      >
        <EvidenceTable
          evidence={evidence}
          table={table}
          onTableChange={changeTable}
          selection={selection}
          onSelect={setSelection}
          filters={filters}
          onFiltersChange={setFilters}
          processing={false}
        />
      </div>
      <aside
        className="processing-data-inspector"
        aria-label="Dòng và các bước đã áp dụng"
      >
        <SelectionInspector
          selection={selection}
          evidence={evidence}
          tab="evidence"
          onNode={() => navigate('/methodology')}
          onRule={() => navigate('/methodology')}
          onTable={changeTable}
        />
      </aside>
    </div>
  )
}
export function DataProcessing() {
  const store = useAppStore()
  const result = store.activeResult
  const [params] = useSearchParams()
  const requestedSheet = params.get('sheet')
  const sheet =
    requestedSheet === 'Cau_noi' ||
    requestedSheet === 'Nhat_ky_ngoai_le' ||
    requestedSheet === 'Chi_tiet'
      ? requestedSheet
      : undefined
  if (
    result.source === 'excel' &&
    (params.has('run') ||
      params.has('table') ||
      (requestedSheet !== null && sheet === undefined))
  )
    return (
      <section className="excel-reference-view reference-processing viewport-workspace">
        <header className="excel-reference-heading">
          <div>
            <h1>Xử lý dữ liệu</h1>
            <InformationNote title="Nguồn dữ liệu xử lý">
              {result.workbook.fileName}
            </InformationNote>
          </div>
        </header>
        <div className="excel-reference-panel">
          <p className="excel-reference-empty">
            Chưa có dữ liệu tương ứng trong file tham chiếu.
          </p>
          <div className="excel-reference-footer">
            <Button asChild variant="outline" size="sm">
              <Link to="/processing?sheet=Cau_noi">
                Mở bảng Cau_noi từ Excel
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    )
  return result.source === 'excel' ? (
    <ReferenceTables
      key={sheet}
      workbook={result.workbook}
      period={result.period}
      setPeriod={store.setExcelReferencePeriod}
      sheet={sheet}
    />
  ) : (
    <RawDataProcessing />
  )
}

function RawDataProcessing() {
  const store = useAppStore()
  const [params] = useSearchParams()
  const evidence = store.reconciliationData?.evidence
  const diagnostics = store.pipelineProgress?.steps
    .map((step) => step.diagnostics)
    .filter((item) => item?.runId === store.pipelineProgress?.engineRunId)
    .at(-1)
  const requestedRun = params.get('run')
  const matchingGLReview =
    store.glReview && (!requestedRun || requestedRun === store.glReview.runId)
      ? store.glReview
      : null
  const failedDiagnostics =
    !evidence &&
    diagnostics &&
    (!requestedRun || requestedRun === diagnostics.runId)
      ? diagnostics
      : undefined
  const resolved = resolveProcessingTable(
    evidence,
    params.get('run'),
    params.get('table'),
  )
  return (
    <section
      data-tour="processing-workspace"
      data-processing-status={store.status}
      data-processing-run={evidence?.runId}
      className="mw-workspace viewport-workspace processing-workspace"
      aria-label="Xử lý dữ liệu"
    >
      <header className="workspace-page-heading">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">
            Xử lý dữ liệu
          </h1>
        </div>
        <Button
          data-tour="processing-progress"
          variant="outline"
          size="sm"
          onClick={store.openProcessingPanel}
          disabled={!store.pipelineProgress}
        >
          <Workflow className="size-4" />
          Xem tiến trình
        </Button>
      </header>
      <InformationNote title="Phạm vi dữ liệu xử lý">
        <p>
          Kỳ báo cáo: {store.period.start} → {store.period.end}. Đơn vị tiền tệ:
          USD.
        </p>
        {evidence && <p>Snapshot của phiên xử lý {evidence.runId}.</p>}
      </InformationNote>
      <div className="processing-run-state">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Database className="size-3.5" />
          {store.status === 'ready' && evidence
            ? `Phiên ${evidence.runId.slice(0, 8)} · Đã xử lý`
            : store.status === 'error'
              ? 'Xử lý chưa hoàn tất'
              : store.status === 'running' || store.status === 'registering'
                ? 'Đang xử lý'
                : 'Chưa có kết quả'}
        </span>
      </div>
      {matchingGLReview && !matchingGLReview.complete ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <GLDiagnosticsView snapshot={matchingGLReview} expanded />
          <Button
            className="mt-3"
            onClick={() => store.openSourceOnboarding('GL')}
          >
            Sửa cấu hình GL
          </Button>
          {failedDiagnostics && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs">
                Xem kiểm tra POS riêng
              </summary>
              <PosDiagnosticsView diagnostics={failedDiagnostics} />
            </details>
          )}
        </div>
      ) : failedDiagnostics ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <PosDiagnosticsView diagnostics={failedDiagnostics} />
        </div>
      ) : resolved.error || !evidence || !resolved.table ? (
        <div
          role="status"
          className="flex min-h-64 flex-1 flex-col items-start justify-center gap-3 rounded-xl border bg-white p-6"
        >
          <AlertCircle className="size-7 text-warning" />
          <h2 className="text-lg font-semibold">Chưa thể mở bảng này</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {resolved.error}
          </p>
          <div className="flex flex-wrap gap-2">
            {evidence && (
              <Button asChild size="sm">
                <Link
                  to={processingTableUrl(evidence.runId, 'expected_events')}
                >
                  Mở snapshot hiện tại
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={store.openOnboarding}>
              Kiểm tra cấu hình nguồn
            </Button>
          </div>
        </div>
      ) : (
        <>
          {store.glReview &&
            store.reviewCases.some(
              (item) => item.status !== 'confirmed' || item.stale,
            ) && <GLDiagnosticsView snapshot={store.glReview} />}
          {evidence.posDiagnostics?.runId === evidence.runId && (
            <details className="max-h-[45vh] shrink-0 overflow-auto rounded-xl border bg-white px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold">
                Chẩn đoán POS & counts từng nhánh · Phiên{' '}
                {evidence.runId.slice(0, 8)}
              </summary>
              <PosDiagnosticsView diagnostics={evidence.posDiagnostics} />
            </details>
          )}
          <InformationNote title="Giới hạn dữ liệu xem trước">
            <p>
              Giữ tối đa {evidence.previewLimit} dòng mỗi bảng từ cùng phiên
              chạy. Tìm kiếm và lọc chỉ áp dụng cho các dòng đã giữ. Các
              relation SQL tạm đã được cleanup; đây là preview để kiểm chứng,
              không phải toàn bộ dữ liệu hay bảng lưu bền.
            </p>
          </InformationNote>
          <DataPanels
            key={`${evidence.runId}:${resolved.table.id}`}
            evidence={evidence}
            table={resolved.table}
          />
        </>
      )}
    </section>
  )
}
