import assert from 'node:assert/strict'
import { analyzeRisk } from './riskAnalyzer.ts'
import { cases } from './data/cases.ts'
import { graphItems, graphLinks } from './data/graph.ts'

assert.equal(analyzeRisk('兼职').level, '需要注意')
assert.equal(analyzeRisk('兼职赚钱，承诺高收益，要求培训并办理分期').level, '高风险')
assert.equal(analyzeRisk('我是客服，把验证码告诉我').level, '紧急')
assert.equal(analyzeRisk('我已经转账了').level, '紧急')
assert.equal(analyzeRisk('对方要我共享屏幕').level, '紧急')
assert.equal(analyzeRisk('').level, '信息不足')
const graphIds = new Set(graphItems.map(item => item.id))
assert.equal(graphItems.filter(item => item.kind === 'core').length, 10)
assert.equal(cases.length, 12)
assert.ok(graphLinks.every(([a, b]) => graphIds.has(a) && graphIds.has(b)))
assert.ok(cases.every(item => item.nodes.every(node => graphIds.has(node))))
console.log('风险规则与案例图谱检查通过')
