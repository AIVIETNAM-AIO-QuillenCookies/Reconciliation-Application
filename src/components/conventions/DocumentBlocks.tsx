import {
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { Check, Pencil, Plus, Trash2, Undo2 } from 'lucide-react'
import {
  COMPARISON_LABELS,
  RAW_BUCKET_LABELS,
  compareWithApplication,
  type BridgeBlock,
  type BridgeStep,
  type ConventionBlock,
  type ParameterItem,
  type ParametersBlock,
  type TableBlock,
} from '@/lib/convention-document'

/** Live column supplied by the active result source (workbook or Raw run). */
export interface LiveBridgeColumn {
  label: string
  numeric: boolean
  render: (step: BridgeStep) => ReactNode
  footer?: ReactNode
}

const cx = (...names: (string | false | null | undefined)[]) =>
  names.filter(Boolean).join(' ')
const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const numberText = (value: number) =>
  value.toLocaleString('vi-VN', { maximumFractionDigits: 4 })

/** `identifier` → monospace code, like the source report. */
export function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`\n]+`)/g)
  return (
    <>
      {parts.map((part, index) =>
        part.length > 2 && part.startsWith('`') && part.endsWith('`') ? (
          <code key={index} className="cd-code">
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        ),
      )}
    </>
  )
}

function FormulaExpression({ expression }: { expression: string }) {
  return (
    <>
      {expression.split(/([A-Za-z_][A-Za-z0-9_]*)/g).map((part, index) =>
        /^[A-Za-z_]/.test(part) ? (
          <var key={index}>{part}</var>
        ) : (
          <span key={index} className="cd-operator">
            {part}
          </span>
        ),
      )}
    </>
  )
}

function Figure({
  number,
  caption,
  source,
  children,
  footer,
}: {
  number?: number
  caption: string
  source: string
  children: ReactNode
  footer?: ReactNode
}) {
  const id = useId()
  return (
    <figure className="cd-figure" aria-labelledby={id}>
      <figcaption id={id} className="cd-figcaption">
        {number !== undefined && (
          <span className="cd-caption-number">Bảng {number}.</span>
        )}{' '}
        <InlineText text={caption} />
      </figcaption>
      <div className="cd-table-wrap">{children}</div>
      {footer}
      {source.trim() && (
        <p className="cd-source">
          Nguồn: <InlineText text={source} />
        </p>
      )}
    </figure>
  )
}

function Cell({ text, mono }: { text: string; mono?: boolean }) {
  if (!text.trim()) return <span className="cd-empty-cell">—</span>
  return mono && !text.includes('`') ? (
    <code className="cd-code">{text}</code>
  ) : (
    <InlineText text={text} />
  )
}

function TableView({ block, number }: { block: TableBlock; number?: number }) {
  return (
    <Figure number={number} caption={block.caption} source={block.source}>
      <table className="cd-table">
        <colgroup>
          {block.columns.map((column) => (
            <col
              key={column.key}
              style={column.width ? { width: column.width } : undefined}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {block.columns.map((column) => (
              <th key={column.key} scope="col">
                <InlineText text={column.label} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.id}>
              {block.columns.map((column) => (
                <td key={column.key}>
                  <Cell text={row.cells[column.key] ?? ''} mono={column.mono} />
                </td>
              ))}
            </tr>
          ))}
          {!block.rows.length && (
            <tr>
              <td colSpan={block.columns.length} className="cd-empty-cell">
                Bảng chưa có dòng nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Figure>
  )
}

function ApplicationCell({ item }: { item: ParameterItem }) {
  const comparison = compareWithApplication(item)
  if (!comparison)
    return <span className="cd-muted">Không đối chiếu tự động</span>
  return (
    <>
      <span className="cd-badge" data-status={comparison.status}>
        {COMPARISON_LABELS[comparison.status]}
      </span>
      <span className="cd-app-text">{comparison.text}</span>
    </>
  )
}

function ParametersView({
  block,
  number,
}: {
  block: ParametersBlock
  number?: number
}) {
  return (
    <Figure number={number} caption={block.caption} source={block.source}>
      <table className="cd-table cd-parameters">
        <colgroup>
          <col style={{ width: '19%' }} />
          <col />
          <col style={{ width: '13%' }} />
          <col style={{ width: '31%' }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Nội dung</th>
            <th scope="col">Quy tắc theo tài liệu</th>
            <th scope="col" className="num">
              Giá trị
            </th>
            <th scope="col">
              Ứng dụng đang dùng
              <span className="cd-live-chip">trực tiếp</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {block.items.map((item) => (
            <tr key={item.id}>
              <th scope="row">
                <InlineText text={item.label} />
              </th>
              <td data-label="Quy tắc theo tài liệu">
                <InlineText text={item.rule} />
              </td>
              <td className="num cd-value" data-label="Giá trị">
                {item.value === null ? (
                  <span className="cd-empty-cell">—</span>
                ) : (
                  `${numberText(item.value)}${item.unit ? ` ${item.unit}` : ''}`
                )}
              </td>
              <td className="cd-app-cell" data-label="Ứng dụng đang dùng">
                <ApplicationCell item={item} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Figure>
  )
}

const isTotal = (step: BridgeStep) =>
  step.excelCode === 'sales' || step.excelCode === 'finance'

function BridgeView({
  block,
  number,
  live,
}: {
  block: BridgeBlock
  number?: number
  live?: LiveBridgeColumn | null
}) {
  const numbers = block.steps.reduce<(number | null)[]>(
    (list, step) => [
      ...list,
      isTotal(step) ? null : list.filter((value) => value !== null).length + 1,
    ],
    [],
  )
  return (
    <Figure
      number={number}
      caption={block.caption}
      source={block.source}
      footer={live?.footer}
    >
      <table className="cd-table cd-bridge cd-bridge-steps">
        <colgroup>
          <col style={{ width: '6%' }} />
          <col style={{ width: '27%' }} />
          <col style={{ width: '17%' }} />
          <col />
          {live && <col style={{ width: '20%' }} />}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="num">
              #
            </th>
            <th scope="col">Khoản mục</th>
            <th scope="col">Loại</th>
            <th scope="col">Lưu ý</th>
            {live && (
              <th scope="col" className={live.numeric ? 'num' : undefined}>
                {live.label}
                <span className="cd-live-chip">trực tiếp</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {block.steps.map((step, index) => {
            const total = isTotal(step)
            return (
              <tr
                key={step.id}
                className={cx(
                  total && 'is-total',
                  step.excelCode === 'finance' && 'is-closing',
                )}
              >
                <td className="num cd-step-number">{numbers[index] ?? ''}</td>
                <th scope="row">
                  <InlineText text={step.label} />
                </th>
                <td className="cd-category">
                  <InlineText text={step.category} />
                </td>
                <td className="cd-note">
                  <InlineText text={step.note} />
                </td>
                {live && (
                  <td
                    className={cx('cd-live-cell', live.numeric && 'num')}
                    data-label={live.label}
                  >
                    {live.render(step)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </Figure>
  )
}

export function BlockView({
  block,
  number,
  live,
}: {
  block: ConventionBlock
  number?: number
  live?: LiveBridgeColumn | null
}) {
  switch (block.kind) {
    case 'paragraph':
      return block.text.trim() ? (
        <p className="cd-paragraph">
          <InlineText text={block.text} />
        </p>
      ) : (
        <p className="cd-paragraph cd-placeholder">Đoạn văn trống.</p>
      )
    case 'callout':
      return (
        <aside className="cd-callout" data-tone={block.tone}>
          <p>
            <strong className="cd-callout-label">
              {block.label.replace(/[.:]\s*$/, '')}.
            </strong>{' '}
            <InlineText text={block.text} />
          </p>
        </aside>
      )
    case 'formula':
      return (
        <div className="cd-formula-block">
          <div className="cd-formula" role="math" aria-label={block.expression}>
            <span aria-hidden="true" />
            <span className="cd-formula-expression">
              <FormulaExpression expression={block.expression} />
            </span>
            <span className="cd-formula-number" aria-hidden="true">
              {number !== undefined ? `(${number})` : ''}
            </span>
          </div>
          {block.note.trim() && (
            <p className="cd-formula-note">
              <InlineText text={block.note} />
            </p>
          )}
        </div>
      )
    case 'list': {
      const items = block.items.map((item, index) => (
        <li key={index}>
          <InlineText text={item} />
        </li>
      ))
      return block.ordered ? (
        <ol className="cd-list" data-ordered="true">
          {items}
        </ol>
      ) : (
        <ul className="cd-list">{items}</ul>
      )
    }
    case 'table':
      return <TableView block={block} number={number} />
    case 'parameters':
      return <ParametersView block={block} number={number} />
    case 'bridge':
      return <BridgeView block={block} number={number} live={live} />
  }
}

/* ------------------------------------------------------------------ */
/* Editors                                                            */
/* ------------------------------------------------------------------ */

function AutoTextarea({
  value,
  onValueChange,
  className,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  value: string
  onValueChange: (value: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    element.style.height = 'auto'
    if (element.scrollHeight)
      element.style.height = `${element.scrollHeight + 2}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      className={cx('cd-textarea', className)}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      {...props}
    />
  )
}

function TextField({
  label,
  value,
  onValueChange,
  multiline,
  placeholder,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  multiline?: boolean
  placeholder?: string
}) {
  const id = useId()
  return (
    <div className="cd-field">
      <label className="cd-field-label" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <AutoTextarea
          id={id}
          value={value}
          onValueChange={onValueChange}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={id}
          className="cd-input"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onValueChange(event.target.value)}
        />
      )}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="cd-icon-button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="cd-add-button" onClick={onClick}>
      <Plus size={14} aria-hidden="true" />
      {label}
    </button>
  )
}

function TableEditor({
  block,
  onChange,
}: {
  block: TableBlock
  onChange: (block: TableBlock) => void
}) {
  const setCell = (rowId: string, key: string, value: string) =>
    onChange({
      ...block,
      rows: block.rows.map((row) =>
        row.id === rowId
          ? { ...row, cells: { ...row.cells, [key]: value } }
          : row,
      ),
    })
  return (
    <div className="cd-editor-stack">
      <TextField
        label="Tên bảng"
        value={block.caption}
        onValueChange={(caption) => onChange({ ...block, caption })}
      />
      <div className="cd-table-wrap">
        <table className="cd-table cd-table-edit">
          <thead>
            <tr>
              {block.columns.map((column, index) => (
                <th key={column.key} scope="col">
                  <input
                    className="cd-input cd-input-header"
                    aria-label={`Tiêu đề cột ${index + 1}`}
                    value={column.label}
                    onChange={(event) =>
                      onChange({
                        ...block,
                        columns: block.columns.map((item) =>
                          item.key === column.key
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </th>
              ))}
              <th scope="col" className="cd-actions-col">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {block.columns.map((column) => (
                  <td key={column.key}>
                    <AutoTextarea
                      className="cd-textarea-cell"
                      aria-label={`${column.label.replace(/`/g, '')} · dòng ${rowIndex + 1}`}
                      value={row.cells[column.key] ?? ''}
                      onValueChange={(value) =>
                        setCell(row.id, column.key, value)
                      }
                    />
                  </td>
                ))}
                <td className="cd-actions-col">
                  <IconButton
                    label={`Xóa dòng ${rowIndex + 1}`}
                    onClick={() =>
                      onChange({
                        ...block,
                        rows: block.rows.filter((item) => item.id !== row.id),
                      })
                    }
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AddButton
        label="Thêm dòng"
        onClick={() =>
          onChange({
            ...block,
            rows: [
              ...block.rows,
              {
                id: newId('row'),
                cells: Object.fromEntries(
                  block.columns.map((column) => [column.key, '']),
                ),
              },
            ],
          })
        }
      />
      <TextField
        label="Dòng nguồn"
        value={block.source}
        onValueChange={(source) => onChange({ ...block, source })}
      />
    </div>
  )
}

function ParametersEditor({
  block,
  onChange,
}: {
  block: ParametersBlock
  onChange: (block: ParametersBlock) => void
}) {
  const setItem = (id: string, patch: Partial<ParameterItem>) =>
    onChange({
      ...block,
      items: block.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    })
  return (
    <div className="cd-editor-stack">
      <TextField
        label="Tên bảng"
        value={block.caption}
        onValueChange={(caption) => onChange({ ...block, caption })}
      />
      <div className="cd-parameter-editor">
        {block.items.map((item) => (
          <fieldset key={item.id} className="cd-parameter-card">
            <legend className="sr-only">{item.label}</legend>
            <div className="cd-parameter-grid">
              <TextField
                label="Nội dung"
                value={item.label}
                onValueChange={(label) => setItem(item.id, { label })}
              />
              <div className="cd-field cd-value-field">
                <span className="cd-field-label">Giá trị</span>
                <div className="cd-value-inputs">
                  <input
                    className="cd-input cd-input-number"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    aria-label={`Giá trị · ${item.label}`}
                    placeholder="Không có"
                    value={item.value ?? ''}
                    onChange={(event) => {
                      const next = event.target.value
                      const parsed = Number(next)
                      setItem(item.id, {
                        value:
                          next.trim() === '' ||
                          !Number.isFinite(parsed) ||
                          parsed < 0
                            ? null
                            : parsed,
                      })
                    }}
                  />
                  <input
                    className="cd-input cd-input-unit"
                    aria-label={`Đơn vị · ${item.label}`}
                    placeholder="Đơn vị"
                    value={item.unit}
                    onChange={(event) =>
                      setItem(item.id, { unit: event.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <TextField
              label="Quy tắc theo tài liệu"
              multiline
              value={item.rule}
              onValueChange={(rule) => setItem(item.id, { rule })}
            />
            <p className="cd-parameter-app">
              <span className="cd-field-label">Ứng dụng đang dùng</span>
              <ApplicationCell item={item} />
            </p>
          </fieldset>
        ))}
      </div>
      <TextField
        label="Dòng nguồn"
        value={block.source}
        onValueChange={(source) => onChange({ ...block, source })}
      />
    </div>
  )
}

function BridgeEditor({
  block,
  onChange,
}: {
  block: BridgeBlock
  onChange: (block: BridgeBlock) => void
}) {
  const setStep = (id: string, patch: Partial<BridgeStep>) =>
    onChange({
      ...block,
      steps: block.steps.map((step) =>
        step.id === id ? { ...step, ...patch } : step,
      ),
    })
  return (
    <div className="cd-editor-stack">
      <TextField
        label="Tên bảng"
        value={block.caption}
        onValueChange={(caption) => onChange({ ...block, caption })}
      />
      <div className="cd-table-wrap">
        <table className="cd-table cd-table-edit">
          <thead>
            <tr>
              <th scope="col">Khoản mục</th>
              <th scope="col">Loại</th>
              <th scope="col">Lưu ý</th>
              <th scope="col">Ánh xạ cố định</th>
              <th scope="col" className="cd-actions-col">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {block.steps.map((step, index) => (
              <tr key={step.id}>
                <td>
                  <AutoTextarea
                    className="cd-textarea-cell"
                    aria-label={`Khoản mục · dòng ${index + 1}`}
                    value={step.label}
                    onValueChange={(label) => setStep(step.id, { label })}
                  />
                </td>
                <td>
                  <AutoTextarea
                    className="cd-textarea-cell"
                    aria-label={`Loại · dòng ${index + 1}`}
                    value={step.category}
                    onValueChange={(category) => setStep(step.id, { category })}
                  />
                </td>
                <td>
                  <AutoTextarea
                    className="cd-textarea-cell"
                    aria-label={`Lưu ý · dòng ${index + 1}`}
                    value={step.note}
                    onValueChange={(note) => setStep(step.id, { note })}
                  />
                </td>
                <td className="cd-mapping">
                  {step.excelCode ? (
                    <>
                      <code className="cd-code">{step.excelCode}</code>
                      <span>
                        {step.rawBucket
                          ? RAW_BUCKET_LABELS[step.rawBucket]
                          : 'Raw: chưa tách'}
                      </span>
                    </>
                  ) : (
                    <span className="cd-muted">Khoản bổ sung</span>
                  )}
                </td>
                <td className="cd-actions-col">
                  <IconButton
                    label={`Xóa khoản ${index + 1}`}
                    onClick={() =>
                      onChange({
                        ...block,
                        steps: block.steps.filter(
                          (item) => item.id !== step.id,
                        ),
                      })
                    }
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AddButton
        label="Thêm khoản mục"
        onClick={() =>
          onChange({
            ...block,
            steps: [
              ...block.steps,
              { id: newId('step'), label: '', category: '', note: '' },
            ],
          })
        }
      />
      <TextField
        label="Dòng nguồn"
        value={block.source}
        onValueChange={(source) => onChange({ ...block, source })}
      />
    </div>
  )
}

export function BlockEditor({
  block,
  number,
  onChange,
}: {
  block: ConventionBlock
  number?: number
  onChange: (block: ConventionBlock) => void
}) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <AutoTextarea
          className="cd-textarea-prose"
          aria-label="Nội dung đoạn văn"
          placeholder="Nhập nội dung đoạn văn. Dùng `dấu huyền` để ghi tên cột."
          value={block.text}
          onValueChange={(text) => onChange({ ...block, text })}
        />
      )
    case 'callout':
      return (
        <div className="cd-editor-stack">
          <TextField
            label="Nhãn"
            value={block.label}
            onValueChange={(label) => onChange({ ...block, label })}
          />
          <TextField
            label="Nội dung"
            multiline
            value={block.text}
            onValueChange={(text) => onChange({ ...block, text })}
          />
        </div>
      )
    case 'formula':
      return (
        <div className="cd-editor-stack">
          <BlockView block={block} number={number} />
          <TextField
            label="Công thức"
            value={block.expression}
            onValueChange={(expression) => onChange({ ...block, expression })}
          />
          <TextField
            label="Chú thích"
            value={block.note}
            onValueChange={(note) => onChange({ ...block, note })}
          />
        </div>
      )
    case 'list':
      return (
        <div className="cd-editor-stack">
          {block.items.map((item, index) => (
            <div key={index} className="cd-list-item-editor">
              <span className="cd-list-marker" aria-hidden="true">
                {block.ordered ? `${index + 1}.` : '–'}
              </span>
              <AutoTextarea
                aria-label={`Mục ${index + 1}`}
                value={item}
                onValueChange={(value) =>
                  onChange({
                    ...block,
                    items: block.items.map((current, position) =>
                      position === index ? value : current,
                    ),
                  })
                }
              />
              <IconButton
                label={`Xóa mục ${index + 1}`}
                onClick={() =>
                  onChange({
                    ...block,
                    items: block.items.filter(
                      (_, position) => position !== index,
                    ),
                  })
                }
              >
                <Trash2 size={14} aria-hidden="true" />
              </IconButton>
            </div>
          ))}
          <AddButton
            label="Thêm mục"
            onClick={() => onChange({ ...block, items: [...block.items, ''] })}
          />
        </div>
      )
    case 'table':
      return <TableEditor block={block} onChange={onChange} />
    case 'parameters':
      return <ParametersEditor block={block} onChange={onChange} />
    case 'bridge':
      return <BridgeEditor block={block} onChange={onChange} />
  }
}

function blockDescription(block: ConventionBlock, number?: number) {
  switch (block.kind) {
    case 'paragraph':
      return 'đoạn văn'
    case 'callout':
      return `ghi chú “${block.label}”`
    case 'formula':
      return `công thức ${block.expression}`
    case 'list':
      return 'danh sách'
    default:
      return number !== undefined
        ? `Bảng ${number}. ${block.caption}`
        : block.caption
  }
}

/** Wraps a block with read view, edit affordance and change marker. */
export function EditableBlock({
  block,
  number,
  editing,
  active,
  marker,
  live,
  onActivate,
  onClose,
  onChange,
  onRevert,
  onRemove,
}: {
  block: ConventionBlock
  number?: number
  editing: boolean
  active: boolean
  marker: 'saved' | 'draft' | null
  live?: LiveBridgeColumn | null
  onActivate: () => void
  onClose: () => void
  onChange: (block: ConventionBlock) => void
  onRevert?: () => void
  onRemove?: () => void
}) {
  const description = blockDescription(block, number)
  return (
    <div
      className={cx(
        'cd-block',
        editing && 'cd-editable',
        active && 'is-active',
        marker && 'is-changed',
      )}
      data-block-id={block.id}
      data-marker={marker ?? undefined}
      onClick={editing && !active ? onActivate : undefined}
    >
      {marker && (
        <span className="cd-block-tag">
          {marker === 'draft' ? 'Chưa lưu' : 'Đã sửa'}
        </span>
      )}
      {editing && !active && (
        <button
          type="button"
          className="cd-edit-trigger"
          aria-label={`Sửa ${description}`}
          onClick={(event) => {
            event.stopPropagation()
            onActivate()
          }}
        >
          <Pencil size={13} aria-hidden="true" />
          <span>Sửa</span>
        </button>
      )}
      {active ? (
        <div
          className="cd-editor"
          role="group"
          aria-label={`Đang sửa ${description}`}
        >
          <BlockEditor block={block} number={number} onChange={onChange} />
          <div className="cd-editor-bar">
            <span className="cd-editor-hint">
              Thay đổi được ghi vào bản nháp ngay khi nhập.
            </span>
            <div className="cd-editor-actions">
              {onRemove && (
                <button
                  type="button"
                  className="cd-text-button is-danger"
                  onClick={onRemove}
                >
                  <Trash2 size={13} aria-hidden="true" />
                  Xóa đoạn
                </button>
              )}
              {onRevert && (
                <button
                  type="button"
                  className="cd-text-button"
                  onClick={onRevert}
                >
                  <Undo2 size={13} aria-hidden="true" />
                  Hoàn tác khối
                </button>
              )}
              <button
                type="button"
                className="cd-done-button"
                onClick={onClose}
              >
                <Check size={13} aria-hidden="true" />
                Xong
              </button>
            </div>
          </div>
        </div>
      ) : (
        <BlockView block={block} number={number} live={live} />
      )}
    </div>
  )
}
