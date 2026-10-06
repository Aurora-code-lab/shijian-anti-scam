import type { EventStage, RiskLevel, RiskResult } from './schema'
export type { EventStage, RiskLevel, RiskResult } from './schema'

const patterns: Record<string, RegExp> = {
  partTime: /兼职|副业|接单|刷单|做任务/,
  return: /高收益|稳赚|保本|返佣|日赚|轻松赚钱|收益承诺|保证收益/,
  training: /培训|课程|学习|先学后付|包就业/,
  installment: /分期|贷款|借贷|花呗|白条|先用后付/,
  code: /验证码|短信码|动态码/,
  remote: /共享屏幕|屏幕共享|远程控制|远程协助|投屏/,
  app: /下载.{0,8}(APP|app|软件)|安装.{0,8}(APP|app|软件)|陌生.{0,4}(APP|app)/,
  transfer: /转账|汇款|付款|支付|充值|打款|交钱/,
  service: /客服|售后|退款|理赔/,
  authority: /公检法|警察|公安|法院|检察院|安全账户|涉案/,
  order: /刷单|垫付|做任务|返佣/,
  investment: /投资|炒股|虚拟币|数字货币|理财/,
  beauty: /美发|美容|办卡|体验券|免费体验/,
  outside: /脱离平台|站外|私下交易|加微信|加QQ|扫码联系/,
  pressure: /马上|立刻|限时|不许告诉|保密|催促|现在就|否则/,
  paid: /已经.{0,6}(转账|付款|支付|充值)|已转钱|已转账|已付款|已支付|钱已经转|已经付钱/,
  signed: /已经.{0,5}(签|分期|贷款)|签了合同|办了分期/,
}

const labels: Record<string, string> = {
  partTime: '兼职或任务', return: '收益承诺', training: '培训课程', installment: '分期贷款',
  code: '索取验证码', remote: '屏幕共享或远程控制', app: '要求下载软件', transfer: '要求付款',
  service: '客服身份', authority: '公检法身份', order: '刷单或垫付', investment: '投资理财',
  beauty: '美发美容体验', outside: '脱离平台沟通', pressure: '催促或保密', paid: '已经付款', signed: '已经签约或分期',
}

// 本地规则只负责提取线索；AI/API 调用由独立 service 负责，不能从这里静默上传描述。
export function analyzeRisk(input: string): RiskResult {
  const text = input.trim()
  if (!text) return {
    level: '信息不足', signals: [], reasons: ['信息不足，暂时无法判断。请补充对方让你做什么、是否涉及付款或验证码。'],
    actions: ['先暂停付款和信息提供。', '写下对方的要求、联系方式和交易平台，再重新判断。'], caseIds: [],
    stage: '阶段未知', priorityAction: '先暂停付款和信息提供。',
    missingInfo: ['对方让你做什么？', '是否已付款、签约或提供验证码？', '在哪里接触到对方？'],
    graphNodes: [], possiblePatterns: [], claimType: '系统推测',
  }

  const found = Object.fromEntries(Object.entries(patterns).map(([key, pattern]) => [key, pattern.test(text)])) as Record<keyof typeof patterns, boolean>
  const has = (...keys: string[]) => keys.every(key => found[key])
  const activeAccountExposure = /(?:正在|已经|已).{0,6}(?:共享屏幕|屏幕共享|远程控制)|(?:让我|要我|要求我|叫我).{0,8}(?:共享屏幕|屏幕共享|验证码)/.test(text)
  const reasons: string[] = []
  const caseIds = new Set<string>()
  let level: RiskLevel = '信息不足'

  // 组合信号才升级风险；单个“兼职”“客服”等普通词不能直接断定诈骗。
  if (has('partTime', 'return', 'training', 'installment')) {
    level = '高风险'; reasons.push('兼职和收益承诺与培训分期叠加，可能把风险转嫁给你。'); caseIds.add('training-installment')
  }
  if (has('partTime', 'order', 'transfer')) {
    level = '高风险'; reasons.push('兼职任务与垫付或付款要求同时出现，需要先停止转账并核验。'); caseIds.add('task-rebate')
  }
  if (has('investment', 'return', 'transfer')) {
    level = '高风险'; reasons.push('投资收益承诺与付款要求同时出现，需先核验平台与资金去向。'); caseIds.add('fake-investment')
  }
  if (has('service', 'code') || has('authority', 'transfer') || has('service', 'remote') || has('outside', 'transfer')) {
    level = '高风险'; reasons.push('身份或平台外沟通与验证码、远程操作或付款要求叠加。'); caseIds.add(found.authority ? 'fake-police' : 'fake-service')
  }
  if (has('beauty', 'installment') || has('beauty', 'transfer', 'pressure')) {
    level = '高风险'; reasons.push('现场体验与付款或分期压力同时出现，先离开销售情境再决定。'); caseIds.add('free-haircut')
  }
  if (has('app', 'transfer') || has('app', 'remote') || has('code', 'transfer') || has('pressure', 'transfer')) {
    level = '高风险'; reasons.push('要求安装软件、提供验证码或催促付款，需要立即停下来核验。'); caseIds.add(found.remote ? 'screen-sharing' : 'fake-service')
  }
  if (level === '信息不足' && Object.values(found).filter(Boolean).length >= 2) {
    level = '需要注意'; reasons.push('出现多个相关信号，但仍需核实对方身份和具体要求。')
  }
  if (level === '信息不足' && Object.values(found).some(Boolean)) {
    level = '需要注意'; reasons.push('发现一个值得核实的信号；单个词不能说明对方一定有问题。')
  }
  const levelBeforeUrgency = level
  // 已付款、正在交出验证码/控制权时，优先给出止损动作，不把“紧急”当作诈骗定性。
  if (found.paid || activeAccountExposure || (found.code && (found.service || found.authority || found.pressure)) || (found.remote && (found.transfer || found.service || found.authority))) {
    level = '紧急'; reasons.unshift('描述中出现即时的资金或账户控制风险，先处理眼前风险。')
  }
  if (!reasons.length) reasons.push('信息不足，暂时无法判断。请补充对方的要求和事件经过。')

  // 阶段按时间推进，后发生的“维权/结束”优先于付款线索；合同签署不等同于已付款。
  const stage: EventStage = /已经解决|已解决|全额退款|退款成功|事情结束|处理完毕/.test(text) ? '已结束'
    : /提出.{0,4}退款|申请.{0,4}退款|退款被拒|退款困难|退课|退费|解除合同|投诉|报案/.test(text) ? '正在维权'
      : /发现异常|发现不对|感觉不对|感觉被骗|无法提现|提现失败/.test(text) ? '发现异常'
        : found.paid ? '已付款'
          : /(?:准备|马上|即将|现在要|催我|催着).{0,8}(?:付款|转账|支付|充值)|(?:付款|转账).{0,6}(?:倒计时|马上)/.test(text) ? '即将付款'
            : found.transfer || found.code || found.remote || found.installment || found.signed ? '被要求操作'
              : /正在.{0,6}(?:聊|沟通|联系)|加微信|加QQ|持续联系/.test(text) ? '正在沟通'
                : Object.values(found).some(Boolean) ? '刚接触' : '阶段未知'
  if (stage === '已结束' && level === '紧急') {
    level = levelBeforeUrgency === '高风险' ? '高风险' : '需要注意'
    if (reasons[0]?.startsWith('描述中出现即时')) reasons.shift()
    reasons.unshift('描述显示事件已结束，先核对资金、合同和账户状态是否真正恢复。')
  }

  const actions = stage === '正在维权'
    ? ['先停止新增付款，保存原始证据和每次沟通记录。', '通过官方渠道核对合同、交易和退款规则。', '用书面方式提出诉求并留存回复。']
    : stage === '已结束'
      ? ['妥善备份原始证据与处理结果。', '检查相关账户和分期是否已真正终止。']
      : level === '紧急'
    ? ['立即停止付款、共享屏幕和提供验证码。', '通过官方 App 或自行查找的官方电话核实，勿回拨对方给的号码。', '若已付款，尽快联系银行或支付平台申请止付，并保留记录。']
    : level === '高风险'
      ? ['先暂停交易、签约或下载软件。', '离开对方提供的链接和聊天渠道，独立核实身份与规则。', '保存聊天、订单和付款要求，必要时找可信的人一起看。']
      : ['先不要付款或提供验证码。', '补充对方的身份、要求和付款方式，再做判断。']

  const missingInfo = [
    !/(?:微信|小红书|抖音|电话|网页|平台|门店|商场|APP|app)/.test(text) && '在哪里接触到对方？',
    !found.transfer && !found.paid && '对方是否要求付款或转账？',
    !found.signed && '是否签署合同或办理分期？',
    !/(?:对方|客服|商家|老师|警察|招聘方|店员)/.test(text) && '对方自称什么身份？',
  ].filter((item): item is string => Boolean(item))
  // 图谱节点来自已识别的行为；只有组合规则命中时才补充具体套路节点。
  const graphNodes = new Set<string>()
  if (found.partTime) graphNodes.add('兼职赚钱')
  if (found.return) graphNodes.add('收益承诺')
  if (found.training) graphNodes.add('培训销售')
  if (found.installment) graphNodes.add('分期贷款')
  if (found.order) graphNodes.add('刷单')
  if (found.investment) graphNodes.add('高收益')
  if (found.beauty) graphNodes.add('免费体验')
  if (found.service || found.authority) graphNodes.add('身份冒充')
  if (found.code) graphNodes.add('信息索取')
  if (found.remote) graphNodes.add('远程控制')
  if (found.transfer || found.paid) graphNodes.add('资金转移')
  if (found.pressure) graphNodes.add('恐惧施压')
  if (stage === '正在维权' && /退款困难|拒绝退款|无法提现|退出|解约/.test(text)) graphNodes.add('退出困难')
  if (caseIds.has('training-installment')) graphNodes.add('培训分期')
  const possiblePatterns = [...caseIds].map(id => ({
    'training-installment': '培训分期', 'task-rebate': '刷单返佣', 'fake-investment': '虚假投资',
    'fake-police': '冒充公检法', 'fake-service': '冒充客服', 'free-haircut': '免费体验后的高压销售',
    'screen-sharing': '屏幕共享诱导',
  } as Record<string, string>)[id]).filter(Boolean)
  return { level, signals: Object.entries(found).filter(([, value]) => value).map(([key]) => labels[key]), reasons, actions, caseIds: [...caseIds], stage, priorityAction: actions[0], missingInfo, graphNodes: [...graphNodes], possiblePatterns, claimType: '系统推测' }
}
