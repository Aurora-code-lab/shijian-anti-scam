import type { EventStage, RiskLevel } from './riskAnalyzer'
import type { RiskAssessment } from './riskService'

export type TimelineEvent = { id: string; occurredAt: string; description: string }
export type EvidenceStatus = '未收集' | '已保存' | '已备份'
export type EvidenceItem = { type: string; status: EvidenceStatus; note: string }
export type CaseOutcome = '未解决' | '全额退款' | '部分退款' | '平台介入' | '12315处理' | '公安受理' | '商家失联' | '其他'
export type CaseAction = { id: string; text: string; done: boolean }

export type CaseRecord = {
  id: string
  title: string
  description: string
  riskLevel: RiskLevel
  stage: EventStage
  amount: string
  platform: string
  behaviors: string
  measures: string
  actions: CaseAction[]
  timeline: TimelineEvent[]
  evidence: EvidenceItem[]
  outcome: CaseOutcome
  analysis: RiskAssessment
  createdAt: string
  updatedAt: string
}

const key = 'shijian-cases-v1'
export const evidenceTypes = ['广告截图', '聊天记录', '合同', '分期合同', '转账凭证', '退款沟通', '店铺/商家信息', '其他']
export const outcomeOptions: CaseOutcome[] = ['未解决', '全额退款', '部分退款', '平台介入', '12315处理', '公安受理', '商家失联', '其他']
export const stageOptions: EventStage[] = ['线索接触', '被要求操作', '已付款或签约', '退款或退出中', '无法判断']
export const riskOptions: RiskLevel[] = ['信息不足', '需要注意', '高风险', '紧急']

export function suggestedActions(analysis: RiskAssessment, stage: EventStage): string[] {
  const result = [analysis.priorityAction]
  if (analysis.caseIds.some(id => id === 'training-installment' || id === 'learn-pay-later') || analysis.graphNodes.includes('培训销售')) {
    result.push('保存最初宣传与收益承诺', '获取课程合同', '获取分期合同并确认贷款主体', '停止新增付款', '书面提出解除或退款并保留回复')
  } else if (analysis.caseIds.includes('task-rebate')) {
    result.push('停止做任务和新增垫付', '保存任务页面与聊天记录', '核对收款账户和交易流水')
  } else if (analysis.graphNodes.includes('远程控制')) {
    result.push('停止屏幕共享并检查设备权限', '从官方渠道修改相关账户密码', '核查交易和登录记录')
  } else {
    result.push('保存对方要求、聊天和页面记录', '通过官方渠道独立核实身份与交易规则')
  }
  if (stage === '已付款或签约' || stage === '退款或退出中') result.push('保存付款凭证及合同原件', '联系银行、支付平台或贷款方核实处理途径')
  if (stage === '退款或退出中') result.push('整理退款沟通记录，必要时准备投诉材料')
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
  }
}

export function loadCases(): CaseRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]')
    // 本地数据可能由旧版或手工修改；只读取有基本结构的案件，避免页面崩溃。
    return Array.isArray(value) ? value.filter((item): item is CaseRecord =>
      Boolean(item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.description === 'string' && Array.isArray(item.actions) && Array.isArray(item.timeline) && Array.isArray(item.evidence))) : []
  } catch { return [] }
}

export function saveCase(record: CaseRecord): CaseRecord {
  const next = { ...record, updatedAt: new Date().toISOString() }
  const all = loadCases().filter(item => item.id !== record.id)
  // 先写入浏览器存储，成功后页面才更新；异常交给 UI 提示，不能误报“已保存”。
  localStorage.setItem(key, JSON.stringify([next, ...all]))
  return next
}

export function deleteCase(id: string): void {
  localStorage.setItem(key, JSON.stringify(loadCases().filter(item => item.id !== id)))
}
