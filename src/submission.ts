import { analyzeRisk } from './riskAnalyzer.ts'
import type { StructuredCase, Submission } from './schema.ts'
export type { StructuredCase, Submission } from './schema'
export const SUBMISSION_STORAGE_KEY = 'shijian-submissions-v1'

export function structureSubmission(entry: Pick<Submission, 'platform' | 'story' | 'paid' | 'amount' | 'outcome'>): StructuredCase {
  const text = entry.story
  const match = (rules: [RegExp, string][]) => rules.find(([pattern]) => pattern.test(text))?.[1] || '未提及'
  // 只提取明确写出的线索；不把已付款金额自动等同于已确认损失。
  return {
    entryPlatform: entry.platform.trim() || '未提及',
    lure: match([[/兼职|副业|接单|刷单/, '兼职或接单机会'], [/免费|体验/, '免费或低价体验'], [/高收益|投资|理财/, '投资收益'], [/退款|理赔/, '退款或理赔'], [/票|二手|游戏/, '交易机会']]),
    claimedIdentity: match([[/客服|售后/, '客服或售后'], [/警察|公安|法院|检察院|公检法/, '公检法人员'], [/老师|讲师|培训/, '培训人员'], [/店员|商家|门店/, '商家或店员'], [/招聘|HR|人事/, '招聘方']]),
    promise: match([[/包就业|保证就业/, '承诺就业'], [/保本|稳赚|保证收益|高收益|日赚/, '承诺收益'], [/免费|不收费/, '承诺免费'], [/退款|退费|理赔/, '承诺退款或理赔']]),
    requestedAction: match([[/共享屏幕|屏幕共享|远程控制/, '共享屏幕或远程控制'], [/验证码|短信码/, '提供验证码'], [/分期|贷款|先学后付/, '办理分期或贷款'], [/转账|汇款|充值|垫付|付款|支付/, '付款或转账'], [/下载|安装/, '下载或安装软件'], [/签合同|签约/, '签署合同']]),
    payment: entry.paid === '是' ? `已付款${entry.amount ? ` ${entry.amount} 元` : '（金额未填）'}` : '未付款或未确认',
    loss: entry.paid === '是' ? '已付款；实际损失待核实' : '未报告损失',
    exitBarrier: match([[/不退|拒绝退款|退款困难|退不了/, '退款受阻'], [/提现失败|无法提现|提现需要/, '提现受阻'], [/违约金|解约费|退课费/, '解除需额外费用'], [/拉黑|失联|联系不上/, '对方失联']]),
    graphNodes: analyzeRisk(text).graphNodes,
    outcome: entry.outcome.trim() || '未说明',
  }
}

export function normalizeSubmission(value: unknown): Submission | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || !item.id || typeof item.story !== 'string') return null
  const platform = typeof item.platform === 'string' ? item.platform : ''
  const paid = typeof item.paid === 'string' ? item.paid : ''
  const amount = typeof item.amount === 'string' ? item.amount : ''
  const outcome = typeof item.outcome === 'string' ? item.outcome : ''
  const createdAt = typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString()
  const base = { platform, story: item.story, paid, amount, outcome }
  return {
    id: item.id, ...base, contact: typeof item.contact === 'string' ? item.contact : '',
    createdAt, updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : createdAt,
    // 投稿始终是用户经历，恢复文件不能把它升级成官方结论。
    sourceType: '用户投稿', sourceUrl: '', verificationStatus: '未验证',
    structured: structureSubmission(base),
  }
}

export function readSubmissions(): { records: Submission[]; error: string | null } {
  try {
    const raw = localStorage.getItem(SUBMISSION_STORAGE_KEY)
    if (!raw) return { records: [], error: null }
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return { records: [], error: '投稿数据格式异常，请先备份原始数据再恢复。' }
    const records = value.map(normalizeSubmission)
    if (records.some(item => !item) || new Set(records.map(item => item?.id)).size !== records.length) return { records: records.filter((item): item is Submission => Boolean(item)), error: '部分投稿数据不完整或编号重复，已暂停写入，避免覆盖原始数据。' }
    return { records: records as Submission[], error: null }
  } catch { return { records: [], error: '投稿数据无法读取，请先备份原始数据再恢复。' } }
}
