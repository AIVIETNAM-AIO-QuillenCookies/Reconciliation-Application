import { ArrowRight, AlertCircle, Check, CircleMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LocalizedError } from '@/components/LocalizedError'
import {
  displayRoleLabels,
  displayReferenceFields,
  displayPurposeLabels,
  displayMappingFields,
} from '@/lib/localized-model'
import {
  REFERENCE_ROLES,
  requiredReferenceFields,
  type MasterDraft,
  type MasterValidation,
  type ReferenceRole,
} from '@/lib/master-data'
import type { MappingDrafts } from '@/lib/data-mapping'
import type { QueuedFile } from '@/lib/uploads'
import { cn } from '@/lib/utils'

export function MasterFlowSummary({
  master,
  validation,
  files,
  drafts,
  onEdit,
}: {
  master: MasterDraft
  validation?: MasterValidation
  files: QueuedFile[]
  drafts: MappingDrafts
  onEdit: (role: ReferenceRole, relationshipId?: string) => void
}) {
  return (
    <div className="master-flow-summary" aria-label="Sơ đồ cấu hình tham chiếu">
      {REFERENCE_ROLES.map((role) => {
        const config = master.roles[role]
        const reports =
          validation?.joins.filter((item) => item.role === role) ?? []
        const missing = [
          ...(config.usage === 'unconfigured'
            ? ['Chọn sử dụng hoặc không sử dụng role này.']
            : []),
          ...(config.usage === 'enabled'
            ? [
                ...(!config.sheetName ? ['Chưa chọn trang tính.'] : []),
                ...[...requiredReferenceFields(role, config)]
                  .filter((field) => !config.columns[field])
                  .map(
                    (field) =>
                      `Chưa ánh xạ ${displayReferenceFields[role].find((entry) => entry.id === field)?.label ?? field}.`,
                  ),
                ...(!config.relationships.length
                  ? ['Chưa cấu hình phép nối.']
                  : []),
              ]
            : []),
        ]
        const errors = reports.flatMap((report) => report.errors)
        const unused = config.usage === 'not-used'
        const passed = validation?.passed && config.usage === 'enabled'
        const warning = reports.some((report) => report.unmatchedRows > 0)
        const status = unused
          ? 'Không sử dụng'
          : errors.length
            ? 'Lỗi phép nối'
            : missing.length
              ? 'Cần cấu hình'
              : passed
                ? warning
                  ? 'Đã kiểm tra · Có cảnh báo'
                  : 'Đã kiểm tra toàn bộ dữ liệu'
                : 'Chưa kiểm tra'
        const Icon = unused
          ? CircleMinus
          : passed && !warning
            ? Check
            : AlertCircle
        return (
          <article
            key={role}
            className={cn('master-role-card', errors.length > 0 && 'has-error')}
          >
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold">
                {displayRoleLabels[role]}
              </h3>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-[11px]',
                  passed && !warning
                    ? 'text-primary'
                    : unused
                      ? 'text-muted-foreground'
                      : errors.length
                        ? 'text-destructive'
                        : 'text-warning',
                )}
              >
                <Icon className="size-3.5" />
                {status}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onEdit(role)}
              >
                Sửa cấu hình
              </Button>
            </header>
            {unused ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Không nạp role này và không thực hiện phép nối tương ứng.
              </p>
            ) : (
              <>
                {missing.length > 0 && (
                  <ul className="mb-2 list-disc space-y-1 pl-4 text-xs text-warning">
                    {missing.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                )}
                {config.relationships.map((relationship) => {
                  const matching = files.filter(
                    (file) => file.source === relationship.source,
                  )
                  const sourceColumn = (field: string) =>
                    field === 'recognition_period'
                      ? 'Kỳ từ ngày ghi nhận (suy ra trong engine)'
                      : matching
                          .map((file) => {
                            const columns = drafts[file.id]?.columns
                            return `${file.file.name}: ${columns?.[field as keyof typeof columns] || 'Chưa ánh xạ'}`
                          })
                          .join(' · ')
                  return (
                    <div className="master-role-flow" key={relationship.id}>
                      <div>
                        <small>Nguồn dữ liệu</small>
                        <strong>{relationship.source}</strong>
                        <p>{matching.length} tệp đã chọn</p>
                        <p>
                          {relationship.keys
                            .map((key) => sourceColumn(key.sourceField))
                            .join('; ')}
                        </p>
                      </div>
                      <ArrowRight
                        className="size-4 text-primary"
                        aria-hidden="true"
                      />
                      <div>
                        <small>Khóa nối · LEFT JOIN</small>
                        {relationship.keys.map((key, index) => (
                          <p key={index}>
                            {index > 0 && <span className="join-and">AND</span>}
                            {displayMappingFields[relationship.source].find(
                              (field) => field.id === key.sourceField,
                            )?.label ?? 'Kỳ ghi nhận'}{' '}
                            ↔{' '}
                            {config.columns[key.referenceField] ||
                              'Chưa ánh xạ'}
                            <span className="text-muted-foreground">
                              {' '}
                              ({key.type})
                            </span>
                          </p>
                        ))}
                      </div>
                      <ArrowRight
                        className="size-4 text-primary"
                        aria-hidden="true"
                      />
                      <div>
                        <small>Sheet tham chiếu</small>
                        <strong>
                          {config.sheetName || 'Chưa chọn trang tính'}
                        </strong>
                        <p>
                          Dòng tiêu đề:{' '}
                          {master.sheets[config.sheetName]?.headerRow ?? '—'}
                        </p>
                        <p>
                          {Object.entries(config.columns)
                            .filter(([, column]) => column)
                            .map(
                              ([field, column]) =>
                                `${displayReferenceFields[role].find((entry) => entry.id === field)?.label ?? field}: ${column}`,
                            )
                            .join(' · ') || 'Chưa ánh xạ cột'}
                        </p>
                      </div>
                      <ArrowRight
                        className="size-4 text-primary"
                        aria-hidden="true"
                      />
                      <div>
                        <small>Trường đầu ra</small>
                        <strong>
                          {relationship.outputs
                            .map((field) => config.columns[field] || field)
                            .join(', ') || 'Chưa chọn đầu ra'}
                        </strong>
                        <p>{displayPurposeLabels[relationship.purpose]}</p>
                        <p>
                          {relationship.unmatched === 'error'
                            ? 'Không khớp: dừng để sửa'
                            : 'Không khớp: giữ dòng, báo cảnh báo'}
                        </p>
                        <button
                          type="button"
                          className="mt-1 text-primary underline underline-offset-2"
                          onClick={() => onEdit(role, relationship.id)}
                        >
                          Xem chi tiết phép nối
                        </button>
                      </div>
                    </div>
                  )
                })}
                {errors.length > 0 && (
                  <div className="mt-2 text-xs text-destructive">
                    <LocalizedError message={errors[0]} />
                  </div>
                )}
              </>
            )}
          </article>
        )
      })}
    </div>
  )
}
