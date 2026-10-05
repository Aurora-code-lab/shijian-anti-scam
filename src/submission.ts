import { analyzeRisk } from './riskAnalyzer.ts'

export type StructuredCase = {
  entryPlatform: string
  lure: string
  claimedIdentity: string
  promise: string
  requestedAction: string
  payment: string
  loss: string
  exitBarrier: string
  graphNodes: string[]
  outcome: string
}

export type Submission = {
  id: string; platform: string; contact: string; story: string; paid: string; amount: string
  outcome: string; createdAt: string; structured?: StructuredCase
}

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
