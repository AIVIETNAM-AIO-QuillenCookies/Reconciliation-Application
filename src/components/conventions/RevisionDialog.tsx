import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

export function RevisionDialog({
  open,
  nextVersion,
  changedCount,
  onCancel,
  onSave,
}: {
  open: boolean
  nextVersion: string
  changedCount: number
  onCancel: () => void
  onSave: (entry: { note: string; author: string }) => void
}) {
  const [note, setNote] = useState('')
  const [author, setAuthor] = useState('')
  const [touched, setTouched] = useState(false)
  const noteId = useId()
  const authorId = useId()
  const errorId = useId()
  const invalid = !note.trim()
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent
        className="cd-dialog max-w-lg"
        closeLabel="Đóng hộp ghi nhận phiên bản"
      >
        <form
          className="cd-dialog-body"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            setTouched(true)
            if (invalid) return
            onSave({ note, author })
            setNote('')
            setAuthor('')
            setTouched(false)
          }}
        >
          <header>
            <span className="cd-dialog-kicker">Phiên bản {nextVersion}</span>
            <DialogTitle>Ghi nhận phiên bản tài liệu</DialogTitle>
            <DialogDescription>
              {changedCount} khối nội dung thay đổi so với bản đang dùng. Bản
              này chỉ tồn tại trong phiên; hãy xuất JSON nếu cần giữ lại.
            </DialogDescription>
          </header>
          <div className="cd-dialog-fields">
            <label htmlFor={noteId} className="cd-field-label">
              Nội dung thay đổi <span aria-hidden="true">*</span>
            </label>
            <textarea
              id={noteId}
              className="cd-textarea"
              rows={3}
              aria-required="true"
              aria-invalid={touched && invalid}
              aria-describedby={touched && invalid ? errorId : undefined}
              placeholder="Ví dụ: Điều chỉnh ngưỡng kiểm tra cầu nối theo quyết định của nhóm Finance."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            {touched && invalid && (
              <p id={errorId} className="cd-field-error" role="alert">
                Hãy ghi nội dung thay đổi để lịch sử sửa đổi đủ căn cứ.
              </p>
            )}
            <label htmlFor={authorId} className="cd-field-label">
              Người sửa
            </label>
            <input
              id={authorId}
              className="cd-input"
              placeholder="Không bắt buộc"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
            />
          </div>
          <footer className="cd-dialog-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
            >
              Quay lại chỉnh sửa
            </Button>
            <Button type="submit" size="sm">
              Lưu phiên bản {nextVersion}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = 'default',
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  tone?: 'default' | 'danger'
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent
        className="cd-dialog max-w-md"
        closeLabel="Đóng hộp xác nhận"
      >
        <div className="cd-dialog-body">
          <header>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div>{children}</div>
            </DialogDescription>
          </header>
          <footer className="cd-dialog-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tone === 'danger' ? 'destructive' : 'default'}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  )
}
