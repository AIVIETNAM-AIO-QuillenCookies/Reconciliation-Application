import { useEffect, useState } from 'react'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import type { GLPatch, GLRecord } from '@/lib/gl-review'
import { money } from './review-format'

export function CorrectionForm({
  record,
  onDirtyChange,
  onPreviewChange,
}: {
  record: GLRecord
  onDirtyChange: (dirty: boolean) => void
  onPreviewChange: (kind: 'apply' | 'undo' | null) => void
}) {
  const store = useAppStore()
  const [amount, setAmount] = useState(
    record.amountCents == null ? '' : (record.amountCents / 100).toFixed(2),
  )
  const [date, setDate] = useState(record.postingDate || '')
  const [period, setPeriod] = useState(record.period || '')
  const [channel, setChannel] = useState(record.channel || 'UNALLOCATED')
  const [storeKey, setStoreKey] = useState(record.storeKey || '-1')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ReturnType<
    typeof store.previewGLCorrection
  > | null>(null)
  const [previewKind, setPreviewKind] = useState<'apply' | 'undo'>('apply')
  useEffect(() => {
    onPreviewChange(preview ? previewKind : null)
  }, [preview, previewKind, onPreviewChange])
  useEffect(() => {
    onDirtyChange(
      amount !==
        (record.amountCents == null
          ? ''
          : (record.amountCents / 100).toFixed(2)) ||
        date !== (record.postingDate || '') ||
        period !== (record.period || '') ||
        channel !== (record.channel || 'UNALLOCATED') ||
        storeKey !== (record.storeKey || '-1') ||
        !!reason.trim(),
    )
  }, [amount, date, period, channel, storeKey, reason, record, onDirtyChange])
  const active = store.glCorrections.some(
    (item) => item.recordId === record.id && item.active,
  )
  const prepare = () => {
    try {
      const patch: GLPatch = {}
      if (
        amount !==
        (record.amountCents == null
          ? ''
          : (record.amountCents / 100).toFixed(2))
      ) {
        if (!/^[+-]?\d+(\.\d{1,2})?$/.test(amount.trim()))
          throw new Error(
            'Nhập số tiền GL gốc (USD) bằng số, tối đa 2 chữ số thập phân.',
          )
        const cents = Math.round(Number(amount) * 100)
        if (!Number.isSafeInteger(cents))
          throw new Error('Số tiền vượt phạm vi hỗ trợ.')
        patch.amountCents = cents
      }
      if (date !== (record.postingDate || '')) patch.postingDate = date
      if (period !== (record.period || '')) patch.period = period
      if (storeKey !== (record.storeKey || '-1')) patch.storeKey = storeKey
      if (channel !== (record.channel || 'UNALLOCATED')) patch.channel = channel
      if (!Object.keys(patch).length)
        throw new Error('Chưa có thay đổi để xem trước.')
      setPreview(store.previewGLCorrection(record.id, patch, reason))
      setPreviewKind('apply')
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPreview(null)
    }
  }
  const applyPreview = () => {
    if (!preview || store.isProcessing) return
    try {
      if (previewKind === 'undo')
        store.undoGLCorrection(record.id, preview.reason)
      else store.applyGLCorrection(record.id, preview.patch, preview.reason)
      setPreview(null)
      setError('')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : String(issue))
    }
  }
  return (
    <div className="correction-section">
      <h3>Đề xuất điều chỉnh dữ liệu hiệu lực</h3>
      <p className="mt-2 text-muted-foreground">
        Chỉ áp dụng cho phiên đối soát trong tab này. Dữ liệu gốc được giữ
        nguyên. Thao tác này không sửa sổ cái ERP.
      </p>
      <form
        id="gl-correction-form"
        className="accounting-form"
        onChange={() => setPreview(null)}
        onSubmit={(event) => {
          event.preventDefault()
          if (
            (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
              'value',
            ) === 'commit'
          )
            applyPreview()
          else prepare()
        }}
      >
        <label>
          Số tiền GL gốc (USD) · dấu sổ cái
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <div className="row">
          <label>
            Ngày ghi sổ
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Kỳ
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
        </div>
        <div className="row">
          <label>
            Kênh
            <input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              list="gl-review-channels"
            />
            <datalist id="gl-review-channels">
              <option value="STORE" />
              <option value="WEB" />
              <option value="UNALLOCATED" />
            </datalist>
          </label>
          <label>
            Khóa cửa hàng
            <input
              value={storeKey}
              onChange={(e) => setStoreKey(e.target.value)}
            />
          </label>
        </div>
        <label>
          Lý do và căn cứ (bắt buộc)
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {preview && (
          <div className="accounting-preview">
            <strong>
              {previewKind === 'undo' ? 'Hoàn tác về nguồn gốc' : 'Trước → Sau'}
            </strong>
            <table>
              <tbody>
                <tr>
                  <td>Số tiền GL gốc</td>
                  <td>
                    {money(preview.before.amountCents)} →{' '}
                    {money(preview.after.amountCents)}
                  </td>
                </tr>
                <tr>
                  <td>Doanh thu</td>
                  <td>
                    {money(preview.before.revenueCents)} →{' '}
                    {money(preview.after.revenueCents)}
                  </td>
                </tr>
                <tr>
                  <td>Ngày / kỳ</td>
                  <td>
                    {preview.before.postingDate} / {preview.before.period} →{' '}
                    {preview.after.postingDate} / {preview.after.period}
                  </td>
                </tr>
                <tr>
                  <td>Phân bổ</td>
                  <td>
                    {preview.before.channel} / {preview.before.storeKey} →{' '}
                    {preview.after.channel} / {preview.after.storeKey}
                  </td>
                </tr>
              </tbody>
            </table>
            <p>Δ Tổng GL: {money(preview.totalGLDeltaCents)}</p>
            <p>Δ Chưa giải thích: {money(preview.unexplainedDeltaCents)}</p>
            {!preview.complete && (
              <p className="font-medium text-warning">
                Ảnh hưởng tạm tính: nguồn chưa đủ để đối soát toàn bộ. Khôi phục
                dữ liệu gốc không hợp lệ sẽ chặn lại các đầu ra phụ thuộc.
              </p>
            )}
            <p>
              Chênh lệch nguồn − GL thay đổi ngược dấu doanh thu; các nhóm cửa
              hàng × ngày liên quan sẽ được tính lại.
            </p>
            <h3>Ảnh hưởng theo kỳ / kênh</h3>
            {preview.impacts.map((impact, index) => (
              <p key={index}>
                {impact.period} · {impact.channel}: {money(impact.beforeCents)}{' '}
                → {money(impact.afterCents)}
              </p>
            ))}
          </div>
        )}
        {active && (
          <Button
            variant="outline"
            size="sm"
            disabled={store.isProcessing}
            type="button"
            onClick={() => {
              try {
                setPreview(store.previewGLUndo(record.id, reason))
                setPreviewKind('undo')
                setError('')
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e))
              }
            }}
          >
            <Undo2 className="size-3.5" />
            Xem trước hoàn tác
          </Button>
        )}
      </form>
    </div>
  )
}
