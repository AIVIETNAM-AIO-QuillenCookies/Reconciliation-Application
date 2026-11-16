import { vi } from '@/lib/i18n'
import {
  Network,
  GitBranch,
  Table2,
  ListFilter,
  PanelRight,
  Files,
  BookOpenText,
} from 'lucide-react'
import { modelNodes, methodologyRules } from '@/lib/methodology'
import type { WorkspaceTab } from '@/lib/model-workspace'
import { InformationNote } from '@/components/PageInformation'

export function WorkspaceToolbar({
  tab,
  onTabChange,
  evidenceCount,
  processing,
  onInspect,
  hasSelection,
}: {
  tab: WorkspaceTab
  onTabChange: (tab: WorkspaceTab) => void
  evidenceCount: number | null
  processing: boolean
  onInspect: () => void
  hasSelection: boolean
}) {
  const tabs = [
    {
      id: 'document',
      label: vi('Convention document'),
      icon: BookOpenText,
      count: null,
    },
    {
      id: 'pipeline',
      label: vi('Pipeline'),
      icon: GitBranch,
      count: modelNodes.length,
    },
    {
      id: 'sources',
      label: vi('Sources & joins'),
      icon: Files,
      count: null,
    },
    {
      id: 'evidence',
      label: vi('Unified transactions'),
      icon: Table2,
      count: evidenceCount,
    },
    {
      id: 'rules',
      label: vi('Rules'),
      icon: ListFilter,
      count: methodologyRules.length,
    },
  ] as const
  return (
    <>
      <header className="mw-heading">
        <span className="mw-page-icon">
          <Network size={21} aria-hidden="true" />
        </span>
        <div>
          <div className="mw-heading-title">
            <h1>{vi('Rules & Data Model')}</h1>
          </div>
        </div>
        <InformationNote title="Quy tắc & mô hình dữ liệu">
          <p>
            {vi('Follow the data. Understand every rule.')} {vi('Read only')}.
          </p>
        </InformationNote>
      </header>
      <div className="mw-navigation">
        <div role="tablist" aria-label={vi('Model views')} className="mw-tabs">
          {tabs.map(({ id, label, icon: Icon, count }, index) => (
            <button
              type="button"
              role="tab"
              id={`model-tab-${id}`}
              aria-controls={`model-panel-${id}`}
              aria-selected={tab === id}
              tabIndex={tab === id ? 0 : -1}
              key={id}
              onClick={() => onTabChange(id)}
              onKeyDown={(e) => {
                if (
                  ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)
                ) {
                  e.preventDefault()
                  const next =
                    e.key === 'Home'
                      ? tabs[0]
                      : e.key === 'End'
                        ? tabs[tabs.length - 1]
                        : tabs[
                            (index +
                              (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) %
                              tabs.length
                          ]
                  onTabChange(next.id)
                  document.getElementById(`model-tab-${next.id}`)?.focus()
                }
              }}
            >
              <Icon size={15} />
              <span>{label}</span>
              {count != null && <span className="mw-tab-count">{count}</span>}
            </button>
          ))}
        </div>
        <InformationNote title="Chế độ xem mô hình">
          <p>
            {processing
              ? vi('Processing current import')
              : vi('Explore without changing your data')}
          </p>
        </InformationNote>
        <button
          type="button"
          className="mw-inspector-toggle"
          disabled={!hasSelection}
          onClick={onInspect}
        >
          <PanelRight size={15} />
          {' ' + vi('Inspector') + ' '}
        </button>
      </div>
    </>
  )
}
