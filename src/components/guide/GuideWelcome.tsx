import { FileInput, Play, Route, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import '@/interactive-guide.css'

export type GuideMode = 'automatic' | 'guided'

export interface GuideWelcomeProps {
  open: boolean
  onStart: (mode: GuideMode) => void
  onDismiss: () => void
}

export function GuideWelcome({ open, onStart, onDismiss }: GuideWelcomeProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss()
      }}
    >
      <DialogContent
        className="guide-welcome max-w-[680px] gap-0"
        closeLabel="Để sau"
        data-tour="guide-welcome"
      >
        <div className="guide-welcome-intro">
          <span className="guide-welcome-symbol">
            <Sparkles size={23} aria-hidden="true" />
          </span>
          <p className="guide-eyebrow">HƯỚNG DẪN SỬ DỤNG · NEXA HOME</p>
          <DialogTitle className="guide-welcome-title">
            Khám phá quy trình đối soát cùng dữ liệu mẫu Nexa Home
          </DialogTitle>
          <DialogDescription className="guide-welcome-description">
            Theo dõi một phiên thao tác trên ứng dụng hoặc tự thực hành từng
            bước, từ file nguồn đến kết quả đối soát.
          </DialogDescription>
          <ol className="guide-welcome-journey" aria-label="Nội dung hướng dẫn">
            <li>
              <span>01</span>Nhập và cấu hình dữ liệu
            </li>
            <li>
              <span>02</span>Chuẩn hóa, làm sạch và kiểm tra
            </li>
            <li>
              <span>03</span>Rà soát bút toán, chứng từ và ngoại lệ
            </li>
            <li>
              <span>04</span>Khám phá 4 trang dashboard
            </li>
          </ol>
        </div>
        <div className="guide-welcome-actions">
          <p className="guide-consent">
            <ShieldCheck size={16} aria-hidden="true" />
            Chọn bắt đầu là đồng ý sử dụng dữ liệu mẫu trong một phiên minh họa
            riêng. Bạn có thể quay về không gian làm việc ban đầu.
          </p>
          <button
            type="button"
            className="guide-mode-card guide-mode-primary"
            data-tour="guide-start-automatic"
            onClick={() => onStart('automatic')}
          >
            <span className="guide-mode-icon">
              <Play size={19} aria-hidden="true" />
            </span>
            <span>
              <strong>Xem trình diễn tự động</strong>
              <small>Ứng dụng thao tác lần lượt, bạn quan sát.</small>
            </span>
            <span className="guide-mode-cta">Bắt đầu với dữ liệu mẫu</span>
          </button>
          <button
            type="button"
            className="guide-mode-card"
            data-tour="guide-start-guided"
            onClick={() => onStart('guided')}
          >
            <span className="guide-mode-icon">
              <Route size={19} aria-hidden="true" />
            </span>
            <span>
              <strong>Tôi tự làm theo hướng dẫn</strong>
              <small>Bạn thao tác, hướng dẫn kiểm tra từng bước.</small>
            </span>
            <span className="guide-mode-cta">Bắt đầu với dữ liệu mẫu</span>
          </button>
          <div className="guide-welcome-footer">
            <span>
              <FileInput size={14} aria-hidden="true" /> Có thể mở lại từ “Hướng
              dẫn sử dụng”.
            </span>
            <Button variant="ghost" onClick={onDismiss} data-tour="guide-defer">
              Để sau
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
