import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  BookOpenText,
  Download,
  FileUp,
  Highlighter,
  Maximize2,
  Minimize2,
  PencilLine,
  Plus,
  Printer,
  RotateCcw,
  Save,
  TriangleAlert,
  CircleCheck,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExpandBackdrop } from '@/components/ExpandBackdrop'
import { useExpandedView } from '@/hooks/useExpandedView'
import { useAppStore } from '@/lib/store'
import { money } from '@/lib/dashboard-format'
import {
  selectExcelReference,
  sumReferenceUSD,
  type ExcelReferenceWorkbook,
} from '@/lib/excel-reference'
import type {
  ReconciliationPeriod,
  ReconciliationResult,
} from '@/lib/reconciliation-types'
import type { RunEvidence } from '@/lib/reconciliation-evidence'
import {
  CUSTOM_BLOCK_PREFIX,
  ORIGINAL_CONVENTION_DOCUMENT,
  RAW_BUCKET_LABELS,
  addParagraph,
  changedBlockIds,
  findBlock,
  hasUnexportedConventions,
  hasUnsavedDraft,
  nextVersion,
  parseConventionDocument,
  removeBlock,
  replaceBlock,
  sectionNumbers,
  tableNumbers,
  type BridgeBlock,
  type ConventionDocument,
  type ConventionRevision,
} from '@/lib/convention-document'
import { downloadConventionDocument } from '@/lib/convention-download'
import { EditableBlock, type LiveBridgeColumn } from './DocumentBlocks'
import { ExcelAppendix, RawAppendix } from './LiveAppendix'
import { ConfirmDialog, RevisionDialog } from './RevisionDialog'
import './convention-document.css'

export type ConventionContext =
  | {
      mode: 'excel'
      workbook: ExcelReferenceWorkbook
      period: ReconciliationPeriod
    }
  | {
      mode: 'raw'
      period: ReconciliationPeriod
      evidence?: RunEvidence
      result: ReconciliationResult | null
      statusText: string
      onOpenTab: (tab: 'pipeline' | 'rules') => void
    }

const NO_DATA = 'Chưa có dữ liệu tương ứng trong file tham chiếu.'
const MAX_IMPORT_BYTES = 1024 * 1024

const versionNumber = (version: string | null) => {
  const match = /^(\d+)\.(\d+)$/.exec(version ?? '')
  return match ? Number(match[1]) * 100_000 + Number(match[2]) : -1
}
const pad = (value: number) => String(value).padStart(2, '0')
/** dd/mm/yyyy, with local hh:mm for session revisions when requested. */
function formatDate(value: string, withTime = true) {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (day) return `${day[3]}/${day[2]}/${day[1]}`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const text = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
  return withTime
    ? `${text} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    : text
}

function bridgeLiveColumn(
  context: ConventionContext,
  document: ConventionDocument,
): LiveBridgeColumn {
  if (context.mode === 'raw')
    return {
      label: 'Nhóm Raw',
      numeric: false,
      render: (step) =>
        step.rawBucket ? (
          <span className="cd-bucket">
            <span>{RAW_BUCKET_LABELS[step.rawBucket]}</span>
            <code className="cd-code">{step.rawBucket}</code>
          </span>
        ) : step.excelCode ? (
          <span className="cd-muted">
            Chưa tách riêng · nằm trong Chưa giải thích
          </span>
        ) : (
          <span className="cd-empty-cell">—</span>
        ),
    }
  const selection = selectExcelReference(context.workbook, context.period)
  const amount = (code: string): number | null => {
    if (!selection.available) return null
    if (code === 'sales' || code === 'finance')
      return (
        selection.bridgeRows.find((row) => row.kind === code)?.amountUSD ?? null
      )
    const rows = selection.bridgeRows.filter((row) =>
      row.detailCodes.includes(code),
    )
    return rows.length
      ? sumReferenceUSD(rows.map((row) => row.amountUSD))
      : null
  }
  const block = findBlock(document, 'bridge-steps') as BridgeBlock | undefined
  const used = new Set<string>(
    block?.steps.flatMap((step) => (step.excelCode ? [step.excelCode] : [])) ??
      [],
  )
  const unmapped = selection.available
    ? selection.bridgeRows.filter(
        (row) =>
          row.kind === 'adjustment' &&
          !row.detailCodes.some((code) => used.has(code)),
      )
    : []
  return {
    label: 'Workbook · USD',
    numeric: true,
    render: (step) => {
      const value = step.excelCode ? amount(step.excelCode) : null
      return value === null ? (
        <span className="cd-empty-cell" title={NO_DATA}>
          —
        </span>
      ) : (
        <span className={value < 0 ? 'cd-negative' : undefined}>
          {money(value)}
        </span>
      )
    },
    footer: unmapped.length ? (
      <p className="cd-table-note">
        Workbook còn {unmapped.length} khoản chưa có trong trình tự trên:{' '}
        {unmapped
          .map((row) => `${row.label} (${money(row.amountUSD)})`)
          .join('; ')}
        .
      </p>
    ) : selection.available ? null : (
      <p className="cd-table-note">{NO_DATA}</p>
    ),
  }
}

function RevisionTable({
  revisions,
  exportedVersion,
}: {
  revisions: ConventionRevision[]
  exportedVersion: string | null
}) {
  const exported = versionNumber(exportedVersion)
  return (
    <div className="cd-table-wrap">
      <table className="cd-table cd-revisions">
        <caption className="sr-only">Lịch sử sửa đổi tài liệu quy ước</caption>
        <colgroup>
          <col style={{ width: '13%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '18%' }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Phiên bản</th>
            <th scope="col">Ngày</th>
            <th scope="col">Người sửa</th>
            <th scope="col">Nội dung thay đổi</th>
          </tr>
        </thead>
        <tbody>
          {[...revisions].reverse().map((revision, index) => (
            <tr key={`${revision.version}-${index}`}>
              <th scope="row" className="cd-version-cell">
                {revision.version}
              </th>
              <td>{formatDate(revision.date)}</td>
              <td>{revision.author || '—'}</td>
              <td>
                {revision.note}
                {revision.origin === 'original' && (
                  <span className="cd-badge" data-status="match">
                    Bản gốc
                  </span>
                )}
                {revision.origin === 'session' &&
                  versionNumber(revision.version) > exported && (
                    <span className="cd-badge" data-status="partial">
                      Chưa xuất file
                    </span>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ConventionDocumentView({
  context,
  printable = true,
  expandable = false,
}: {
  context: ConventionContext
  /** Raw mode prints this document only while its tab is visible. */
  printable?: boolean
  /** Show its own “Phóng to” control (Raw expands the whole workspace). */
  expandable?: boolean
}) {
  const store = useAppStore()
  const {
    expanded: isExpanded,
    setExpanded,
    close: closeExpanded,
    toggle: expandToggle,
  } = useExpandedView()
  const { conventions } = store
  const saved = conventions.document
  const draft = conventions.draft
  const editing = draft !== null
  const document = draft ?? saved
  const [activeBlock, setActiveBlock] = useState<string | null>(null)
  const [showChanges, setShowChanges] = useState(true)
  const [dialog, setDialog] = useState<
    'save' | 'discard' | 'reset' | 'import' | null
  >(null)
  const [pendingImport, setPendingImport] = useState<ConventionDocument | null>(
    null,
  )
  const [notice, setNotice] = useState<{
    tone: 'error' | 'success'
    text: string
  } | null>(null)
  const [activeSection, setActiveSection] = useState(document.sections[0].id)
  const [tocOpen, setTocOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  const anchorId = (id: string) => `${uid}-section-${id}`

  const sectionNos = useMemo(() => sectionNumbers(document), [document])
  const tableNos = useMemo(() => tableNumbers(document), [document])
  const formulaNos = useMemo(() => {
    const numbers = new Map<string, number>()
    for (const section of document.sections)
      for (const block of section.blocks)
        if (block.kind === 'formula') numbers.set(block.id, numbers.size + 1)
    return numbers
  }, [document])
  const savedChanges = useMemo(
    () => changedBlockIds(ORIGINAL_CONVENTION_DOCUMENT, saved),
    [saved],
  )
  const draftChanges = useMemo(
    () => (draft ? changedBlockIds(saved, draft) : new Set<string>()),
    [draft, saved],
  )
  const isOriginal = saved.revisions.length === 1 && !savedChanges.size
  const unexported = hasUnexportedConventions(conventions)
  const dirty = hasUnsavedDraft(conventions)
  const liveFirstTable = Math.max(0, ...tableNos.values()) + 1
  const live = bridgeLiveColumn(context, document)
  const upcoming = nextVersion(saved.version)
  const status = editing
    ? {
        tone: 'draft',
        short: `Bản nháp ${upcoming}`,
        long: `Bản nháp ${upcoming} · đang chỉnh sửa, chưa lưu`,
      }
    : isOriginal
      ? {
          tone: 'original',
          short: `Bản gốc ${saved.version}`,
          long: 'Bản gốc theo báo cáo',
        }
      : unexported
        ? {
            tone: 'session',
            short: `Bản ${saved.version} · chỉ trong phiên`,
            long: 'Bản chỉnh sửa trong phiên · chưa xuất file',
          }
        : {
            tone: 'exported',
            short: `Bản ${saved.version} · đã xuất file`,
            long: 'Bản chỉnh sửa · đã xuất file JSON',
          }
  const lastRevision = saved.revisions.at(-1)!

  // Scroll spy works for both the inner scroller and natural page scrolling.
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const pending = { frame: 0 }
    const raf =
      window.requestAnimationFrame?.bind(window) ??
      ((callback: FrameRequestCallback) =>
        window.setTimeout(() => callback(0), 16))
    const cancel =
      window.cancelAnimationFrame?.bind(window) ?? window.clearTimeout
    const update = () => {
      pending.frame = 0
      const headings = [
        ...scroller.querySelectorAll<HTMLElement>('[data-section-anchor]'),
      ]
      if (!headings.length) return
      const scrollable = scroller.scrollHeight > scroller.clientHeight + 1
      const top = scrollable ? scroller.getBoundingClientRect().top : 0
      let current = headings[0].dataset.sectionAnchor!
      for (const heading of headings)
        if (heading.getBoundingClientRect().top - top <= 110)
          current = heading.dataset.sectionAnchor!
      if (
        scrollable &&
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
      )
        current = headings.at(-1)!.dataset.sectionAnchor!
      setActiveSection(current)
    }
    const schedule = () => {
      if (!pending.frame) pending.frame = raf(update)
    }
    scroller.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    update()
    return () => {
      scroller.removeEventListener('scroll', schedule)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (pending.frame) cancel(pending.frame)
    }
  }, [])

  const goToSection = (id: string) => {
    const heading = window.document.getElementById(`${anchorId(id)}-heading`)
    if (!heading) return
    const reduced = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth'
    const scroller = scrollRef.current
    if (scroller && scroller.scrollHeight > scroller.clientHeight + 1) {
      // Scroll only the document; scrollIntoView would also move the app shell.
      const toolbar =
        scroller.querySelector<HTMLElement>('.cd-toolbar')?.offsetHeight ?? 0
      scroller.scrollTo?.({
        top:
          scroller.scrollTop +
          heading.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top -
          toolbar -
          16,
        behavior,
      })
    } else heading.scrollIntoView?.({ behavior, block: 'start' })
    heading.focus({ preventScroll: true })
    setActiveSection(id)
  }

  const startEditing = () => {
    setNotice(null)
    setActiveBlock(null)
    store.beginConventionEdit()
  }
  const finishDiscard = () => {
    store.discardConventionDraft()
    setActiveBlock(null)
    setDialog(null)
  }
  const exportDocument = () => {
    const fileName = downloadConventionDocument(saved)
    store.markConventionExported()
    setNotice({
      tone: 'success',
      text: `Đã xuất ${fileName}. Nhập lại file này ở phiên sau để tiếp tục dùng bản ${saved.version}.`,
    })
  }
  const readImport = async (file: File) => {
    if (file.size > MAX_IMPORT_BYTES) {
      setNotice({
        tone: 'error',
        text: 'File quá lớn cho một tài liệu quy ước.',
      })
      return
    }
    const parsed = parseConventionDocument(await file.text())
    if (!parsed.ok) {
      setNotice({
        tone: 'error',
        text: `Không nhập được file: ${parsed.error}`,
      })
      return
    }
    if (!isOriginal && unexported) {
      setPendingImport(parsed.document)
      setDialog('import')
      return
    }
    store.importConventionDocument(parsed.document)
    setNotice({
      tone: 'success',
      text: `Đã nhập tài liệu phiên bản ${parsed.document.version}.`,
    })
  }

  const sections = document.sections
  const activeTitle =
    sections.find((section) => section.id === activeSection)?.title ?? ''
  const plainNumber = (id: string) =>
    (sectionNos.get(id) ?? '').replace(/\.$/, '')
  const tocItems = (onPick?: () => void) =>
    sections.map((section) => (
      <li key={section.id}>
        <button
          type="button"
          data-level={section.level}
          aria-current={activeSection === section.id ? 'true' : undefined}
          onClick={() => {
            if (!onPick) return goToSection(section.id)
            // Close the compact list first so the measured position is final.
            onPick()
            const next =
              window.requestAnimationFrame?.bind(window) ??
              ((callback: FrameRequestCallback) =>
                window.setTimeout(() => callback(0), 16))
            next(() => next(() => goToSection(section.id)))
          }}
        >
          <span className="cd-toc-number">{sectionNos.get(section.id)}</span>
          <span>{section.title}</span>
        </button>
      </li>
    ))

  return (
    <>
      <ExpandBackdrop open={isExpanded} onClose={closeExpanded} />
      <div
        className={`cd-shell ${isExpanded ? 'is-expanded-view' : ''}`}
        data-mode={editing ? 'edit' : 'read'}
        data-print={printable ? 'on' : 'off'}
        data-source={context.mode}
      >
        <div className="cd-scroll" ref={scrollRef}>
          <div
            className="cd-toolbar"
            role="toolbar"
            aria-label="Công cụ tài liệu quy ước"
          >
            <div
              className="cd-mode-switch"
              role="group"
              aria-label="Chế độ tài liệu"
            >
              <button
                type="button"
                data-mode="read"
                aria-pressed={!editing}
                onClick={() => {
                  if (!editing) return
                  if (dirty) setDialog('discard')
                  else finishDiscard()
                }}
              >
                <BookOpenText size={14} aria-hidden="true" />
                Đọc
              </button>
              <button
                type="button"
                data-mode="edit"
                aria-pressed={editing}
                onClick={() => !editing && startEditing()}
              >
                <PencilLine size={14} aria-hidden="true" />
                Chỉnh sửa
              </button>
            </div>
            <span className="cd-status" data-tone={status.tone} role="status">
              {status.short}
            </span>
            <div className="cd-toolbar-actions">
              {editing ? (
                <>
                  <span className="cd-toolbar-hint">
                    {draftChanges.size
                      ? `${draftChanges.size} khối thay đổi chưa lưu`
                      : 'Chọn đoạn, bảng hoặc tham số để sửa'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      dirty ? setDialog('discard') : finishDiscard()
                    }
                  >
                    <X aria-hidden="true" />
                    Hủy
                  </Button>
                  <Button
                    size="sm"
                    disabled={!dirty}
                    onClick={() => {
                      setActiveBlock(null)
                      setDialog('save')
                    }}
                  >
                    <Save aria-hidden="true" />
                    Lưu thay đổi
                  </Button>
                </>
              ) : (
                <>
                  {savedChanges.size > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-pressed={showChanges}
                      onClick={() => setShowChanges(!showChanges)}
                      title="Đánh dấu thay đổi"
                    >
                      <Highlighter aria-hidden="true" />
                      <span className="cd-button-label">Đánh dấu thay đổi</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    title="In / Lưu PDF"
                    onClick={() => window.print()}
                  >
                    <Printer aria-hidden="true" />
                    <span className="cd-button-label">In / Lưu PDF</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Xuất JSON"
                    onClick={exportDocument}
                  >
                    <Download aria-hidden="true" />
                    <span className="cd-button-label">Xuất JSON</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Nhập JSON"
                    onClick={() => fileInput.current?.click()}
                  >
                    <FileUp aria-hidden="true" />
                    <span className="cd-button-label">Nhập JSON</span>
                  </Button>
                  {!isOriginal && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Khôi phục bản gốc"
                      onClick={() => setDialog('reset')}
                    >
                      <RotateCcw aria-hidden="true" />
                      <span className="cd-button-label">Khôi phục bản gốc</span>
                    </Button>
                  )}
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Chọn file JSON tài liệu quy ước"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (file) void readImport(file)
                    }}
                  />
                </>
              )}
            </div>
            {expandable && (
              <Button
                ref={expandToggle}
                variant="outline"
                size="sm"
                className="cd-expand-toggle"
                title={isExpanded ? 'Thu nhỏ' : 'Phóng to'}
                aria-label={
                  isExpanded ? 'Thu nhỏ tài liệu' : 'Phóng to tài liệu'
                }
                aria-pressed={isExpanded}
                onClick={() => setExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <Minimize2 aria-hidden="true" />
                ) : (
                  <Maximize2 aria-hidden="true" />
                )}
                <span className="cd-button-label">
                  {isExpanded ? 'Thu nhỏ' : 'Phóng to'}
                </span>
              </Button>
            )}
          </div>
          {(unexported || notice) && !editing && (
            <div className="cd-banners">
              {unexported && (
                <div className="cd-banner" data-tone="warning" role="note">
                  <TriangleAlert size={16} aria-hidden="true" />
                  <p>
                    Bản chỉnh sửa {saved.version} chỉ tồn tại trong phiên này;
                    tải lại trang sẽ mất thay đổi. Hãy xuất JSON để giữ lại. Kết
                    quả tính toán không thay đổi theo tài liệu.
                  </p>
                  <button type="button" onClick={exportDocument}>
                    Xuất JSON
                  </button>
                </div>
              )}
              {notice && (
                <div
                  className="cd-banner"
                  data-tone={notice.tone}
                  role={notice.tone === 'error' ? 'alert' : 'status'}
                >
                  {notice.tone === 'error' ? (
                    <TriangleAlert size={16} aria-hidden="true" />
                  ) : (
                    <CircleCheck size={16} aria-hidden="true" />
                  )}
                  <p>{notice.text}</p>
                  <button
                    type="button"
                    aria-label="Đóng thông báo"
                    onClick={() => setNotice(null)}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="cd-layout">
            <nav className="cd-toc" aria-label="Mục lục tài liệu">
              <p className="cd-toc-title">Mục lục</p>
              <ol>{tocItems()}</ol>
              <div className="cd-toc-card">
                <span className="cd-toc-card-label">Phiên bản</span>
                <strong>{editing ? upcoming : saved.version}</strong>
                <span>{status.long}</span>
                {savedChanges.size > 0 && (
                  <span>{savedChanges.size} khối khác bản gốc</span>
                )}
              </div>
            </nav>
            <div className="cd-column">
              <details
                className="cd-toc-compact"
                open={tocOpen}
                onToggle={(event) => setTocOpen(event.currentTarget.open)}
              >
                <summary>
                  <span>Mục lục</span>
                  <span className="cd-toc-current">
                    {sectionNos.get(activeSection)} {activeTitle}
                  </span>
                </summary>
                <ol>{tocItems(() => setTocOpen(false))}</ol>
              </details>
              <article
                className="cd-paper"
                aria-label={`Tài liệu: ${document.title}`}
              >
                {editing && (
                  <p className="cd-draft-ribbon">
                    <PencilLine size={13} aria-hidden="true" />
                    Bản nháp — chọn một đoạn, bảng hoặc tham số để sửa. Mục{' '}
                    {plainNumber('application')} được đọc trực tiếp và không sửa
                    được.
                  </p>
                )}
                <header className="cd-masthead">
                  <div className="cd-running">
                    <span>reconcile.</span>
                    <span>Tài liệu quy ước</span>
                    <span>Phiên bản {editing ? upcoming : saved.version}</span>
                  </div>
                  <p className="cd-kicker">
                    {context.mode === 'excel'
                      ? 'Áp dụng · Excel tham chiếu'
                      : 'Áp dụng · Luồng Raw'}
                  </p>
                  <h2 className="cd-title">{document.title}</h2>
                  <p className="cd-subtitle">{document.subtitle}</p>
                  <dl className="cd-meta">
                    <div>
                      <dt>Phiên bản</dt>
                      <dd>{editing ? `${upcoming} (nháp)` : saved.version}</dd>
                    </div>
                    <div>
                      <dt>Hiệu lực từ</dt>
                      <dd>{formatDate(lastRevision.date, false)}</dd>
                    </div>
                    <div>
                      <dt>Trạng thái</dt>
                      <dd>{status.long}</dd>
                    </div>
                    <div>
                      <dt>Phạm vi áp dụng</dt>
                      <dd>
                        {context.mode === 'excel'
                          ? 'Workbook tham chiếu Excel'
                          : 'Xử lý Raw trong trình duyệt'}
                      </dd>
                    </div>
                    <div className="cd-meta-wide">
                      <dt>Cơ sở</dt>
                      <dd>{document.basis}</dd>
                    </div>
                  </dl>
                </header>
                {sections.map((section) => {
                  const HeadingTag = section.level === 1 ? 'h3' : 'h4'
                  const headingId = `${anchorId(section.id)}-heading`
                  return (
                    <section
                      key={section.id}
                      id={anchorId(section.id)}
                      className="cd-section"
                      data-level={section.level}
                      data-content={section.content}
                      aria-labelledby={headingId}
                    >
                      <HeadingTag
                        id={headingId}
                        className="cd-heading"
                        tabIndex={-1}
                        data-section-anchor={section.id}
                      >
                        <span className="cd-heading-number">
                          {sectionNos.get(section.id)}
                        </span>
                        <span>{section.title}</span>
                        {section.content === 'live' && (
                          <span className="cd-live-chip">
                            Dữ liệu trực tiếp
                          </span>
                        )}
                      </HeadingTag>
                      {section.content === 'text' &&
                        section.blocks.map((block) => {
                          const marker = draftChanges.has(block.id)
                            ? ('draft' as const)
                            : showChanges && savedChanges.has(block.id)
                              ? ('saved' as const)
                              : null
                          const custom =
                            block.id.startsWith(CUSTOM_BLOCK_PREFIX)
                          return (
                            <EditableBlock
                              key={block.id}
                              block={block}
                              number={
                                block.kind === 'formula'
                                  ? formulaNos.get(block.id)
                                  : tableNos.get(block.id)
                              }
                              editing={editing}
                              active={editing && activeBlock === block.id}
                              marker={marker}
                              live={block.kind === 'bridge' ? live : null}
                              onActivate={() => setActiveBlock(block.id)}
                              onClose={() => setActiveBlock(null)}
                              onChange={(next) =>
                                draft &&
                                store.updateConventionDraft(
                                  replaceBlock(draft, section.id, next),
                                )
                              }
                              onRevert={
                                draftChanges.has(block.id) && draft
                                  ? () => {
                                      const previous = findBlock(
                                        saved,
                                        block.id,
                                      )
                                      store.updateConventionDraft(
                                        previous
                                          ? replaceBlock(
                                              draft,
                                              section.id,
                                              previous,
                                            )
                                          : removeBlock(
                                              draft,
                                              section.id,
                                              block.id,
                                            ),
                                      )
                                      if (!previous) setActiveBlock(null)
                                    }
                                  : undefined
                              }
                              onRemove={
                                custom && draft
                                  ? () => {
                                      store.updateConventionDraft(
                                        removeBlock(
                                          draft,
                                          section.id,
                                          block.id,
                                        ),
                                      )
                                      setActiveBlock(null)
                                    }
                                  : undefined
                              }
                            />
                          )
                        })}
                      {section.content === 'text' && editing && draft && (
                        <button
                          type="button"
                          className="cd-add-paragraph"
                          onClick={() => {
                            const id = `${CUSTOM_BLOCK_PREFIX}${Date.now().toString(36)}`
                            store.updateConventionDraft(
                              addParagraph(draft, section.id, id),
                            )
                            setActiveBlock(id)
                          }}
                        >
                          <Plus size={14} aria-hidden="true" />
                          Thêm đoạn văn vào mục {plainNumber(section.id)}
                        </button>
                      )}
                      {section.content === 'live' &&
                        (context.mode === 'excel' ? (
                          <ExcelAppendix
                            workbook={context.workbook}
                            period={context.period}
                            firstTable={liveFirstTable}
                          />
                        ) : (
                          <RawAppendix
                            period={context.period}
                            evidence={context.evidence}
                            result={context.result}
                            statusText={context.statusText}
                            firstTable={liveFirstTable}
                            onOpenTab={context.onOpenTab}
                          />
                        ))}
                      {section.content === 'revisions' && (
                        <RevisionTable
                          revisions={saved.revisions}
                          exportedVersion={conventions.exportedVersion}
                        />
                      )}
                    </section>
                  )
                })}
                <footer className="cd-paper-footer">
                  <span>
                    reconcile. · {document.title} · Phiên bản{' '}
                    {editing ? upcoming : saved.version}
                  </span>
                  <span>Tài liệu không làm thay đổi kết quả tính toán.</span>
                </footer>
              </article>
            </div>
          </div>
        </div>
        <RevisionDialog
          open={dialog === 'save'}
          nextVersion={upcoming}
          changedCount={draftChanges.size}
          onCancel={() => setDialog(null)}
          onSave={({ note, author }) => {
            store.saveConventionDocument({
              note,
              author,
              date: new Date().toISOString(),
            })
            setDialog(null)
            setActiveBlock(null)
          }}
        />
        <ConfirmDialog
          open={dialog === 'discard'}
          title="Bỏ các thay đổi chưa lưu?"
          confirmLabel="Bỏ thay đổi"
          tone="danger"
          onCancel={() => setDialog(null)}
          onConfirm={finishDiscard}
        >
          {draftChanges.size} khối đã sửa trong bản nháp sẽ trở về nội dung của
          bản {saved.version}.
        </ConfirmDialog>
        <ConfirmDialog
          open={dialog === 'reset'}
          title="Khôi phục bản gốc?"
          confirmLabel="Khôi phục bản gốc"
          tone="danger"
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            store.resetConventionDocument()
            setDialog(null)
            setNotice({
              tone: 'success',
              text: 'Đã khôi phục bản gốc 1.0 theo báo cáo.',
            })
          }}
        >
          Tài liệu trở về bản 1.0 theo báo cáo và lịch sử sửa đổi trong phiên bị
          xóa.{' '}
          {unexported
            ? 'Bản hiện tại chưa được xuất file nên sẽ không thể lấy lại.'
            : 'Bạn vẫn có thể nhập lại file JSON đã xuất.'}
        </ConfirmDialog>
        <ConfirmDialog
          open={dialog === 'import'}
          title="Thay bằng tài liệu từ file?"
          confirmLabel="Nhập file"
          onCancel={() => {
            setDialog(null)
            setPendingImport(null)
          }}
          onConfirm={() => {
            if (pendingImport) {
              store.importConventionDocument(pendingImport)
              setNotice({
                tone: 'success',
                text: `Đã nhập tài liệu phiên bản ${pendingImport.version}.`,
              })
            }
            setPendingImport(null)
            setDialog(null)
          }}
        >
          Bản {saved.version} hiện tại chưa được xuất file và sẽ bị thay bằng
          phiên bản {pendingImport?.version} trong file.
        </ConfirmDialog>
      </div>
    </>
  )
}
