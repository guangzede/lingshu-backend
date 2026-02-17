import { BRANCH_WUXING, STEM_WUXING, WUXING_CN } from '@/services/ganzhi/constants'
import type { Branch, Stem } from '@/types/liuyao'
import type { StockKlinePoint, StockPredictionResult, StockQuote } from './types'

const STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const BRANCHES: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

const STEM_SCORE: Record<Stem, number> = {
  甲: 0.012,
  乙: 0.008,
  丙: 0.018,
  丁: 0.011,
  戊: 0.004,
  己: -0.002,
  庚: -0.009,
  辛: -0.005,
  壬: 0.006,
  癸: 0.003
}

const BRANCH_SCORE: Record<Branch, number> = {
  子: 0.009,
  丑: -0.004,
  寅: 0.012,
  卯: 0.01,
  辰: 0.002,
  巳: 0.008,
  午: 0.011,
  未: -0.003,
  申: -0.007,
  酉: -0.008,
  戌: -0.002,
  亥: 0.006
}

type WuXing = 'wood' | 'fire' | 'earth' | 'metal' | 'water'

const WUXING_STOCK_BIAS: Record<WuXing, number> = {
  wood: 0.012,
  fire: 0.01,
  earth: 0.002,
  metal: -0.006,
  water: 0.004
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function avg(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((sum, n) => sum + n, 0) / values.length
}

function std(values: number[]): number {
  if (!values.length) return 0
  const m = avg(values)
  const variance = avg(values.map((x) => (x - m) ** 2))
  return Math.sqrt(variance)
}

export function parseGanZhi(value: string): { stem: Stem; branch: Branch } | null {
  const text = value.replace(/\s+/g, '')
  const stem = STEMS.find((item) => text.includes(item))
  const branch = BRANCHES.find((item) => text.includes(item))
  if (!stem || !branch) return null
  return { stem, branch }
}

function buildReturns(kline: StockKlinePoint[]): number[] {
  const closes = kline.map((row) => row.close).filter((n) => Number.isFinite(n) && n > 0)
  const returns: number[] = []
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1]
    const curr = closes[i]
    returns.push((curr - prev) / prev)
  }
  return returns
}

function computeVolumeBias(kline: StockKlinePoint[]): number {
  const vols = kline
    .map((row) => row.volume || 0)
    .filter((n) => Number.isFinite(n) && n > 0)
  if (vols.length < 10) return 0
  const recent = avg(vols.slice(-5))
  const base = avg(vols.slice(-20, -5))
  if (base <= 0) return 0
  const ratio = recent / base
  return clamp((ratio - 1) * 0.06, -0.04, 0.04)
}

function computeGanZhiBias(stem: Stem, branch: Branch): number {
  const stemBase = STEM_SCORE[stem]
  const branchBase = BRANCH_SCORE[branch]
  const stemWx = STEM_WUXING[stem]
  const branchWx = BRANCH_WUXING[branch]
  let synergy = 0

  if (stemWx === branchWx) {
    synergy += 0.006
  } else {
    const stemBias = WUXING_STOCK_BIAS[stemWx]
    const branchBias = WUXING_STOCK_BIAS[branchWx]
    synergy += (stemBias + branchBias) * 0.2
  }

  return clamp(stemBase + branchBase + synergy, -0.08, 0.08)
}

function buildSignals(input: {
  stem: Stem
  branch: Branch
  baseTrend: number
  momentum: number
  volatilityPenalty: number
  volumeBias: number
  ganZhiBias: number
  direction: 'up' | 'down'
}): string[] {
  const stemWx = STEM_WUXING[input.stem]
  const branchWx = BRANCH_WUXING[input.branch]
  const signals: string[] = []

  signals.push(`日干支为${input.stem}${input.branch}，干五行${WUXING_CN[stemWx]}、支五行${WUXING_CN[branchWx]}。`)

  if (input.baseTrend > 0) {
    signals.push('历史样本中上涨日占比偏高，基础趋势偏多。')
  } else {
    signals.push('历史样本中下跌日占比偏高，基础趋势偏空。')
  }

  if (input.momentum > 0.015) {
    signals.push('短周期动量高于中周期，短线资金有延续迹象。')
  } else if (input.momentum < -0.015) {
    signals.push('短周期动量弱于中周期，短线回撤风险偏高。')
  } else {
    signals.push('短中期动量接近中性，方向更多受外部因子驱动。')
  }

  if (input.volumeBias > 0.015) {
    signals.push('近期量能放大，方向信号可信度提升。')
  } else if (input.volumeBias < -0.015) {
    signals.push('近期量能收缩，信号强度需要打折。')
  }

  if (input.volatilityPenalty > 0.02) {
    signals.push('波动率偏高，建议控制仓位与止损阈值。')
  }

  signals.push(input.direction === 'up' ? '综合判定偏向上行。' : '综合判定偏向回落。')
  return signals
}

export function predictStockProbability(
  kline: StockKlinePoint[],
  quote: StockQuote,
  dayGanZhi: string
): StockPredictionResult {
  const parsed = parseGanZhi(dayGanZhi)
  if (!parsed) {
    throw new Error('dayGanZhi格式错误，应包含天干和地支，例如 甲子')
  }

  const returns = buildReturns(kline)
  if (returns.length < 20) {
    throw new Error('历史行情样本不足，无法完成预测')
  }

  const baseProb = returns.filter((r) => r > 0).length / returns.length
  const baseTrend = (baseProb - 0.5) * 0.9

  const recent5 = avg(returns.slice(-5))
  const recent20 = avg(returns.slice(-20))
  const momentum = clamp((recent5 - recent20) * 5, -0.12, 0.12)

  const recentStd = std(returns.slice(-20))
  const volatilityPenalty = clamp(Math.max(0, recentStd - 0.022) * 1.8, 0, 0.08)

  const volumeBias = computeVolumeBias(kline)
  const ganZhiBias = computeGanZhiBias(parsed.stem, parsed.branch)

  const signal =
    baseTrend +
    momentum +
    volumeBias +
    ganZhiBias -
    volatilityPenalty

  const upProbability = clamp(0.12, 0.88, 0.5 + signal)
  const direction: 'up' | 'down' = upProbability >= 0.5 ? 'up' : 'down'
  const downProbability = 1 - upProbability
  const expectedMovePct = clamp((momentum + ganZhiBias - volatilityPenalty) * 100, -8.5, 8.5)
  const confidence = Math.round(
    clamp(
      0,
      100,
      (Math.abs(upProbability - 0.5) * 2) * 65 +
      clamp(returns.length / 140, 0, 1) * 35
    )
  )

  const signals = buildSignals({
    stem: parsed.stem,
    branch: parsed.branch,
    baseTrend,
    momentum,
    volatilityPenalty,
    volumeBias,
    ganZhiBias,
    direction
  })

  const rangeWidth = Math.max(0.8, recentStd * 130)
  return {
    stock: quote,
    dayGanZhi: `${parsed.stem}${parsed.branch}`,
    direction,
    upProbability,
    downProbability,
    confidence,
    expectedMovePct,
    expectedRangePct: [expectedMovePct - rangeWidth, expectedMovePct + rangeWidth],
    factors: {
      baseTrend,
      momentum,
      volatilityPenalty,
      volumeBias,
      ganZhiBias
    },
    signals,
    samples: returns.length
  }
}
