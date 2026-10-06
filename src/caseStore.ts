import { analyzeRisk } from './riskAnalyzer.ts'
import { caseOutcomes, eventStages, evidenceStatuses, isEventStage, isRiskLevel, riskLevels, type Action, type CaseRecord, type EventStage, type Evidence, type RiskAssessment } from './schema.ts'
export type { CaseRecord, CaseOutcome, EvidenceStatus, Evidence, Action, TimelineEvent } from './schema'

export const CASE_STORAGE_KEY = 'shijian-cases-v1'
export const evidenceTypes = ['广告截图', '聊天记录', '合同', '分期合同', '转账凭证', '退款沟通', '店铺/商家信息', '其他']
export const outcomeOptions = caseOutcomes
export const stageOptions = eventStages
export const riskOptions = riskLevels

const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const string = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const strings = (value: unknown, fallback: string[]) => Array.isArray(value) && value.every(item => typeof item === 'string') ? value : fallback

export function normalizeStage(value: unknown, amount = '', description = ''): EventStage {
  if (isEventStage(value)) return value
  // 旧版把“付款”和“签约”混在一起；只在金额或描述明确已付时迁移为“已付款”。
  if (value === '已付款或签约') return Number(amount) > 0 || /已付款|已经付钱|已转账|已经转账/.test(description) ? '已付款' : '被要求操作'
  if (value === '退款或退出中') return '正在维权'
  if (value === '线索接触') return '刚接触'
  return '阶段未知'
}

export function suggestedActions(analysis: RiskAssessment, stage: EventStage): string[] {
  const result = [analysis.priorityAction]
  if (analysis.caseIds.includes('training-installment') || analysis.graphNodes.includes('培训销售')) {
    result.push('保存最初宣传与收益承诺', '获取课程合同', '获取分期合同并确认贷款主体', '停止新增付款', '书面提出解除或退款并保留回复')
  } else if (analysis.caseIds.includes('task-rebate')) {
    result.push('停止做任务和新增垫付', '保存任务页面与聊天记录', '核对收款账户和交易流水')
  } else if (analysis.graphNodes.includes('远程控制')) {
    result.push('停止屏幕共享并检查设备权限', '从官方渠道修改相关账户密码', '核查交易和登录记录')
  } else {
    result.push('保存对方要求、聊天和页面记录', '通过官方渠道独立核实身份与交易规则')
  }
  if (stage === '即将付款') result.unshift('先暂停付款，离开对方提供的链接和二维码')
  if (['已付款', '发现异常', '正在维权'].includes(stage)) result.push('保存付款凭证及合同原件', '联系银行、支付平台或贷款方核实处理途径')
  if (stage === '正在维权') result.push('整理退款沟通记录，必要时准备投诉材料')
  if (stage === '已结束') result.push('核对退款、分期或账户风险是否真正结束，并备份处理结果')
  return [...new Set(result.filter(Boolean))]
}

export function createCase(description: string, analysis: RiskAssessment): CaseRecord {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(), title: analysis.possiblePatterns[0] ? `${analysis.possiblePatterns[0]}相关事件` : '我的风险记录',
    description, riskLevel: analysis.level, stage: analysis.stage, amount: '', platform: '',
    behaviors: analysis.signals.join('、'), measures: '',
    actions: suggestedActions(analysis, analysis.stage).map(text => ({ id: crypto.randomUUID(), text, done: false })),
    timeline: [], evidence: evidenceTypes.map(type => ({ type, status: '未收集', note: '' })),
    outcome: '未解决', analysis, createdAt: now, updatedAt: now,
    sourceType: '用户投稿', sourceUrl: '', verificationStatus: '未验证',
  }
}

function normalizeAssessment(value: unknown, description: string): RiskAssessment {
  const fallback: RiskAssessment = { ...analyzeRisk(description), source: 'local-mock' }
  if (!object(value)) return fallback
  return {
    ...fallback,
    level: isRiskLevel(value.level) ? value.level : fallback.level,
    stage: normalizeStage(value.stage, '', description),
    signals: strings(value.signals, fallback.signals), reasons: strings(value.reasons, fallback.reasons),
    actions: strings(value.actions, fallback.actions), caseIds: strings(value.caseIds, fallback.caseIds),
    graphNodes: strings(value.graphNodes, fallback.graphNodes),
    possiblePatterns: strings(value.possiblePatterns, fallback.possiblePatterns),
    missingInfo: strings(value.missingInfo, fallback.missingInfo),
    priorityAction: string(value.priorityAction, fallback.priorityAction), claimType: '系统推测',
    source: ['local-mock', 'local-only', 'local-fallback', 'ai'].includes(string(value.source)) ? value.source as RiskAssessment['source'] : 'local-mock',
  }
}

export function normalizeCase(value: unknown): CaseRecord | null {
  if (!object(value) || typeof value.id !== 'string' || !value.id || typeof value.description !== 'string') return null
  // 缺少整组字段可用默认值迁移；已有数组中若混入坏记录，则暂停写入，防止静默丢弃。
  if ('actions' in value && !Array.isArray(value.actions) || 'timeline' in value && !Array.isArray(value.timeline) || 'evidence' in value && !Array.isArray(value.evidence)) return null
  if (Array.isArray(value.actions) && value.actions.some(item => !object(item) || typeof item.text !== 'string')) return null
  if (Array.isArray(value.timeline) && value.timeline.some(item => !object(item) || typeof item.description !== 'string')) return null
  if (Array.isArray(value.evidence) && value.evidence.some(item => !object(item) || typeof item.type !== 'string')) return null
  const duplicateIds = (items: unknown[], key: string) => { const ids = items.filter(object).map(item => item[key]).filter((id): id is string => typeof id === 'string'); return new Set(ids).size !== ids.length }
  if (Array.isArray(value.actions) && duplicateIds(value.actions, 'id') || Array.isArray(value.timeline) && duplicateIds(value.timeline, 'id') || Array.isArray(value.evidence) && duplicateIds(value.evidence, 'type')) return null
  const description = value.description
  const analysis = normalizeAssessment(value.analysis, description)
  const createdAt = string(value.createdAt, new Date().toISOString())
  const actions: Action[] = Array.isArray(value.actions)
    ? value.actions.filter(object).filter(item => typeof item.text === 'string').map(item => ({ id: string(item.id, crypto.randomUUID()), text: string(item.text), done: item.done === true }))
    : suggestedActions(analysis, normalizeStage(value.stage, string(value.amount), description)).map(text => ({ id: crypto.randomUUID(), text, done: false }))
  const evidence: Evidence[] = Array.isArray(value.evidence)
    ? value.evidence.filter(object).filter(item => typeof item.type === 'string').map(item => ({ type: string(item.type), status: evidenceStatuses.includes(item.status as Evidence['status']) ? item.status as Evidence['status'] : '未收集', note: string(item.note) }))
    : evidenceTypes.map(type => ({ type, status: '未收集', note: '' }))
  return {
    id: value.id, title: string(value.title, '未命名案件'), description,
    riskLevel: isRiskLevel(value.riskLevel) ? value.riskLevel : analysis.level,
    stage: normalizeStage(value.stage, string(value.amount), description), amount: string(value.amount),
    platform: string(value.platform), behaviors: string(value.behaviors), measures: string(value.measures),
    actions, evidence,
    timeline: Array.isArray(value.timeline) ? value.timeline.filter(object).filter(item => typeof item.description === 'string').map(item => ({ id: string(item.id, crypto.randomUUID()), occurredAt: string(item.occurredAt), description: string(item.description) })) : [],
    outcome: caseOutcomes.includes(value.outcome as CaseRecord['outcome']) ? value.outcome as CaseRecord['outcome'] : '未解决',
    analysis, createdAt, updatedAt: string(value.updatedAt, createdAt),
    // 本机案件是用户经历；导入的 JSON 也不能自行声明“官方认定”。
    sourceType: '用户投稿', sourceUrl: '', verificationStatus: '未验证',
  }
}

export function readCases(): { records: CaseRecord[]; error: string | null } {
  try {
    const raw = localStorage.getItem(CASE_STORAGE_KEY)
    if (!raw) return { records: [], error: null }
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return { records: [], error: '案件数据格式异常，请先备份原始数据再恢复。' }
    const records = value.map(normalizeCase)
    if (records.some(item => !item) || new Set(records.map(item => item?.id)).size !== records.length) return { records: records.filter((item): item is CaseRecord => Boolean(item)), error: '部分案件数据不完整或编号重复，已暂停写入，避免覆盖原始数据。' }
    return { records: records as CaseRecord[], error: null }
  } catch { return { records: [], error: '案件数据无法读取，请先备份原始数据再恢复。' } }
}

export function loadCases(): CaseRecord[] { return readCases().records }

export function saveCase(record: CaseRecord): CaseRecord {
  const current = readCases()
  if (current.error) throw new Error(current.error)
  const next = { ...record, updatedAt: new Date().toISOString() }
  // 先写入浏览器存储，成功后 UI 才更新；损坏数据禁止静默覆盖。
  localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify([next, ...current.records.filter(item => item.id !== record.id)]))
  return next
}

export function deleteCase(id: string): void {
  const current = readCases()
  if (current.error) throw new Error(current.error)
  localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(current.records.filter(item => item.id !== id)))
}
