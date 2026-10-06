import assert from 'node:assert/strict'
import { analyzeExperience } from './riskService.ts'
import { CASE_STORAGE_KEY, createCase, deleteCase, loadCases, readCases, saveCase, suggestedActions } from './caseStore.ts'
import { readSubmissions, structureSubmission, SUBMISSION_STORAGE_KEY } from './submission.ts'
import { clearLocalData, exportBackup, exportRawBackup, parseBackup, restoreBackup } from './backup.ts'

const memory = new Map<string, string>()
let failWriteKey = ''
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { if (key === failWriteKey) throw Error('storage full'); memory.set(key, value) },
  removeItem: (key: string) => { memory.delete(key) },
} })

const description = '小红书看到兼职，承诺高收益，推荐培训课程并让我办理分期，后来提出退款'
const result = await analyzeExperience(description)
assert.equal(result.level, '高风险')
assert.equal(result.stage, '正在维权')
assert.ok(result.graphNodes.includes('培训销售'))
assert.ok(result.missingInfo.length >= 0)
assert.equal((await analyzeExperience(description, { analyze: async () => { throw Error('offline') } })).source, 'local-fallback')
let remoteCalls = 0
const remote = { remote: true, destination: '测试服务', analyze: async () => { remoteCalls++; return {} } }
assert.equal((await analyzeExperience(description, remote)).source, 'local-only')
assert.equal(remoteCalls, 0)
assert.equal((await analyzeExperience(description, remote, true)).source, 'ai')
assert.equal(remoteCalls, 1)
assert.equal((await analyzeExperience(description, { remote: true, analyze: async () => { remoteCalls++; return {} } }, true)).source, 'local-only')
assert.equal(remoteCalls, 1)
const uncertain = await analyzeExperience(description, { analyze: async () => ({ level: '信息不足', reasons: [] }) })
assert.ok(uncertain.reasons[0].includes('暂时无法判断'))
assert.equal(uncertain.caseIds.length, 0)

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

memory.set(CASE_STORAGE_KEY, JSON.stringify([{ ...record, stage: '已付款或签约', amount: '', analysis: { ...record.analysis, stage: '退款或退出中' } }]))
assert.equal(loadCases()[0].stage, '被要求操作')
assert.equal(loadCases()[0].sourceType, '用户投稿')
memory.set(CASE_STORAGE_KEY, '{broken')
assert.ok(readCases().error)
assert.throws(() => saveCase(record))
assert.equal(memory.get(CASE_STORAGE_KEY), '{broken')
assert.ok(exportRawBackup().includes('{broken'))
memory.set(CASE_STORAGE_KEY, JSON.stringify([{ ...record, timeline: [null] }]))
assert.ok(readCases().error)
memory.set(CASE_STORAGE_KEY, JSON.stringify([{ ...record, timeline: { bad: true } }]))
assert.ok(readCases().error)

memory.set(CASE_STORAGE_KEY, JSON.stringify([record]))
memory.set(SUBMISSION_STORAGE_KEY, JSON.stringify([{ id: 'old-post', platform: '小红书', story: description, paid: '是', amount: '3000', outcome: '协商中', createdAt: '2026-10-05T00:00:00.000Z' }]))
const backup = exportBackup()
assert.equal(readSubmissions().records[0].sourceType, '用户投稿')
const originalCases = memory.get(CASE_STORAGE_KEY)
const originalSubmissions = memory.get(SUBMISSION_STORAGE_KEY)
failWriteKey = SUBMISSION_STORAGE_KEY
assert.throws(() => restoreBackup(backup))
failWriteKey = ''
assert.equal(memory.get(CASE_STORAGE_KEY), originalCases)
assert.equal(memory.get(SUBMISSION_STORAGE_KEY), originalSubmissions)
assert.throws(() => parseBackup('{bad'))
assert.throws(() => parseBackup(JSON.stringify({ format: 'shijian-local-backup', version: 2, cases: [{ bad: true }], submissions: [] })))
assert.equal(parseBackup(JSON.stringify([{ ...record, sourceType: '官方', verificationStatus: '已核实' }])).cases[0].sourceType, '用户投稿')
clearLocalData()
assert.equal(loadCases().length, 0)
assert.equal(readSubmissions().records.length, 0)
restoreBackup(backup)
assert.equal(loadCases()[0].timeline[0].description, '看到兼职')
assert.equal(readSubmissions().records[0].structured.entryPlatform, '小红书')
console.log('阶段迁移、损坏数据保护、JSON 备份恢复和旧投稿检查通过')
