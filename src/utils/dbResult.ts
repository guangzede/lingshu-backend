type RecordLike = Record<string, unknown>

function toSafeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

/**
 * 兼容 D1 / Drizzle 不同版本返回结构，统一提取本次写操作影响行数。
 */
export function getAffectedRows(result: unknown): number {
  if (!result || typeof result !== 'object') {
    return 0
  }

  const raw = result as RecordLike
  const directCandidates = [raw.changes, raw.rowsAffected]
  for (const candidate of directCandidates) {
    const num = toSafeNumber(candidate)
    if (num !== null) {
      return num
    }
  }

  const meta = raw.meta
  if (!meta || typeof meta !== 'object') {
    return 0
  }

  const metaRecord = meta as RecordLike
  const metaCandidates = [
    metaRecord.changes,
    metaRecord.rows_written,
    metaRecord.rowsWritten,
    metaRecord.rows_affected
  ]

  for (const candidate of metaCandidates) {
    const num = toSafeNumber(candidate)
    if (num !== null) {
      return num
    }
  }

  return 0
}
