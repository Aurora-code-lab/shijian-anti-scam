import { CASE_STORAGE_KEY, normalizeCase, readCases } from './caseStore.ts'
import { normalizeSubmission, readSubmissions, SUBMISSION_STORAGE_KEY } from './submission.ts'
import type { CaseRecord, Submission } from './schema.ts'

type Backup = { format: 'shijian-local-backup'; version: 2; exportedAt: string; cases: CaseRecord[]; submissions: Submission[] }
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

export function exportBackup(): string {
  const cases = readCases(); const submissions = readSubmissions()
  if (cases.error || submissions.error) throw Error(cases.error || submissions.error || '本地数据无法读取')
  return JSON.stringify({ format: 'shijian-local-backup', version: 2, exportedAt: new Date().toISOString(), cases: cases.records, submissions: submissions.records } satisfies Backup, null, 2)
}

export function exportRawBackup(): string {
  // 损坏数据不做解析，保留原始文本供手工修复；不能把“空数组”误当完整备份。
  return JSON.stringify({ format: 'shijian-raw-backup', exportedAt: new Date().toISOString(), rawCases: localStorage.getItem(CASE_STORAGE_KEY), rawSubmissions: localStorage.getItem(SUBMISSION_STORAGE_KEY) }, null, 2)
}

export function parseBackup(text: string): { cases: CaseRecord[]; submissions: Submission[] | null } {
  let value: unknown
  try { value = JSON.parse(text) } catch { throw Error('文件不是有效的 JSON。') }
  // 兼容简单的旧版案件数组；这类文件不改动现有投稿。
  const caseData = Array.isArray(value) ? value : isObject(value) && value.format === 'shijian-local-backup' && value.version === 2 ? value.cases : null
  const submissionData = Array.isArray(value) ? null : isObject(value) ? value.submissions : null
  if (!Array.isArray(caseData) || (submissionData !== null && !Array.isArray(submissionData))) throw Error('备份格式不受支持。')
  const cases = caseData.map(normalizeCase)
  const submissions = submissionData?.map(normalizeSubmission) ?? null
  if (cases.some(item => !item) || submissions?.some(item => !item)) throw Error('备份中有不完整记录，未修改本机数据。')
  const validCases = cases as CaseRecord[]
  const validSubmissions = submissions as Submission[] | null
  if (new Set(validCases.map(item => item.id)).size !== validCases.length || validSubmissions && new Set(validSubmissions.map(item => item.id)).size !== validSubmissions.length) throw Error('备份中有重复编号，未修改本机数据。')
  return { cases: validCases, submissions: validSubmissions }
}

function commitChanges(cases: string | null, submissions: string | null) {
  const beforeCases = localStorage.getItem(CASE_STORAGE_KEY)
  const beforeSubmissions = localStorage.getItem(SUBMISSION_STORAGE_KEY)
  const write = (key: string, value: string | null) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value)
  try { write(CASE_STORAGE_KEY, cases); write(SUBMISSION_STORAGE_KEY, submissions) }
  catch (error) {
    // localStorage 没有事务；第二次写入失败时尽量恢复两项旧值。
    try { write(CASE_STORAGE_KEY, beforeCases); write(SUBMISSION_STORAGE_KEY, beforeSubmissions) } catch { throw Error('写入失败且回滚失败，请立即检查本地数据。') }
    throw error
  }
}

export function restoreBackup(text: string): { caseCount: number; submissionCount: number | null } {
  const parsed = parseBackup(text)
  const submissions = parsed.submissions === null ? localStorage.getItem(SUBMISSION_STORAGE_KEY) : JSON.stringify(parsed.submissions)
  commitChanges(JSON.stringify(parsed.cases), submissions)
  return { caseCount: parsed.cases.length, submissionCount: parsed.submissions?.length ?? null }
}

export function clearLocalData(): void { commitChanges(null, null) }
