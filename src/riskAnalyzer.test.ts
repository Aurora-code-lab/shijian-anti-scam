import assert from 'node:assert/strict'
import { analyzeRisk } from './riskAnalyzer.ts'
import { cases } from './data/cases.ts'
import { graphItems, graphLinks } from './data/graph.ts'
import { sourceLabel } from './schema.ts'

assert.equal(analyzeRisk('兼职').level, '需要注意')
assert.equal(analyzeRisk('兼职赚钱，承诺高收益，要求培训并办理分期').level, '高风险')
assert.equal(analyzeRisk('我是客服，把验证码告诉我').level, '紧急')
assert.equal(analyzeRisk('我已经转账了').level, '紧急')
assert.equal(analyzeRisk('对方要我共享屏幕').level, '紧急')
assert.equal(analyzeRisk('').level, '信息不足')
assert.equal(analyzeRisk('').stage, '阶段未知')
assert.ok(analyzeRisk('').reasons[0].includes('暂时无法判断'))
assert.equal(analyzeRisk('我准备转账').stage, '即将付款')
assert.equal(analyzeRisk('我已经转账了').stage, '已付款')
assert.equal(analyzeRisk('已经申请退款').stage, '正在维权')
assert.equal(analyzeRisk('我已付款，退款成功，事情已解决').stage, '已结束')
assert.notEqual(analyzeRisk('我已付款，退款成功，事情已解决').level, '紧急')
const graphIds = new Set(graphItems.map(item => item.id))
assert.equal(graphItems.filter(item => item.kind === 'core').length, 10)
assert.equal(cases.length, 12)
assert.ok(graphLinks.every(([a, b]) => graphIds.has(a) && graphIds.has(b)))
assert.ok(cases.every(item => item.nodes.every(node => graphIds.has(node))))
assert.ok(cases.every(item => item.sourceType === '示例数据' && item.verificationStatus === '未验证' && typeof item.sourceUrl === 'string' && item.updatedAt))
assert.ok(graphItems.every(item => item.sourceType === '示例数据' && item.verificationStatus === '未验证' && typeof item.sourceUrl === 'string' && item.updatedAt))
assert.equal(sourceLabel(cases[0]), '示例数据 · 未验证')
const trainingPath = ['兼职赚钱', '收益承诺', '培训销售', '分期贷款', '退出困难']
assert.ok(trainingPath.every((node, i) => i === 0 || graphLinks.some(([a, b]) => a === trainingPath[i - 1] && b === node)))
console.log('风险规则与案例图谱检查通过')
