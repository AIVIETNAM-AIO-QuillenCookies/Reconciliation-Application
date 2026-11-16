import { useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  Circle,
  FileSpreadsheet,
  LoaderCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore } from '@/lib/store'
import {
  REFERENCE_FILE_NAME,
  REFERENCE_STEPS,
  allowReferenceSwitch,
} from '@/lib/excel-reference-session'
import { explainError } from '@/lib/i18n'
import '@/excel-reference-controls.css'

export function ExcelReferenceButton({
  compact = false,
}: {
  compact?: boolean
}) {
  const store = useAppStore()
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label="Tạm xem theo Excel"
      title="Tạm xem theo Excel"
      onClick={() => {
        if (allowReferenceSwitch()) void store.loadExcelReference()
      }}
    >
      <FileSpreadsheet className="size-3.5" />
      <span className={compact ? 'hidden sm:inline' : undefined}>
        Tạm xem theo Excel
      </span>
    </Button>
  )
}

export function ExcelReferenceBanner() {
  const store = useAppStore()
  if (store.activeResult.source !== 'excel') return null
  return (
    <aside className="excel-source-banner" aria-label="Nguồn kết quả đang xem">
      <div className="excel-source-identity">
        <FileSpreadsheet className="size-4 shrink-0" aria-hidden="true" />
        <strong>Kết quả tham chiếu Excel</strong>
        <span
          className="excel-source-filename"
          title={store.activeResult.workbook.fileName}
        >
          {store.activeResult.workbook.fileName}
        </span>
        <span
          className="excel-source-basis"
          title="USD theo workbook; không quy đổi FX thêm. Phiên xem thử trong tab hiện tại. Luồng Raw và hồ sơ rà soát được giữ riêng."
        >
          USD · phiên xem thử
        </span>
      </div>
      <div className="excel-source-actions">
        <Button variant="ghost" size="sm" onClick={store.openExcelReference}>
          File & tiến trình
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={store.disableExcelReference}
        >
          Tắt xem thử · Quay lại xử lý Raw
        </Button>
      </div>
    </aside>
  )
}

/** This dialog belongs to the reference session; Raw progress stays untouched. */
export function ExcelReferenceDialog() {
  const store = useAppStore()
  const reference = store.excelReference
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const workbook = reference.workbook
  const tableLinks = (['Cau_noi', 'Nhat_ky_ngoai_le', 'Chi_tiet'] as const).map(
    (sheet) => (
      <Button key={sheet} variant="outline" size="sm" asChild>
        <Link
          to={`/processing?sheet=${sheet}`}
          onClick={store.closeExcelReference}
        >
          Xem bảng {sheet}
        </Link>
      </Button>
    ),
  )
  return (
    <Dialog
      open={reference.panelOpen}
      onOpenChange={(open) => !open && store.closeExcelReference()}
    >
      <DialogContent
        className="excel-reference-dialog"
        closeLabel="Ẩn tiến trình xem thử"
      >
        <header>
          <DialogTitle>Xem thử theo Excel</DialogTitle>
          <DialogDescription>
            Đọc kết quả đã làm trong workbook để xem các màn hình kết quả. Dữ
            liệu chỉ dùng trong tab hiện tại.
          </DialogDescription>
        </header>
        <div className="excel-reference-dialog-body">
          <section className="excel-reference-file">
            <FileSpreadsheet
              className="size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <strong>{reference.fileName ?? REFERENCE_FILE_NAME}</strong>
              <p>USD theo workbook · không quy đổi FX thêm</p>
            </div>
            <input
              ref={input}
              type="file"
              accept=".xlsx"
              className="sr-only"
              aria-label="Chọn workbook tham chiếu"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file && allowReferenceSwitch())
                  void store.loadExcelReference(file)
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => input.current?.click()}
            >
              Chọn workbook
            </Button>
          </section>
          {reference.status === 'idle' && (
            <p className="text-sm text-muted-foreground">
              Chưa có dữ liệu tham chiếu. Mở workbook đi kèm hoặc chọn file của
              bạn.
            </p>
          )}
          <ol
            className="excel-reference-steps"
            aria-label="Tiến trình xem thử Excel"
            aria-live="polite"
          >
            {REFERENCE_STEPS.map((title, index) => {
              const complete = reference.step > index
              const running =
                reference.status === 'loading' && reference.step === index
              const failed =
                reference.status === 'error' && reference.step === index
              return (
                <li key={title}>
                  {complete ? (
                    <CheckCircle2 className="size-5 text-primary" />
                  ) : running ? (
                    <LoaderCircle className="size-5 animate-spin text-primary" />
                  ) : (
                    <Circle className="size-5 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <strong>
                      {index + 1}. {title}
                    </strong>
                    <p>
                      Dùng kết quả Excel ·{' '}
                      {complete
                        ? 'Hoàn tất'
                        : running
                          ? 'Đang xử lý'
                          : failed
                            ? 'Có lỗi'
                            : 'Chờ xử lý'}
                      {reference.counts[index] !== undefined
                        ? ` · ${reference.counts[index].toLocaleString('vi-VN')} ${index === 0 ? 'sheet' : index === 1 ? 'kiểm tra' : index === 3 ? 'tháng' : 'bản ghi'}`
                        : ''}
                    </p>
                    {workbook && index === 2 && (
                      <p>
                        {workbook.bridgeRows.length} khoản mục ·{' '}
                        {workbook.exceptions.length} ngoại lệ ·{' '}
                        {workbook.details.length.toLocaleString('vi-VN')} chi
                        tiết
                      </p>
                    )}
                    {workbook && (index === 0 || index === 2) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {tableLinks}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
          {reference.error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-red-50 p-3 text-sm text-destructive"
            >
              {reference.error}
            </p>
          )}
          {workbook && (
            <section
              className="excel-reference-source-details"
              aria-label="Nguồn và cơ sở tính Excel"
            >
              <h3>Nguồn và cơ sở tính</h3>
              <p>
                Phiên xem thử trong tab hiện tại · {reference.period.start} →{' '}
                {reference.period.end}
              </p>
              <p>
                Sheet Cau_noi: giá trị tháng và cầu nối. Sheet Chi_tiet: giao
                dịch, mã khoản và dòng nguồn. Sheet Nhat_ky_ngoai_le: trạng thái
                ngoại lệ theo workbook.
              </p>
              {workbook.dashboard && (
                <p>
                  Đủ 4 dashboard: Tổng quan, Cầu nối chênh lệch, Đối soát chi
                  tiết, Hoàn trả & chất lượng. Chi tiết lấy từ các sheet POS,
                  WEB, GL và Flash chuẩn hóa; bảng chất lượng lấy từ QC_Summary.
                  Ô chưa có đánh giá được giữ nguyên để bổ sung sau.
                </p>
              )}
              <p>
                Δ = GL − Sales Flash; Δ% = Δ / Sales Flash. Giá trị USD giữ theo
                workbook, cộng trước khi làm tròn để hiển thị; không quy đổi FX
                thêm.
              </p>
              <p>
                Cầu nối khớp về số học không có nghĩa đã đủ bằng chứng kế toán.
                Trạng thái ngoại lệ được giữ theo Excel; các hồ sơ Raw chưa được
                xác nhận hay đóng bởi chế độ này.
              </p>
            </section>
          )}
          <details className="excel-reference-technical">
            <summary>Thông tin kỹ thuật & trạng thái luồng Raw</summary>
            <p>
              Raw: {store.status} · {store.period.start} → {store.period.end}
            </p>
            {store.error && <p>{explainError(store.error)}</p>}
            <p>
              Phiên Raw:{' '}
              {store.runFailure?.runId ??
                store.pipelineProgress?.engineRunId ??
                'Chưa có'}{' '}
              · Pipeline và bằng chứng Raw được giữ riêng.
            </p>
            <p>
              Bản đi kèm sao chép từ workbook thực tế. Có thể chọn lại file. Chế
              độ mặc định tắt; tải lại trang xóa phiên tham chiếu.
            </p>
          </details>
        </div>
        <footer>
          <Button
            variant="outline"
            size="sm"
            onClick={store.disableExcelReference}
          >
            {reference.status === 'loading'
              ? 'Hủy tải · Quay lại Raw'
              : 'Tắt xem thử · Quay lại xử lý Raw'}
          </Button>
          {reference.status !== 'loading' && !workbook && (
            <Button
              size="sm"
              onClick={() => {
                if (allowReferenceSwitch()) void store.loadExcelReference()
              }}
            >
              Mở workbook đi kèm
            </Button>
          )}
          {workbook && (
            <Button
              size="sm"
              onClick={() => {
                store.closeExcelReference()
                navigate('/')
              }}
            >
              Hiển thị dashboard
            </Button>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  )
}
