import type { GraphNode, SourceInfo } from '../schema'
export type GraphItem = GraphNode
const exampleSource: SourceInfo = { sourceType: '示例数据', sourceUrl: '', verificationStatus: '未验证', updatedAt: '2026-10-06' }
const graphData: Omit<GraphNode, keyof SourceInfo>[] = [
  { id: '利益诱导', kind: 'core', x: 460, y: 80, description: '用好处吸引注意，让人先靠近机会。' },
  { id: '身份冒充', kind: 'core', x: 790, y: 80, description: '借官方、平台或熟人身份降低警惕。' },
  { id: '恐惧施压', kind: 'core', x: 1070, y: 240, description: '制造紧迫感，让人没有时间核实。' },
  { id: '信任建立', kind: 'core', x: 130, y: 230, description: '先给小额好处或陪伴，再提出更大的要求。' },
  { id: '信息索取', kind: 'core', x: 780, y: 390, description: '索取验证码、证件、账户信息或设备权限。' },
  { id: '资金转移', kind: 'core', x: 460, y: 420, description: '要求充值、转账、垫付或支付保证金。' },
  { id: '分期贷款', kind: 'core', x: 140, y: 530, description: '把一次付款包装成低门槛的长期还款。' },
  { id: '远程控制', kind: 'core', x: 1070, y: 530, description: '通过屏幕共享或远程软件观察、操控手机。' },
  { id: '沉没成本', kind: 'core', x: 760, y: 680, description: '已经投入后，要求再付一笔才能挽回前面的钱。' },
  { id: '退出困难', kind: 'core', x: 430, y: 730, description: '通过合同、提现条件或不断追加付款增加退出成本。' },
  { id: '免费体验', kind: 'pattern', x: 290, y: -90, description: '先用低门槛体验吸引进场，后续可能追加收费。' },
  { id: '兼职赚钱', kind: 'pattern', x: 540, y: -120, description: '以灵活收入吸引，再看是否出现垫付或贷款要求。' },
  { id: '高收益', kind: 'pattern', x: 770, y: -95, description: '“保本”“稳赚”等承诺应独立核实。' },
  { id: '刷单', kind: 'example', x: 360, y: -280, description: '先返少量佣金，再要求不断垫付才能提现。' },
  { id: 'AI副业', kind: 'example', x: 570, y: -300, description: '新技术名词可能只是包装，重点核对真实工作与收费。' },
  { id: '培训分期', kind: 'example', x: 790, y: -270, description: '工作机会与课程贷款绑定，需看清贷款主体和合同。' },
  { id: '收益承诺', kind: 'pattern', x: 680, y: -170, description: '用预期收入降低对当前付款或借贷的警惕。' },
  { id: '培训销售', kind: 'pattern', x: 900, y: -170, description: '把工作机会引向付费课程，需要核对课程和招聘关系。' },
]
export const graphItems: GraphItem[] = graphData.map(item => ({ ...item, ...exampleSource }))

// 边表达套路间的交叉关系；同一案例可同时关联多个节点，而不是单一路径。
export const graphLinks: [string, string][] = [
  ['利益诱导', '信任建立'], ['利益诱导', '资金转移'], ['利益诱导', '分期贷款'],
  ['身份冒充', '恐惧施压'], ['身份冒充', '信息索取'], ['身份冒充', '信任建立'],
  ['恐惧施压', '资金转移'], ['恐惧施压', '远程控制'], ['信任建立', '资金转移'],
  ['信息索取', '远程控制'], ['信息索取', '资金转移'], ['资金转移', '沉没成本'],
  ['分期贷款', '退出困难'], ['分期贷款', '沉没成本'], ['远程控制', '资金转移'],
  ['沉没成本', '退出困难'], ['免费体验', '利益诱导'], ['免费体验', '分期贷款'],
  ['兼职赚钱', '利益诱导'], ['兼职赚钱', '刷单'], ['兼职赚钱', 'AI副业'],
  ['兼职赚钱', '培训分期'], ['高收益', '利益诱导'], ['高收益', '资金转移'],
  ['刷单', '资金转移'], ['刷单', '沉没成本'], ['AI副业', '培训分期'],
  ['培训分期', '分期贷款'], ['培训分期', '退出困难'],
  ['兼职赚钱', '收益承诺'], ['收益承诺', '培训销售'],
  ['培训销售', '分期贷款'], ['培训销售', '培训分期'],
]
