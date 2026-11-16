import { vi } from '@/lib/i18n'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MonitorPlay,
  Minimize2,
  Maximize2,
  X,
  Printer,
  LoaderCircle,
} from 'lucide-react'
import { ExpandBackdrop } from '@/components/ExpandBackdrop'
import { useExpandedView } from '@/hooks/useExpandedView'
import { useAppStore } from '@/lib/store'
import { InformationNote } from '@/components/PageInformation'
import { ReferenceMethodology } from '@/components/excel-reference/ReferenceViews'
import { WorkspaceToolbar } from '@/components/methodology/WorkspaceToolbar'
import { SourcesAndJoins } from '@/components/methodology/SourcesAndJoins'
import { PrintDocument } from '@/components/methodology/PrintDocument'
import { ConventionDocumentView } from '@/components/conventions/ConventionDocument'
import { PipelineCanvas } from '@/components/methodology/PipelineCanvas'
import { RuleBrowser } from '@/components/methodology/RuleBrowser'
import { EvidenceTable } from '@/components/methodology/EvidenceTable'
import { SelectionInspector } from '@/components/methodology/SelectionInspector'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  EMPTY_RULE_FILTERS,
  EMPTY_EVIDENCE_FILTERS,
  filterRules,
  filterEvidenceRows,
  pipelineGraph,
  nodeById,
  type WorkspaceTab,
  type WorkspaceSelection,
  type PipelineScope,
  type RuleFilters,
  type EvidenceFilters,
} from '@/lib/model-workspace'
import '@/methodology.css'
import '@/methodology-enhancements.css'

export function Methodology() {
  const store = useAppStore()
  const result = store.activeResult
  return result.source === 'excel' ? (
    <ReferenceMethodology
      workbook={result.workbook}
      period={result.period}
      setPeriod={store.setExcelReferencePeriod}
    />
  ) : (
    <RawMethodology />
  )
}

function RawMethodology() {
  const {
    reconciliationData,
    isProcessing,
    processingPhase,
    status,
    error,
    period,
    files,
    confirmedMappings,
  } = useAppStore()
  const evidence = reconciliationData?.evidence
  const [tab, setTab] = useState<WorkspaceTab>('document')
  const [selections, setSelections] = useState<
    Record<WorkspaceTab, WorkspaceSelection | null>
  >({
    document: null,
    pipeline: null,
    sources: null,
    rules: null,
    evidence: null,
  })
  const [presentation, setPresentation] = useState(false)
  const presentationToggle = useRef<HTMLButtonElement>(null)
  const {
    expanded: isExpanded,
    setExpanded,
    close: closeExpanded,
    toggle: expandToggle,
  } = useExpandedView()
  const [scope, setScope] = useState<PipelineScope>('flow')
  const [source, setSource] = useState('All')
  const [ruleFilters, setRuleFilters] = useState(EMPTY_RULE_FILTERS)
  const [evidenceFilters, setEvidenceFilters] = useState(EMPTY_EVIDENCE_FILTERS)
  const [tableId, setTableId] = useState('expected_events')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{
    id: string
    serial: number
  } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!presentation) return
    const navigation = [
      ...document.querySelectorAll<HTMLElement>(
        '.app-sidebar, .app-header, .app-footer',
      ),
    ]
    const previous = navigation.map((element) => element.inert)
    navigation.forEach((element) => {
      element.inert = true
    })
    return () =>
      navigation.forEach((element, index) => {
        element.inert = previous[index]
      })
  }, [presentation])
  const table =
    evidence?.tables.find((t) => t.id === tableId) ??
    evidence?.tables.find((t) => t.id === 'expected_events') ??
    evidence?.tables[0]
  const graph = useMemo(() => pipelineGraph(scope, source), [scope, source])
  const stored = selections[tab]
  const selection =
    stored &&
    (tab === 'pipeline' || tab === 'sources'
      ? stored.kind === 'node'
        ? tab === 'sources'
          ? nodeById.has(stored.id)
          : graph.nodes.some((n) => n.id === stored.id)
        : stored.kind === 'connection' &&
          (tab === 'sources' || graph.edges.some((e) => e.id === stored.id))
      : tab === 'rules'
        ? stored.kind === 'rule' &&
          filterRules(ruleFilters).some((r) => r.id === stored.id)
        : stored.kind === 'table'
          ? stored.runId === evidence?.runId && stored.id === table?.id
          : stored.kind === 'record' &&
            stored.runId === evidence?.runId &&
            stored.tableId === table?.id &&
            filterEvidenceRows(table, evidenceFilters).some(
              (r) => r.index === stored.rowIndex,
            ))
      ? stored
      : null
  useEffect(() => {
    const element = root.current
    if (!element) return
    const measure = () =>
      element.style.setProperty(
        '--mw-top',
        `${element.getBoundingClientRect().top}px`,
      )
    const observer = new ResizeObserver(measure)
    if (element.parentElement) observer.observe(element.parentElement)
    measure()
    const resize = () => {
      measure()
      if (
        window.matchMedia &&
        !window.matchMedia('(max-width: 1099px)').matches
      )
        setDrawerOpen(false)
    }
    window.addEventListener('resize', resize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [])
  const showDrawer = () => {
    if (window.matchMedia?.('(max-width: 1099px)').matches) setDrawerOpen(true)
  }
  const choose = (next: WorkspaceSelection) => {
    setSelections((previous) => ({ ...previous, [tab]: next }))
    showDrawer()
  }
  const changeTab = (next: WorkspaceTab) => {
    setTab(next)
    setDrawerOpen(false)
  }
  const goNode = (id: string) => {
    setTab('pipeline')
    setScope(nodeById.get(id)?.source === 'Dim' ? 'references' : 'all')
    setSource('All')
    setSelections((previous) => ({
      ...previous,
      pipeline: { kind: 'node', id },
    }))
    setFocusRequest((previous) => ({ id, serial: (previous?.serial ?? 0) + 1 }))
    showDrawer()
  }
  const goRule = (id: string) => {
    setTab('rules')
    setRuleFilters(EMPTY_RULE_FILTERS)
    setSelections((previous) => ({ ...previous, rules: { kind: 'rule', id } }))
    showDrawer()
  }
  const changeRuleFilters = (filters: RuleFilters) => {
    setRuleFilters(filters)
    if (
      selections.rules &&
      !filterRules(filters).some((r) => r.id === selections.rules?.id)
    )
      setSelections((previous) => ({ ...previous, rules: null }))
  }
  const changeEvidenceFilters = (filters: EvidenceFilters) => {
    setEvidenceFilters(filters)
    const current = selections.evidence
    if (
      current?.kind === 'record' &&
      !filterEvidenceRows(table, filters).some(
        (r) => r.index === current.rowIndex,
      )
    )
      setSelections((previous) => ({
        ...previous,
        evidence:
          table && evidence
            ? { kind: 'table', id: table.id, runId: evidence.runId }
            : null,
      }))
  }
  const statusText = isProcessing
    ? `${vi('Current engine stage')}: ${vi(processingPhase ?? status)}`
    : evidence
      ? `${vi('Successful run')} · ${evidence.runId.slice(0, 8)}`
      : status === 'error'
        ? vi('Processing failed; no successful evidence')
        : vi('Definitions · no processed snapshot')
  const inspector = (
    <SelectionInspector
      selection={selection}
      tab={tab}
      evidence={evidence}
      onNode={goNode}
      onRule={goRule}
      onTable={(id) => {
        setTab('evidence')
        setTableId(id)
        setEvidenceFilters(EMPTY_EVIDENCE_FILTERS)
        setSelections((previous) => ({
          ...previous,
          evidence: evidence
            ? { kind: 'table', id, runId: evidence.runId }
            : null,
        }))
        setDrawerOpen(false)
      }}
    />
  )
  return (
    <>
      <ExpandBackdrop open={isExpanded} onClose={closeExpanded} />
      <div
        ref={root}
        className={`mw-workspace ${presentation ? 'mw-presentation' : ''} ${isExpanded ? 'is-expanded-view' : ''}`}
        data-tab={tab}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && presentation) {
            setPresentation(false)
            presentationToggle.current?.focus()
          }
          if (
            e.key === '/' &&
            tab === 'rules' &&
            !(e.target instanceof HTMLInputElement) &&
            !(e.target instanceof HTMLSelectElement)
          ) {
            e.preventDefault()
            root.current
              ?.querySelector<HTMLInputElement>(
                `[aria-label="${vi('Search rules')}"]`,
              )
              ?.focus()
          }
        }}
      >
        {isExpanded && (
          <button
            type="button"
            className="mw-expand-close"
            aria-label="Thu nhỏ vùng làm việc"
            title="Thu nhỏ (Esc)"
            onClick={closeExpanded}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
        <WorkspaceToolbar
          tab={tab}
          onTabChange={changeTab}
          evidenceCount={evidence?.tables.length ?? null}
          processing={isProcessing}
          hasSelection={!!selection}
          onInspect={() => setDrawerOpen(true)}
        />
        <div className="mw-run-context">
          <InformationNote title="Phạm vi mô hình dữ liệu">
            <p>
              <strong>{vi('Reporting period')}</strong> {period.start} →{' '}
              {period.end}
            </p>
          </InformationNote>
          <span role="status" className="mw-run-status">
            {isProcessing && (
              <LoaderCircle size={13} className="motion-safe:animate-spin" />
            )}
            {statusText}
          </span>
          <div className="mw-presentation-controls">
            <button
              ref={expandToggle}
              type="button"
              className="mw-small-button mw-expand-toggle"
              aria-label={
                isExpanded ? 'Thu nhỏ vùng làm việc' : 'Phóng to vùng làm việc'
              }
              aria-pressed={isExpanded}
              onClick={() => {
                setPresentation(false)
                setExpanded(!isExpanded)
              }}
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{isExpanded ? 'Thu nhỏ' : 'Phóng to'}</span>
            </button>
            <button
              ref={presentationToggle}
              type="button"
              className="mw-small-button"
              aria-label="Toggle presentation mode"
              aria-pressed={presentation}
              onClick={() => {
                closeExpanded()
                setPresentation(!presentation)
              }}
            >
              {presentation ? (
                <Minimize2 size={14} />
              ) : (
                <MonitorPlay size={14} />
              )}
              <span>
                {vi(presentation ? 'Exit presentation' : 'Presentation mode')}
              </span>
            </button>
            <button
              type="button"
              className="mw-small-button"
              aria-label="Print or save methodology as PDF"
              onClick={() => window.print()}
            >
              <Printer size={14} />
              <span>{vi('Print / Save PDF')}</span>
            </button>
          </div>
        </div>
        {status === 'error' && (
          <p role="alert" className="mw-run-error">
            {error}
          </p>
        )}
        <div className="mw-workspace-body">
          <div className="mw-main-panel">
            <div
              id="model-panel-document"
              className="mw-tab-panel"
              role="tabpanel"
              aria-labelledby="model-tab-document"
              hidden={tab !== 'document'}
            >
              <ConventionDocumentView
                printable={tab === 'document'}
                context={{
                  mode: 'raw',
                  period,
                  evidence,
                  result: reconciliationData,
                  statusText,
                  onOpenTab: changeTab,
                }}
              />
            </div>
            <div
              id="model-panel-pipeline"
              className="mw-tab-panel"
              role="tabpanel"
              aria-labelledby="model-tab-pipeline"
              hidden={tab !== 'pipeline'}
            >
              <PipelineCanvas
                selection={tab === 'pipeline' ? selection : selections.pipeline}
                onSelect={choose}
                scope={scope}
                onScopeChange={setScope}
                source={source}
                onSourceChange={(next) => {
                  setSource(next)
                  if (next === 'Dim' && scope === 'flow') setScope('references')
                }}
                focusRequest={focusRequest}
                processingStage={
                  !isProcessing
                    ? null
                    : processingPhase === 'registering'
                      ? 'source'
                      : processingPhase === 'recognition'
                        ? 'recognition'
                        : processingPhase === 'reconciling'
                          ? 'reconciliation'
                          : processingPhase === 'evidence'
                            ? 'output'
                            : 'cleaning'
                }
              />
            </div>
            <div
              id="model-panel-sources"
              className="mw-tab-panel"
              role="tabpanel"
              aria-labelledby="model-tab-sources"
              hidden={tab !== 'sources'}
            >
              <SourcesAndJoins evidence={evidence} onSelect={choose} />
            </div>
            <div
              id="model-panel-evidence"
              className="mw-tab-panel"
              role="tabpanel"
              aria-labelledby="model-tab-evidence"
              hidden={tab !== 'evidence'}
            >
              <EvidenceTable
                evidence={evidence}
                table={table}
                selection={tab === 'evidence' ? selection : null}
                onSelect={choose}
                filters={evidenceFilters}
                onFiltersChange={changeEvidenceFilters}
                processing={isProcessing}
                onTableChange={(id) => {
                  setTableId(id)
                  setEvidenceFilters((previous) => ({
                    ...EMPTY_EVIDENCE_FILTERS,
                    schema: previous.schema,
                  }))
                  setSelections((previous) => ({
                    ...previous,
                    evidence: evidence
                      ? { kind: 'table', id, runId: evidence.runId }
                      : null,
                  }))
                }}
              />
            </div>
            <div
              id="model-panel-rules"
              className="mw-tab-panel"
              role="tabpanel"
              aria-labelledby="model-tab-rules"
              hidden={tab !== 'rules'}
            >
              <RuleBrowser
                filters={ruleFilters}
                onFiltersChange={changeRuleFilters}
                selectedId={
                  tab === 'rules' && selection?.kind === 'rule'
                    ? selection.id
                    : null
                }
                onSelect={(id) => choose({ kind: 'rule', id })}
                evidence={evidence}
              />
            </div>
          </div>
          <aside className="mw-inspector" aria-label={vi('Model inspector')}>
            {inspector}
          </aside>
        </div>
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="right" className="mw-inspector-drawer">
            <SheetTitle className="sr-only">
              {vi('Selection inspector')}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Chi tiết chỉ xem của đối tượng đang chọn.
            </SheetDescription>
            {inspector}
          </SheetContent>
        </Sheet>
        <PrintDocument
          evidence={evidence}
          result={reconciliationData}
          period={period}
          files={files}
          confirmedMappings={confirmedMappings}
        />
      </div>
    </>
  )
}
