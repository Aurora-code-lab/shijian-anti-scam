import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { analyzeRisk } from './riskAnalyzer'
import { createCase, deleteCase, loadCases, outcomeOptions, riskOptions, saveCase, stageOptions, suggestedActions, type CaseRecord, type EvidenceStatus } from './caseStore'

const date = (value: string) => value ? new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '时间未记录'
const riskClass = { 信息不足: 'neutral', 需要注意: 'watch', 高风险: 'high', 紧急: 'urgent' }

export function CaseList() {
  const navigate = useNavigate()
  const [records, setRecords] = useState(loadCases)
  const [error, setError] = useState('')
  function add() {
    try {
      const record = saveCase(createCase('', { ...analyzeRisk(''), source: 'local-mock' }))
      setRecords(loadCases()); navigate(`/my-cases/${record.id}`)
    } catch { setError('创建失败。请检查浏览器是否允许本地存储，或空间是否已满。') }
  }
  return <main className="page-shell case-center"><div className="eyebrow">CASE CENTER / 案件中心</div><div className="page-heading"><div><h1>把事情整理清楚，<br />一步步处理。</h1><p>案件仅保存在本设备。把经过、证据和待办放在一起，随时继续。</p></div><button className="button button-dark" onClick={add}>新建案件 ↗</button></div>{error && <p className="form-message" role="alert">{error}</p>}{records.length ? <div className="case-list">{records.map(record => <Link to={`/my-cases/${record.id}`} className="case-list-card" key={record.id}><div><span className="eyebrow">{record.stage} · 更新于 {date(record.updatedAt)}</span><h2>{record.title || '未命名案件'}</h2><p>{record.description || '尚未填写事件描述。'}</p></div><div className="case-list-side"><span className={`risk-badge ${riskClass[record.riskLevel]}`}>{record.riskLevel}</span><small>{record.actions.filter(action => action.done).length}/{record.actions.length} 项行动已完成</small><b>查看案件 ↗</b></div></Link>)}</div> : <div className="case-empty"><h2>这里还没有案件</h2><p>描述经历并完成风险判断后可以保存，也可以直接新建一条记录。</p><button className="button button-dark" onClick={add}>新建案件 ↗</button></div>}</main>
}

export function CaseRecordPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [record, setRecord] = useState<CaseRecord | null>(() => loadCases().find(item => item.id === id) || null)
  const [error, setError] = useState('')
  const [newEvent, setNewEvent] = useState({ occurredAt: '', description: '' })
  const [customAction, setCustomAction] = useState('')
  if (!record) return <main className="page-shell not-found"><h1>没有找到这个案件</h1><Link to="/my-cases">返回案件中心 ↗</Link></main>

  function persist(next: CaseRecord) {
    try {
      const previous = loadCases().find(item => item.id === next.id)
      // 描述改动后更新图谱线索；用户手动选择的风险等级和阶段仍以案件字段为准。
      const updated = previous?.description !== next.description ? { ...next, analysis: { ...analyzeRisk(next.description), source: 'local-mock' as const } } : next
      setRecord(saveCase(updated)); setError(''); return true
    }
    catch { setError('保存失败。请检查浏览器本地存储，当前改动可能未保留。'); return false }
  }
  function field<K extends keyof CaseRecord>(key: K, value: CaseRecord[K]) { setRecord({ ...record!, [key]: value }) }
  function addEvent(event: FormEvent) {
    event.preventDefault()
    if (!newEvent.description.trim()) return
    if (persist({ ...record!, timeline: [...record!.timeline, { id: crypto.randomUUID(), occurredAt: newEvent.occurredAt, description: newEvent.description.trim() }] })) setNewEvent({ occurredAt: '', description: '' })
  }
  function remove() {
    if (!window.confirm('确定删除这个案件？本设备中的记录将无法恢复。')) return
    try { deleteCase(record!.id); navigate('/my-cases') }
    catch { setError('删除失败，请检查浏览器本地存储。') }
  }
  const graphUrl = `/graph?case=${encodeURIComponent(record.id)}`
  const completed = record.actions.filter(item => item.done).length
  return <main className="page-shell case-center case-record"><Link className="text-back" to="/my-cases">← 返回案件中心</Link><div className="record-header"><div><div className="eyebrow">CASE FILE / 创建于 {date(record.createdAt)}</div><h1>{record.title || '未命名案件'}</h1><p>最近更新：{date(record.updatedAt)} · 仅保存在本设备</p></div><span className={`risk-badge ${riskClass[record.riskLevel]}`}>{record.riskLevel}</span></div>{error && <p className="form-message" role="alert">{error}</p>}
    <div className="record-layout"><div className="record-main"><section className="record-panel"><div className="section-heading"><h2>事件概况</h2><span className="muted">可随时补充和修改</span></div><div className="record-fields"><label>案件标题<input value={record.title} maxLength={100} onChange={e => field('title', e.target.value)} /></label><label>事件描述<textarea value={record.description} rows={6} maxLength={3000} onChange={e => field('description', e.target.value)} /></label><div className="form-row"><label>平台 / 场景<input value={record.platform} maxLength={100} onChange={e => field('platform', e.target.value)} placeholder="例如：小红书、线下门店" /></label><label>涉及金额（元）<input type="number" min="0" step="0.01" value={record.amount} onChange={e => field('amount', e.target.value)} placeholder="未付款可留空" /></label></div><div className="form-row"><label>当前风险等级<select value={record.riskLevel} onChange={e => field('riskLevel', e.target.value as CaseRecord['riskLevel'])}>{riskOptions.map(item => <option key={item}>{item}</option>)}</select></label><label>当前阶段<select value={record.stage} onChange={e => field('stage', e.target.value as CaseRecord['stage'])}>{stageOptions.map(item => <option key={item}>{item}</option>)}</select></label></div><label>对方行为<textarea value={record.behaviors} rows={3} maxLength={1000} onChange={e => field('behaviors', e.target.value)} placeholder="对方说了什么、要求你做什么" /></label><label>已采取措施<textarea value={record.measures} rows={3} maxLength={1000} onChange={e => field('measures', e.target.value)} placeholder="已停止付款、已联系平台等" /></label></div><div className="record-actions"><button className="button button-dark" onClick={() => persist(record)}>保存修改</button><Link to={graphUrl} className="record-link">在骗局图谱中查看我的情况 ↗</Link></div></section>
      <section className="record-panel"><div className="section-heading"><div><div className="eyebrow">EVENT TIMELINE</div><h2>事件时间线</h2></div></div><p className="record-help">按发生顺序记录关键动作，时间可留空。修改节点后点击“保存时间线”。</p>{record.timeline.length ? <div className="timeline-list">{record.timeline.map((item, index) => <div className="timeline-entry" key={item.id}><span className="timeline-number">{String(index + 1).padStart(2, '0')}</span><div className="timeline-inputs"><input type="datetime-local" value={item.occurredAt} aria-label={`节点 ${index + 1} 的时间`} onChange={e => field('timeline', record.timeline.map(entry => entry.id === item.id ? { ...entry, occurredAt: e.target.value } : entry))} /><textarea value={item.description} rows={2} maxLength={500} aria-label={`节点 ${index + 1} 的描述`} onChange={e => field('timeline', record.timeline.map(entry => entry.id === item.id ? { ...entry, description: e.target.value } : entry))} /></div><button className="subtle-danger" onClick={() => persist({ ...record, timeline: record.timeline.filter(entry => entry.id !== item.id) })}>删除</button></div>)}</div> : <p className="record-empty">还没有时间线节点。先记录第一件发生的事。</p>}<form className="timeline-add" onSubmit={addEvent}><input type="datetime-local" value={newEvent.occurredAt} aria-label="新节点时间" onChange={e => setNewEvent({ ...newEvent, occurredAt: e.target.value })} /><input value={newEvent.description} maxLength={500} placeholder="例如：看到兼职广告并加了对方微信" aria-label="新节点描述" onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} /><button type="submit">添加节点</button></form><button className="record-secondary" onClick={() => persist(record)}>保存时间线</button></section>
      <section className="record-panel"><div className="section-heading"><div><div className="eyebrow">EVIDENCE CHECK</div><h2>证据清单</h2></div></div><p className="evidence-warning">请保留未经修改的原始证据；上传网站前自行遮挡无关个人信息。</p><div className="evidence-list">{record.evidence.map((item, index) => <div key={item.type}><strong>{item.type}</strong><select aria-label={`${item.type}状态`} value={item.status} onChange={e => persist({ ...record, evidence: record.evidence.map((evidence, i) => i === index ? { ...evidence, status: e.target.value as EvidenceStatus } : evidence) })}><option>未收集</option><option>已保存</option><option>已备份</option></select><input value={item.note} placeholder="备注（可选）" maxLength={200} aria-label={`${item.type}备注`} onChange={e => field('evidence', record.evidence.map((evidence, i) => i === index ? { ...evidence, note: e.target.value } : evidence))} /></div>)}</div><button className="record-secondary" onClick={() => persist(record)}>保存证据备注</button></section></div>
      <aside className="record-aside"><section className="record-panel"><div className="eyebrow">NEXT STEPS</div><h2>待完成行动</h2><p className="record-help">{completed}/{record.actions.length} 项已完成。勾选后立即保存在本设备。</p><div className="record-checklist">{record.actions.map(action => <label key={action.id} className={action.done ? 'done' : ''}><input type="checkbox" checked={action.done} onChange={() => persist({ ...record, actions: record.actions.map(item => item.id === action.id ? { ...item, done: !item.done } : item) })} /><span>{action.text}</span></label>)}</div><button className="record-secondary" onClick={() => { const existing = new Set(record.actions.map(item => item.text)); const additions = suggestedActions(record.analysis, record.stage).filter(text => !existing.has(text)).map(text => ({ id: crypto.randomUUID(), text, done: false })); persist({ ...record, actions: [...record.actions, ...additions] }) }}>按当前阶段补充建议</button><div className="timeline-add"><input placeholder="自定义待办" maxLength={200} aria-label="自定义待办" value={customAction} onChange={e => setCustomAction(e.target.value)} /><button onClick={() => { const text = customAction.trim(); if (text && persist({ ...record, actions: [...record.actions, { id: crypto.randomUUID(), text, done: false }] })) setCustomAction('') }}>添加</button></div></section><section className="record-panel"><div className="eyebrow">OUTCOME</div><h2>后来怎么样了？</h2><label className="record-outcome">处理结果<select value={record.outcome} onChange={e => persist({ ...record, outcome: e.target.value as CaseRecord['outcome'] })}>{outcomeOptions.map(item => <option key={item}>{item}</option>)}</select></label><p className="record-help">结果是独立字段，方便以后整理有效的处理经验。</p></section><button className="subtle-danger record-delete" onClick={remove}>删除这个案件</button></aside></div>
  </main>
}
