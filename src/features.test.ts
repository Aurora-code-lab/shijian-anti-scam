import assert from 'node:assert/strict'
import { analyzeExperience } from './riskService.ts'
import { createCase, deleteCase, loadCases, saveCase, suggestedActions } from './caseStore.ts'
import { structureSubmission } from './submission.ts'

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value) },
} })

const description = '小红书看到兼职，承诺高收益，推荐培训课程并让我办理分期，后来提出退款'
const result = await analyzeExperience(description)
assert.equal(result.level, '高风险')
assert.equal(result.stage, '退款或退出中')
assert.ok(result.graphNodes.includes('培训销售'))
assert.ok(result.missingInfo.length >= 0)
assert.equal((await analyzeExperience(description, { analyze: async () => { throw Error('offline') } })).source, 'local-fallback')
let remoteCalls = 0
const remote = { remote: true, destination: '测试服务', analyze: async () => { remoteCalls++; return {} } }
assert.equal((await analyzeExperience(description, remote)).source, 'local-only')
assert.equal(remoteCalls, 0)
assert.equal((await analyzeExperience(description, remote, true)).source, 'ai')
assert.equal(remoteCalls, 1)

let record = createCase(description, result)
assert.ok(suggestedActions(result, record.stage).some(action => action.includes('分期合同')))
record = saveCase(record)
record = saveCase({ ...record, timeline: [{ id: 'one', occurredAt: '2026-10-05T12:00', description: '看到兼职' }], actions: record.actions.map((action, i) => i === 0 ? { ...action, done: true } : action), evidence: record.evidence.map(item => item.type === '合同' ? { ...item, status: '已备份' } : item), outcome: '部分退款' })
const restored = loadCases()[0]
assert.equal(restored.id, record.id)
assert.equal(restored.timeline[0].description, '看到兼职')
assert.equal(restored.actions[0].done, true)
assert.equal(restored.evidence.find(item => item.type === '合同')?.status, '已备份')
assert.equal(restored.outcome, '部分退款')
deleteCase(record.id)
assert.equal(loadCases().length, 0)

const structured = structureSubmission({ platform: '小红书', story: description, paid: '是', amount: '3000', outcome: '协商中' })
assert.equal(structured.entryPlatform, '小红书')
assert.equal(structured.requestedAction, '办理分期或贷款')
assert.equal(structured.loss, '已付款；实际损失待核实')
assert.ok(structured.graphNodes.includes('分期贷款'))
console.log('案件持久化、接口回退和投稿结构化检查通过')
