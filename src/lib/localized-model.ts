import {
  modelNodes,
  modelConnections,
  methodologyRules,
} from './methodology.ts'
import { vi } from './i18n.ts'
import { MAPPING_FIELDS } from './data-mapping.ts'
import { REFERENCE_FIELDS, ROLE_LABELS, PURPOSE_LABELS } from './master-data.ts'
import { ONBOARDING_STEPS } from './onboarding.ts'

/** Copied display models. The original metadata, IDs, types and SQL expressions are unchanged. */
export const displayNodeById = new Map(
  modelNodes.map((node) => [
    node.id,
    {
      ...node,
      title: vi(node.title),
      role: vi(node.role),
      grain: vi(node.grain),
      caution: node.caution ? vi(node.caution) : undefined,
      keys: node.keys.map(vi),
      logic: node.logic.map(vi),
      fields: node.fields.map((field) => ({
        ...field,
        type: vi(field.type),
        description: vi(field.description),
      })),
    },
  ]),
)
export const displayEdgeById = new Map(
  modelConnections.map((edge) => [
    edge.id,
    {
      ...edge,
      label: vi(edge.label),
      operation: vi(edge.operation),
      keys: edge.keys.map(vi),
      cardinality: vi(edge.cardinality),
      condition: vi(edge.condition),
      explanation: vi(edge.explanation),
    },
  ]),
)
export const displayRuleById = new Map(
  methodologyRules.map((rule) => [
    rule.id,
    {
      ...rule,
      title: vi(rule.title),
      group: vi(rule.group),
      purpose: vi(rule.purpose),
      inputFields: rule.inputFields.map(vi),
      condition: vi(rule.condition),
      logic: vi(rule.logic),
      output: vi(rule.output),
      nullError: vi(rule.nullError),
    },
  ]),
)
export function nodeTypeLabel(type: string) {
  return vi(type === 'Reference' ? 'Reference table' : type)
}
export const displayRules = [...displayRuleById.values()]
export const displayOnboardingSteps = ONBOARDING_STEPS.map((step) => ({
  ...step,
  label: vi(step.label),
  name: vi(step.name),
  description: vi(step.description),
}))
export const displayMappingFields = Object.fromEntries(
  Object.entries(MAPPING_FIELDS).map(([source, fields]) => [
    source,
    fields.map((field) => ({
      ...field,
      label: vi(field.label),
      description: vi(field.description),
    })),
  ]),
) as unknown as typeof MAPPING_FIELDS
export const displayReferenceFields = Object.fromEntries(
  Object.entries(REFERENCE_FIELDS).map(([role, fields]) => [
    role,
    fields.map((field) => ({
      ...field,
      label: vi(field.label),
      description: vi(field.description),
    })),
  ]),
) as typeof REFERENCE_FIELDS
export const displayRoleLabels = Object.fromEntries(
  Object.entries(ROLE_LABELS).map(([role, label]) => [role, vi(label)]),
) as typeof ROLE_LABELS
export const displayPurposeLabels = Object.fromEntries(
  Object.entries(PURPOSE_LABELS).map(([purpose, label]) => [
    purpose,
    vi(label),
  ]),
) as typeof PURPOSE_LABELS
