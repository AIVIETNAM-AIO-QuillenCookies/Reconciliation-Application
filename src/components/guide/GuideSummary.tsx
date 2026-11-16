import { CheckCircle2, CircleAlert, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import '@/interactive-guide.css'

export interface GuideSummaryProps {
  open: boolean
  steps?: { title: string; status: 'completed' | 'pending' | 'limited' }[]
  exceptions?: { id: string; description: string; status: string }[]
  onRestart: () => void
  onExit: () => void
}

export function GuideSummary({
  open,
  steps = [],
  exceptions = [],
  onRestart,
  onExit,
}: GuideSummaryProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onExit()
      }}
    >
      <DialogContent
        className="guide-summary max-w-[760px] gap-0"
        closeLabel="Quay về không gian ban đầu"
        data-tour="guide-summary"
      >
        <header className="guide-summary-heading">
          <span className="guide-welcome-symbol">
            <CheckCircle2 size={25} aria-hidden="true" />
          </span>
          <p className="guide-eyebrow">PHIÊN THỰC HÀNH NEXA HOME</p>
          <DialogTitle className="guide-welcome-title">
            Bạn đã đi qua quy trình đối soát
          </DialogTitle>
          <DialogDescription>
            Đây là kết quả hướng dẫn trong phiên dữ liệu mẫu hiện tại.
          </DialogDescription>
        </header>
        <div className="guide-summary-body">
          {steps.length > 0 && (
            <table className="guide-summary-table">
              <caption>Các bước đã thực hiện</caption>
              <thead>
                <tr>
                  <th scope="col">Nội dung</th>
                  <th scope="col">Kết quả hướng dẫn</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, index) => (
                  <tr key={`${index}-${step.title}`}>
                    <td>{step.title}</td>
                    <td>
                      {step.status === 'completed'
                        ? 'Đã thực hiện'
                        : step.status === 'limited'
                          ? 'Có giới hạn'
                          : 'Chưa thực hiện'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {exceptions.length > 0 && (
            <table className="guide-summary-table">
              <caption>Ngoại lệ vẫn cần xử lý</caption>
              <thead>
                <tr>
                  <th scope="col">Mã & nội dung</th>
                  <th scope="col">Trạng thái nguồn</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.id}</strong> {item.description}
                    </td>
                    <td>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="guide-summary-notice">
            <CircleAlert size={19} aria-hidden="true" />
            <p>
              <strong>
                Hoàn thành hướng dẫn không đồng nghĩa đã xác nhận đủ chứng từ
                hoặc đóng toàn bộ ngoại lệ.
              </strong>{' '}
              Khoản ADJ 1.250 USD vẫn chưa giải thích; cần Finance bổ sung bằng
              chứng gốc.
            </p>
          </div>
        </div>
        <footer className="guide-summary-footer">
          <Button
            variant="outline"
            onClick={onRestart}
            data-tour="guide-summary-restart"
          >
            <RotateCcw size={15} />
            Xem lại từ đầu
          </Button>
          <Button onClick={onExit}>Quay về không gian ban đầu</Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
