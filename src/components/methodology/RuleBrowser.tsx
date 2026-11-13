import { displayRuleById } from '@/lib/localized-model'
import { vi, vt } from '@/lib/i18n'
import {
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  ListFilter,
  X,
  Braces,
} from 'lucide-react'
import { methodologyRules } from '@/lib/methodology'
import {
  filterRules,
  ruleGroups,
  ruleStatus,
  type RuleFilters,
} from '@/lib/model-workspace'
import type { RunEvidence } from '@/lib/reconciliation-evidence'

export function RuleBrowser({
  filters,
  onFiltersChange,
  selectedId,
  onSelect,
  evidence,
}: {
  filters: RuleFilters
  onFiltersChange: (filters: RuleFilters) => void
  selectedId: string | null
  onSelect: (id: string) => void
  evidence?: RunEvidence
}) {
  const rules = filterRules(filters)
    .map((rule) => displayRuleById.get(rule.id) ?? rule)
    .map((rule) => displayRuleById.get(rule.id) ?? rule)
    .map((rule) => displayRuleById.get(rule.id) ?? rule)
  return (
    <section className="mw-rule-browser" aria-label={vi('Rule browser')}>
      <div className="mw-rule-toolbar">
        <div className="mw-search">
          <Search size={15} />
          <input
            aria-label={vi('Search rules')}
            placeholder={vi('Search names, conditions, expressions…')}
            value={filters.query}
            onChange={(e) =>
              onFiltersChange({ ...filters, query: e.target.value })
            }
          />
          {filters.query && (
            <button
              type="button"
              aria-label={vi('Clear rule search')}
              onClick={() => onFiltersChange({ ...filters, query: '' })}
            >
              <X size={13} />
            </button>
          )}
          <kbd>/</kbd>
        </div>
        <div className="mw-rule-filterbar">
          <SlidersHorizontal size={13} />
          <select
            aria-label={vi('Filter rules by source')}
            value={filters.source}
            onChange={(e) =>
              onFiltersChange({ ...filters, source: e.target.value })
            }
          >
            <option value="All">{vi('All sources')}</option>
            {['POS', 'WEB', 'GL', 'Flash', 'Dim'].map((s) => (
              <option key={s} value={s}>
                {s === 'Flash' ? 'Sales Flash' : s}
              </option>
            ))}
          </select>
          <select
            aria-label={vi('Filter rules by group')}
            value={filters.group}
            onChange={(e) =>
              onFiltersChange({ ...filters, group: e.target.value })
            }
          >
            <option value="All">{vi('All categories')}</option>
            {ruleGroups.map((g) => (
              <option key={g} value={g}>
                {vi(g)}
              </option>
            ))}
          </select>
          <span className="mw-meta">
            {rules.length}
            {' ' + vi('of') + ' '}
            {methodologyRules.length}
            {' ' + vi('rules') + ' '}
          </span>
        </div>
      </div>
      <div
        className="mw-rule-list"
        role="list"
        aria-label={vi('Matching rules')}
      >
        {rules.length ? (
          rules.map((rule) => {
            const status = ruleStatus(rule.id, evidence)
            return (
              <div role="listitem" key={rule.id}>
                <button
                  type="button"
                  className={`mw-rule-row ${selectedId === rule.id ? 'is-selected' : ''}`}
                  data-rule-id={rule.id}
                  aria-pressed={selectedId === rule.id}
                  aria-label={vt`Inspect rule: ${rule.title}`}
                  onClick={() => onSelect(rule.id)}
                >
                  <span className="mw-rule-icon">
                    <Braces size={17} />
                  </span>
                  <span className="mw-rule-content">
                    <span className="mw-rule-title">
                      {rule.title}
                      <ArrowUpRight size={13} />
                    </span>
                    <span className="mw-rule-summary">{rule.purpose}</span>
                    <span className="mw-rule-tags">
                      <span>{rule.group}</span>
                      <i />
                      {rule.sourceIds.map((s) => (
                        <span key={s} className="mw-source-badge">
                          {s === 'Flash' ? 'Sales Flash' : s}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className={`mw-badge mw-status-${status.tone}`}>
                    {vi(status.label)}
                  </span>
                </button>
              </div>
            )
          })
        ) : (
          <div className="mw-empty">
            <span className="mw-empty-icon">
              <ListFilter size={23} />
            </span>
            <h3>{vi('No matching rules')}</h3>
            <p>{vi('Try another name, source, or category.')}</p>
            <button
              type="button"
              className="mw-text-button"
              onClick={() =>
                onFiltersChange({ query: '', source: 'All', group: 'All' })
              }
            >
              {' ' + vi('Clear filters') + ' '}
            </button>
          </div>
        )}
      </div>
      <footer className="mw-panel-footer">
        <span>{vi('Definitions reflect the current implementation.')}</span>
        <span className="mw-muted">
          {' ' + vi('Select a rule to inspect') + ' '}
          <ArrowUpRight size={12} />
        </span>
      </footer>
    </section>
  )
}
