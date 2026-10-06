export const riskLevels = ['信息不足', '需要注意', '高风险', '紧急'] as const
export type RiskLevel = typeof riskLevels[number]

export const eventStages = ['阶段未知', '刚接触', '正在沟通', '被要求操作', '即将付款', '已付款', '发现异常', '正在维权', '已结束'] as const
export type EventStage = typeof eventStages[number]

export const sourceTypes = ['官方', '媒体', '用户投稿', '社交媒体', '示例数据'] as const
export type SourceType = typeof sourceTypes[number]
export const verificationStatuses = ['未验证', '多源一致', '已核实'] as const
export type VerificationStatus = typeof verificationStatuses[number]
export type SourceInfo = { sourceType: SourceType; sourceUrl: string; verificationStatus: VerificationStatus; updatedAt: string }

export type Scam = SourceInfo & {
  id: string; title: string; summary: string; path: string[]; signals: string[]
  now: string; paid: string; nodes: string[]; category: string
}
export type GraphNode = SourceInfo & {
  id: string; kind: 'core' | 'pattern' | 'example'; x: number; y: number; description: string
}

export type RiskResult = {
  level: RiskLevel; signals: string[]; reasons: string[]; actions: string[]; caseIds: string[]
  stage: EventStage; priorityAction: string; missingInfo: string[]; graphNodes: string[]
  possiblePatterns: string[]; claimType: '系统推测'
}
export type RiskAssessment = RiskResult & { source: 'local-mock' | 'local-only' | 'local-fallback' | 'ai' }

export type TimelineEvent = { id: string; occurredAt: string; description: string }
export const evidenceStatuses = ['未收集', '已保存', '已备份'] as const
export type EvidenceStatus = typeof evidenceStatuses[number]
export type Evidence = { type: string; status: EvidenceStatus; note: string }
export const caseOutcomes = ['未解决', '全额退款', '部分退款', '平台介入', '12315处理', '公安受理', '商家失联', '其他'] as const
export type CaseOutcome = typeof caseOutcomes[number]
export type Action = { id: string; text: string; done: boolean }
export type CaseRecord = SourceInfo & {
  id: string; title: string; description: string; riskLevel: RiskLevel; stage: EventStage
  amount: string; platform: string; behaviors: string; measures: string; actions: Action[]
  timeline: TimelineEvent[]; evidence: Evidence[]; outcome: CaseOutcome
  analysis: RiskAssessment; createdAt: string
}

export type StructuredCase = {
  entryPlatform: string; lure: string; claimedIdentity: string; promise: string
  requestedAction: string; payment: string; loss: string; exitBarrier: string
  graphNodes: string[]; outcome: string
}
export type Submission = SourceInfo & {
  id: string; platform: string; contact: string; story: string; paid: string
  amount: string; outcome: string; createdAt: string; structured: StructuredCase
}

export const isEventStage = (value: unknown): value is EventStage => eventStages.includes(value as EventStage)
export const isRiskLevel = (value: unknown): value is RiskLevel => riskLevels.includes(value as RiskLevel)
export const isVerificationStatus = (value: unknown): value is VerificationStatus => verificationStatuses.includes(value as VerificationStatus)
export const isSourceType = (value: unknown): value is SourceType => sourceTypes.includes(value as SourceType)
export const sourceLabel = (item: SourceInfo) => item.sourceType === '用户投稿' ? '用户经历 · 未验证'
  : item.sourceType === '官方' && item.verificationStatus === '已核实' ? '官方认定'
    : `${item.sourceType} · ${item.verificationStatus}`
