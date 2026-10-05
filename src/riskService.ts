import { analyzeRisk, type RiskResult } from './riskAnalyzer.ts'
import { cases } from './data/cases.ts'
import { graphItems } from './data/graph.ts'

export type RiskAssessment = RiskResult & { source: 'local-mock' | 'local-only' | 'local-fallback' | 'ai' }

export interface RiskAnalysisService {
  remote?: boolean
  destination?: string
  analyze(description: string, local: RiskResult): Promise<Partial<RiskResult>>
}

// 当前 mock 不上传任何内容。以后接入 API 时只替换此实现，并在发送前取得用户同意。
export const mockAiService: RiskAnalysisService = {
  async analyze(_description, _local) { return {} },
}
export const activeAiService: RiskAnalysisService = mockAiService

export async function analyzeExperience(description: string, service: RiskAnalysisService = activeAiService, allowRemote = false): Promise<RiskAssessment> {
  const local = analyzeRisk(description)
  // 未来替换为远程模型时，未获得本次用户同意就只返回本地规则结果。
  if (service.remote && (!allowRemote || !service.destination)) return { ...local, source: 'local-only' }
  let ai: Partial<RiskResult>
  try { ai = await service.analyze(description, local) }
  catch { return { ...local, source: 'local-fallback' } }
  // 统一结果格式：AI 只补充经过校验的字段；空信息仍可明确为“信息不足”。
  const levels = ['信息不足', '需要注意', '高风险', '紧急']
  const stages = ['线索接触', '被要求操作', '已付款或签约', '退款或退出中', '无法判断']
  const list = (value: unknown, fallback: string[]) => Array.isArray(value) && value.every(item => typeof item === 'string') ? value : fallback
  return {
    ...local,
    level: ai.level && levels.includes(ai.level) ? ai.level : local.level,
    stage: ai.stage && stages.includes(ai.stage) ? ai.stage : local.stage,
    signals: list(ai.signals, local.signals),
    reasons: list(ai.reasons, local.reasons),
    actions: list(ai.actions, local.actions),
    caseIds: list(ai.caseIds, local.caseIds).filter(id => cases.some(item => item.id === id)),
    graphNodes: list(ai.graphNodes, local.graphNodes).filter(id => graphItems.some(item => item.id === id)),
    // 只使用案例库中的套路名称，避免未来 API 输出对具体个人或商家的定性。
    possiblePatterns: list(ai.possiblePatterns, local.possiblePatterns).filter(name => cases.some(item => item.title === name) || local.possiblePatterns.includes(name)),
    missingInfo: list(ai.missingInfo, local.missingInfo),
    priorityAction: typeof ai.priorityAction === 'string' && ai.priorityAction.trim() ? ai.priorityAction : local.priorityAction,
    source: service === mockAiService ? 'local-mock' : 'ai',
  }
}
