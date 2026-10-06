import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CaseList, CaseRecordPage } from './CaseCenter'
import { cases } from './data/cases'
import { createCase, saveCase } from './caseStore'
import { type RiskLevel } from './riskAnalyzer'
import { activeAiService, analyzeExperience, type RiskAssessment } from './riskService'
import { readSubmissions, SUBMISSION_STORAGE_KEY, structureSubmission, type Submission } from './submission'
import { eventStages, isEventStage, sourceLabel, type EventStage } from './schema'

const GraphPage = lazy(() => import('./GraphPage'))

const nav = [['/', '首页'], ['/graph', '骗局图谱'], ['/cases', '案例库'], ['/my-cases', '案件中心'], ['/submit', '提交案例']]
const quickLinks = [
  { label: '我已经付钱了', detail: '先做止损', to: '/emergency?type=paid', icon: '↗' },
  { label: '我现在正在被催', detail: '先停下来', to: '/emergency?type=payment', icon: '↗' },
  { label: '我只是想查一种套路', detail: '浏览案例', to: '/cases', icon: '↗' },
]
const emergencyOptions = [
  { id: 'payment', title: '正在让我付款', steps: ['先暂停付款，不扫对方给的二维码或链接。', '离开当前聊天，从官方 App 或自行查到的电话核实。', '如果对方持续催促，先结束对话，找可信的人一起看。'] },
  { id: 'screen', title: '共享屏幕', steps: ['立即停止共享并断开远程连接。', '退出银行、支付和短信页面，检查远程软件权限。', '从官方渠道修改重要账户密码；若发生交易，立即联系银行。'] },
  { id: 'code', title: '提供验证码', steps: ['不要读出、截图或转发验证码。', '如果已提供，立即修改相关账户密码并退出其他登录设备。', '通过官方渠道检查账户交易与绑定信息。'] },
  { id: 'store', title: '店内推销', steps: ['先停止签字、刷脸和分期申请。', '要求拿到完整价目和合同，可以直接离店考虑。', '如有人阻拦离开，优先到安全处寻求现场帮助。'] },
  { id: 'paid', title: '已转钱', steps: ['立即停止后续转账，不为“退款”或“提现”再付款。', '尽快联系银行或支付平台，说明情况并申请止付或冻结。', '保存转账凭证、收款账户、聊天记录和链接，向当地公安机关报案。'] },
  { id: 'signed', title: '已签合同或分期', steps: ['不要再签补充协议或继续借款。', '保存合同、页面、录音和销售承诺，核对贷款方、金额与取消条款。', '尽快向签约平台及贷款方提出书面异议，保留回复。'] },
]
const stageEmergencyStep: Partial<Record<EventStage, string>> = {
  即将付款: '先不要确认付款；离开对方给的链接和二维码。',
  已付款: '立即联系银行或支付平台，询问止付和争议处理。',
  发现异常: '停止后续操作，保存交易、聊天和页面原始记录。',
  正在维权: '用书面方式记录诉求和每次回复，避免再次付款。',
  已结束: '核对退款、分期和账户风险是否真正结束。',
}

function Icon({ name, size = 20 }: { name: 'shield' | 'arrow' | 'spark' | 'alert' | 'menu'; size?: number }) {
  const paths = {
    shield: <><path d="M12 2 4 5v6c0 5 3.3 8.5 8 11 4.7-2.5 8-6 8-11V5l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    spark: <><path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z" /><path d="m19 17 .5 2.5L22 20l-2.5.5L19 23l-.5-2.5L16 20l2.5-.5L19 17Z" /></>,
    alert: <><path d="M12 3 2 21h20L12 3Z" /><path d="M12 9v5" /><path d="M12 18h.01" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function Header() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  return <header className="site-header"><div className="header-inner"><Link to="/" className="brand" aria-label="识间首页"><span className="brand-mark"><Icon name="shield" size={19} /></span><span>识间<span className="brand-dot">.</span></span></Link><nav className={open ? 'main-nav open' : 'main-nav'} aria-label="主导航">{nav.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>)}</nav><div className="header-right"><span className="header-note">保持清醒，保持选择权</span><button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="切换导航" aria-expanded={open}><Icon name="menu" /></button></div></div>{location.pathname !== '/emergency' && <Link className="emergency-float" to="/emergency"><span className="emergency-pulse" />立即处理 <span>↗</span></Link>}</header>
}

function FirstVisit() {
  const key = 'shijian-first-tip-v2'
  const [visible, setVisible] = useState(() => { try { return localStorage.getItem(key) !== 'seen' } catch { return false } })
  function close() { try { localStorage.setItem(key, 'seen') } catch { /* 存储被禁用时，本次会话仍可关闭 */ } setVisible(false) }
  if (!visible) return null
  return <div className="modal-backdrop" role="presentation"><section className="first-modal" role="dialog" aria-modal="true" aria-labelledby="first-title"><button className="modal-close" onClick={close} aria-label="关闭提示">×</button><div className="modal-icon"><Icon name="alert" size={24} /></div><div className="eyebrow">先记住这三件事</div><h2 id="first-title">陌生链接都敢点？</h2><p>停一秒，往往就能避开一大步风险。</p><ul><li>看清域名，别只看网页长得像不像官方。</li><li>不要在陌生网页输入验证码。</li><li>涉及资金，去官方 App 或自己查到的电话二次核实。</li></ul><button className="button button-dark" onClick={close}>记住了，开始使用 <Icon name="arrow" size={17} /></button></section></div>
}

function Home() {
  const [text, setText] = useState('')
  const [allowRemote, setAllowRemote] = useState(false)
  const navigate = useNavigate()
  function submit(event: FormEvent) { event.preventDefault(); navigate('/result', { state: { text: text.trim(), allowRemote } }) }
  return <main><section className="hero page-shell"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> 一个帮你理清风险的地方</div><h1>有件事情<br /><em>感觉不太对？</em></h1><p className="hero-lead">把经过说出来。我们帮你找出值得警惕的信号，<br className="desktop-break" />更重要的是，告诉你现在可以做什么。</p><form className="analyze-card" onSubmit={submit}><label htmlFor="experience" className="form-label">你遇到了什么？</label><textarea id="experience" value={text} onChange={e => setText(e.target.value)} placeholder="描述一下发生了什么……例如：对方说有兼职机会，要我先办理培训分期。" rows={5} maxLength={3000} />{activeAiService.remote && <label className="consent-label"><input type="checkbox" checked={allowRemote} onChange={e => setAllowRemote(e.target.checked)} />同意将描述发送至 {activeAiService.destination || 'AI 服务'}；不勾选仍可使用本地判断</label>}<div className="analyze-footer"><span>{activeAiService.remote ? '不需要注册 · 不勾选时仅在本机判断' : '不需要注册 · 不会上传你的描述'}</span><button className="button button-dark" type="submit">开始判断 <Icon name="arrow" size={18} /></button></div></form><div className="quick-title">或者，从这里开始 <span>↘</span></div><div className="quick-grid">{quickLinks.map(item => <Link key={item.label} to={item.to} className="quick-card"><span className="quick-icon">{item.icon}</span><strong>{item.label}</strong><small>{item.detail}</small></Link>)}</div></div><div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-card art-card-top"><span className="art-dot" /> 先停一步</div><div className="art-core"><div className="art-core-inner"><Icon name="spark" size={50} /></div></div><div className="art-card art-card-bottom"><span className="art-line" /><span>看清信号<br /><b>再做决定</b></span></div><span className="art-tiny one">01 / 03</span><span className="art-tiny two">CLARITY BEFORE ACTION</span></div></section><section className="home-bottom page-shell"><div><div className="eyebrow">HOW IT WORKS</div><h2>先看清，再行动。</h2></div><div className="steps"><div><span>01</span><strong>描述经历</strong><p>写下对方说了什么、让你做什么。</p></div><div><span>02</span><strong>识别信号</strong><p>基于公开可解释的组合规则提示风险。</p></div><div><span>03</span><strong>采取行动</strong><p>先给你当下能执行的具体步骤。</p></div></div></section></main>
}

const levelClass: Record<RiskLevel, string> = { 信息不足: 'neutral', 需要注意: 'watch', 高风险: 'high', 紧急: 'urgent' }
function Result() {
  const location = useLocation()
  const navigate = useNavigate()
  const text = typeof location.state?.text === 'string' ? location.state.text : ''
  const allowRemote = Boolean(location.state?.allowRemote)
  const [result, setResult] = useState<RiskAssessment | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setResult(null)
    analyzeExperience(text, activeAiService, allowRemote).then(value => { if (active) setResult(value) }).catch(() => { if (active) setError('分析暂时失败，请返回首页重试。') })
    return () => { active = false }
  }, [text, allowRemote])
  function save() {
    if (!result) return
    try { const record = saveCase(createCase(text, result)); navigate(`/my-cases/${record.id}`) }
    catch { setError('保存失败。请检查浏览器本地存储，或空间是否已满。') }
  }
  if (error && !result) return <main className="page-shell result-page"><p role="alert">{error}</p><Link to="/">返回首页 ↗</Link></main>
  if (!result) return <main className="page-shell result-page"><p role="status">正在整理线索……</p></main>
  const graphUrl = `/graph?nodes=${encodeURIComponent(result.graphNodes.join(','))}`
  return <main className="page-shell result-page"><button className="text-back" onClick={() => navigate('/')}>← 返回首页</button><div className="eyebrow">初步判断 / {result.claimType} · {result.source === 'ai' ? 'AI 辅助分析' : result.source === 'local-fallback' ? '本地规则（服务暂不可用）' : result.source === 'local-only' ? '本地规则（未授权发送）' : '本地规则 + AI 接口模拟'}</div><div className="result-header"><div><h1>先处理眼前的事。</h1><p>这是一份基于描述的风险提示，不是对任何个人或商家的定性。{result.source !== 'ai' && '当前未调用外部 AI。'}</p></div><div className={`risk-badge ${levelClass[result.level]}`}><span className="status-dot" />{result.level}</div></div><div className="result-grid"><section className="action-panel"><div className="panel-index">01 / 现在先做什么</div><h2>{result.priorityAction}</h2><ol className="action-list">{result.actions.slice(1).map((action, i) => <li key={action}><span>{String(i + 2).padStart(2, '0')}</span><p>{action}</p></li>)}</ol>{result.level === '紧急' && <Link to={`/emergency?stage=${encodeURIComponent(result.stage)}`} className="button button-light">打开紧急处理清单 <Icon name="arrow" size={17} /></Link>}</section><section className="reason-panel"><div className="panel-index">02 / 为什么这样提示</div><h2>判断依据</h2>{result.signals.length > 0 && <div className="signal-list">{result.signals.map(signal => <span key={signal}>{signal}</span>)}</div>}{result.reasons.map(reason => <p className="reason-item" key={reason}>{reason}</p>)}<p className="record-help">当前阶段：{result.stage}</p><p className="record-help">可能相关：{result.possiblePatterns.length ? result.possiblePatterns.join('、') : '无法判断具体套路'}</p><div className="reason-note">还需了解：{result.missingInfo.length ? result.missingInfo.join('；') : '暂无'}。规则提示不能替代核实、专业意见或报案。</div></section></div><div className="result-save"><button className="button button-dark" onClick={save}>保存为案件 ↗</button><Link className="record-link" to={graphUrl}>在骗局图谱中查看我的情况 ↗</Link>{error && <span role="alert">{error}</span>}</div><section className="related-section"><div className="section-heading"><div><div className="eyebrow">KEEP EXPLORING</div><h2>可能相关的套路</h2></div><Link to="/cases">查看全部案例 <span>↗</span></Link></div>{result.caseIds.length ? <div className="case-mini-grid">{cases.filter(item => result.caseIds.includes(item.id)).slice(0, 3).map(item => <Link to={`/cases/${item.id}`} key={item.id} className="case-mini"><span>{item.category} · {sourceLabel(item)}</span><h3>{item.title}</h3><p>{item.summary}</p><b>了解路径 ↗</b></Link>)}</div> : <p className="record-empty">描述中的线索还不足以匹配具体案例。可以补充信息后再次判断。</p>}</section></main>
}

function Emergency() {
  const query = new URLSearchParams(useLocation().search)
  const [selected, setSelected] = useState(query.get('type') || '')
  const [stage, setStage] = useState<EventStage>(() => isEventStage(query.get('stage')) ? query.get('stage') as EventStage : '阶段未知')
  const [checked, setChecked] = useState<number[]>([])
  const current = emergencyOptions.find(item => item.id === selected)
  const steps = current ? [...new Set([stageEmergencyStep[stage], ...current.steps].filter((item): item is string => Boolean(item)))] : []
  return <main className="emergency-page"><div className="page-shell emergency-shell"><div className="emergency-top"><div className="eyebrow">立即处理 / ACTION MODE</div><h1>先停止操作，<br />再判断。</h1><p>选最接近你当前情况的一项。先做完眼前能做的步骤。</p></div><div className="emergency-layout"><div><h2>现在发生了什么？</h2><label className="emergency-stage">当前阶段<select value={stage} onChange={e => { setStage(e.target.value as EventStage); setChecked([]) }}>{eventStages.map(item => <option key={item}>{item}</option>)}</select></label><div className="emergency-options">{emergencyOptions.map(item => <button key={item.id} className={selected === item.id ? 'selected' : ''} onClick={() => { setSelected(item.id); setChecked([]) }}>{item.title}<span>↗</span></button>)}</div></div><section className="emergency-checklist"><div className="panel-index">当前行动清单</div>{current ? <><h2>{current.title}</h2><div className="check-items">{steps.map((step, index) => <label key={step} className={checked.includes(index) ? 'checked' : ''}><input type="checkbox" checked={checked.includes(index)} onChange={() => setChecked(old => old.includes(index) ? old.filter(i => i !== index) : [...old, index])} /><span className="check-box" /><span>{step}</span></label>)}</div><p className="emergency-foot">先保留证据，不要删除聊天和交易记录。</p></> : <div className="empty-emergency"><Icon name="shield" size={32} /><p>选择左侧情况，查看对应步骤。</p></div>}</section></div></div></main>
}

function Cases() {
  const [filter, setFilter] = useState('全部')
  const groups = ['全部', ...new Set(cases.map(item => item.category))]
  const shown = filter === '全部' ? cases : cases.filter(item => item.category === filter)
  return <main className="page-shell cases-page"><div className="eyebrow">CASE LIBRARY / 案例库</div><div className="page-heading"><div><h1>看看这些<br />常见的路径。</h1><p>不靠名字判断，重点看对方的要求、支付方式和退出条件。</p></div><span className="page-count">{cases.length} 个典型情境</span></div><div className="filter-row" aria-label="筛选案例">{groups.map(group => <button key={group} className={filter === group ? 'active' : ''} onClick={() => setFilter(group)}>{group}</button>)}</div><div className="cases-grid">{shown.map((item, index) => <Link className="case-card" to={`/cases/${item.id}`} key={item.id}><div className="case-card-top"><span>{item.category} · {sourceLabel(item)}</span><span>{String(index + 1).padStart(2, '0')}</span></div><h2>{item.title}</h2><p>{item.summary}</p><div className="case-card-bottom"><span>{item.nodes.slice(0, 2).join(' / ')}</span><b>↗</b></div></Link>)}</div></main>
}

function CaseDetail() {
  const { id } = useParams()
  const item = cases.find(entry => entry.id === id)
  if (!item) return <main className="page-shell not-found"><h1>没有找到这个案例</h1><Link to="/cases">返回案例库 ↗</Link></main>
  return <main className="page-shell case-detail"><Link className="text-back" to="/cases">← 返回案例库</Link><div className="eyebrow">案例解析 / {item.category} · {sourceLabel(item)}</div><h1>{item.title}</h1><p className="case-intro">{item.summary}</p><div className="detail-grid"><section className="detail-main"><div className="panel-index">01 / 常见路径</div><div className="path-list">{item.path.map((step, index) => <div key={step}><span>{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong></div>)}</div><div className="panel-index">02 / 危险信号</div><ul className="danger-list">{item.signals.map(signal => <li key={signal}>{signal}</li>)}</ul></section><aside className="detail-side"><div className="advice-box"><div className="panel-index">现在怎么办</div><p>{item.now}</p></div><div className="advice-box pale"><div className="panel-index">已经付款怎么办</div><p>{item.paid}</p></div><div className="panel-index">相关图谱节点</div><div className="node-tags">{item.nodes.map(node => <Link to="/graph" key={node}>{node} ↗</Link>)}</div></aside></div><p className="case-disclaimer">这些案例是常见行为模式，不代表某个具体商家或个人被认定为诈骗。</p></main>
}

function SubmitCase() {
  const [form, setForm] = useState({ platform: '', contact: '', story: '', paid: '', amount: '', outcome: '' })
  const [message, setMessage] = useState(() => readSubmissions().error || '')
  const [saved, setSaved] = useState<Submission[]>(() => readSubmissions().records)
  function update(key: keyof typeof form, value: string) { setForm(current => ({ ...current, [key]: value })) }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (form.story.trim().length < 20) { setMessage('请至少用 20 个字说明经过。'); return }
    if (form.paid === '是' && form.amount && (Number(form.amount) < 0 || !Number.isFinite(Number(form.amount)))) { setMessage('请输入有效金额。'); return }
    const now = new Date().toISOString()
    const entry: Submission = { ...form, id: crypto.randomUUID(), createdAt: now, updatedAt: now, sourceType: '用户投稿', sourceUrl: '', verificationStatus: '未验证', structured: structureSubmission(form) }
    // 当前仅本机保存：读旧记录、追加并一次写入；失败时明确提示，避免误称已投稿。
    try { const current = readSubmissions(); if (current.error) throw Error(current.error); const next = [entry, ...current.records]; localStorage.setItem(SUBMISSION_STORAGE_KEY, JSON.stringify(next)); setSaved(next); setForm({ platform: '', contact: '', story: '', paid: '', amount: '', outcome: '' }); setMessage('已保存到本设备。请自行备份重要证据。') } catch { setMessage('保存失败：本地数据可能损坏、存储被禁用或空间已满。请先备份原始数据。') }
  }
  function remove(id: string) { try { const current = readSubmissions(); if (current.error) throw Error(current.error); const next = current.records.filter(item => item.id !== id); localStorage.setItem(SUBMISSION_STORAGE_KEY, JSON.stringify(next)); setSaved(next) } catch { setMessage('删除失败，请先检查或备份本地数据。') } }
  return <main className="page-shell submit-page"><div className="eyebrow">SHARE A CASE / 提交案例</div><div className="page-heading"><div><h1>你的经历，<br />也许能帮别人停下。</h1><p>写下发生的事，帮助我们了解新的套路与变化。</p></div></div><div className="submit-layout"><form onSubmit={submit} className="submit-form"><div className="form-row"><label>发生平台<input value={form.platform} onChange={e => update('platform', e.target.value)} placeholder="例如：某交易平台 / 线下门店" maxLength={100} required /></label><label>联系方式<input value={form.contact} onChange={e => update('contact', e.target.value)} placeholder="对方账号或联系方式（可选）" maxLength={150} /></label></div><label>事情经过 <span className="required">*</span><textarea value={form.story} onChange={e => update('story', e.target.value)} placeholder="从哪里接触到对方？对方让你做了什么？" rows={7} maxLength={3000} required /></label><div className="form-row"><label>是否付款<select value={form.paid} onChange={e => update('paid', e.target.value)} required><option value="">请选择</option><option>否</option><option>是</option></select></label><label>金额（元）<input type="number" min="0" step="0.01" value={form.amount} onChange={e => update('amount', e.target.value)} placeholder="如未付款可留空" /></label></div><label>最终结果<input value={form.outcome} onChange={e => update('outcome', e.target.value)} placeholder="例如：未付款 / 已退款 / 仍在沟通" maxLength={200} /></label><div className="submit-actions"><span>请勿填写身份证号、银行卡号、验证码、家庭地址等敏感信息。</span><button className="button button-dark" type="submit">保存案例 <Icon name="arrow" size={17} /></button></div>{message && <p className="form-message" role="status">{message}</p>}</form><aside className="submit-side"><div className="side-icon"><Icon name="shield" size={25} /></div><h2>先保护好自己。</h2><p>当前测试版仅保存在本设备。内容不会上传，也不会公开展示；清理浏览器数据可能使记录丢失。</p><div className="side-divider" /><strong>提交前请检查</strong><ul><li>不要粘贴完整证件或银行卡信息</li><li>涉及他人隐私时请先删去细节</li><li>重要原始证据请自行保留</li></ul></aside></div>{saved.length > 0 && <section className="saved-section"><div className="section-heading"><div><div className="eyebrow">ONLY ON THIS DEVICE</div><h2>本设备保存的案例</h2></div><span>{saved.length} 条</span></div><div className="saved-list">{saved.map(item => { const structured = item.structured || structureSubmission(item); return <div key={item.id}><div><strong>{item.platform}</strong><small className="source-caption">{sourceLabel(item)}</small><p>{item.story}</p><div className="submission-structure"><span>诱饵：{structured.lure}</span><span>身份：{structured.claimedIdentity}</span><span>承诺：{structured.promise}</span><span>要求：{structured.requestedAction}</span><span>支付：{structured.payment}</span><span>退出障碍：{structured.exitBarrier}</span><span>图谱：{structured.graphNodes.join('、') || '待补充'}</span></div></div><button onClick={() => remove(item.id)} aria-label={`删除 ${item.platform} 的记录`}>删除</button></div> })}</div></section>}</main>
}

function Footer() { return <footer className="site-footer"><div className="page-shell footer-inner"><div className="brand"><span className="brand-mark"><Icon name="shield" size={17} /></span>识间<span className="brand-dot">.</span></div><p>看清套路，稳住下一步。</p><span>测试版 · 规则提示仅供参考</span></div></footer> }

export default function App() { return <><Header /><Suspense fallback={<main className="page-shell result-page">正在打开图谱……</main>}><Routes><Route path="/" element={<Home />} /><Route path="/result" element={<Result />} /><Route path="/graph" element={<GraphPage />} /><Route path="/emergency" element={<Emergency />} /><Route path="/cases" element={<Cases />} /><Route path="/cases/:id" element={<CaseDetail />} /><Route path="/my-cases" element={<CaseList />} /><Route path="/my-cases/:id" element={<CaseRecordPage />} /><Route path="/submit" element={<SubmitCase />} /><Route path="*" element={<main className="page-shell not-found"><h1>页面走丢了</h1><Link to="/">返回首页 ↗</Link></main>} /></Routes></Suspense><Footer /><FirstVisit /></> }
