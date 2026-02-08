import { Lunar } from 'lunar-javascript'
import type {
  Branch,
  Hexagram,
  SixGod,
  Stem,
  Trigram,
  TrigramName,
  Yao,
  ComputeOptions,
  SchoolRuleSet
} from '@/types/liuyao'
import {
  RULE_SETS,
  SIX_GODS,
  TRIGRAM_BRANCH_SEQUENCE,
  TRIGRAM_STEM_SEQUENCE,
  DEFAULT_BRANCH_SEQUENCE
} from '@/constants/liuyaoRules'
import { resolveHexagramName } from '@/constants/hexagramNames'
import { findPalaceByCode, PALACE_HEXAGRAMS } from '@/constants/hexagramPalace'
import {
  getRelation,
  assignFiveElement,
  toWuXing,
  assignChangsheng,
  getSeasonElement,
  seasonStatus,
  STEM_WUXING,
  type WuXing
} from '@/services/ganzhi/wuxing'

import { BRANCH_WUXING } from '@/services/ganzhi/constants'

import { computeShenSha, computeXunKong } from '@/services/ganzhi/shensha'
import { LingshuEnergyCalculator, HexagramInput, AnalysisResult } from './fiveEnergy'


// ============= 基础工具函数 =============
function getTrigramName(yaos: [Yao, Yao, Yao]): TrigramName {
  const bits = yaos.map(y => (y.isYang ? 1 : 0))
  const code = bits[0] * 4 + bits[1] * 2 + bits[2]
  const map: Record<number, TrigramName> = {
    7: '乾', 6: '兑', 5: '离', 4: '震',
    3: '巽', 2: '坎', 1: '艮', 0: '坤'
  }
  return map[code]
}

function cloneYao(y: Yao): Yao {
  return { ...y }
}

function codeFromYaos(yaos: [Yao, Yao, Yao, Yao, Yao, Yao]) {
  // 约定：yaos 为上->下顺序，卦码需要自下而上
  return [...yaos].reverse().map(y => (y.isYang ? '1' : '0')).join('')
}

function toTopIndex(bottomIndex: number): number {
  return 5 - bottomIndex
}

function toBottomIndex(topIndex: number): number {
  return 5 - topIndex
}

function applyPalace(hex: Hexagram) {
  const code = codeFromYaos(hex.yaos)
  const meta = findPalaceByCode(code)
  if (meta) {
    hex.palace = meta.palace
    hex.palaceCategory = meta.category
    hex.element = meta.element
    // meta 索引以初爻为0（自下而上），这里转换为上爻=0
    hex.shiIndex = toTopIndex(meta.shiIndex)
    hex.yingIndex = toTopIndex(meta.yingIndex)
    if (!hex.name) hex.name = meta.name
  }
}

function applyHexagramName(hex: Hexagram) {
  hex.name = resolveHexagramName(hex.upper.name, hex.lower.name)
  if (!hex.palace) hex.palace = `${hex.lower.name}宫`
}

function buildHexagramFromCode(code: string): Hexagram {
  const bits = code.split('').map(c => c === '1')
  // code 为自下而上，转换为上->下顺序
  const linesBottom = bits.map((b) => ({ isYang: b, isMoving: false }))
  const linesTop = [...linesBottom].reverse()
  return buildHexagram(linesTop as any)
}

// ============= 核心卦象构建 =============
export function buildHexagram(lines: Array<{ isYang: boolean; isMoving: boolean }>): Hexagram {
  if (lines.length !== 6) throw new Error('需要6爻输入')

  const yaos: [Yao, Yao, Yao, Yao, Yao, Yao] = lines.map((line, i) => ({
    index: i + 1,
    isYang: line.isYang,
    isMoving: line.isMoving
  })) as [Yao, Yao, Yao, Yao, Yao, Yao]

  // 上->下顺序：上卦在前 3 爻，下卦在后 3 爻
  const upperTop: [Yao, Yao, Yao] = [cloneYao(yaos[0]), cloneYao(yaos[1]), cloneYao(yaos[2])]
  const lowerTop: [Yao, Yao, Yao] = [cloneYao(yaos[3]), cloneYao(yaos[4]), cloneYao(yaos[5])]

  const upperName = getTrigramName([cloneYao(upperTop[2]), cloneYao(upperTop[1]), cloneYao(upperTop[0])])
  const lowerName = getTrigramName([cloneYao(lowerTop[2]), cloneYao(lowerTop[1]), cloneYao(lowerTop[0])])

  const upper: Trigram = { name: upperName, yaos: upperTop }
  const lower: Trigram = { name: lowerName, yaos: lowerTop }

  const hex = { lower, upper, yaos, palace: `${lower.name}宫` }
  applyHexagramName(hex)
  applyPalace(hex)

  return hex
}

export function deriveVariant(hex: Hexagram): Hexagram {
  const changed: [Yao, Yao, Yao, Yao, Yao, Yao] = hex.yaos.map(y => {
    const copy = cloneYao(y)
    if (copy.isMoving) copy.isYang = !copy.isYang
    return copy
  }) as [Yao, Yao, Yao, Yao, Yao, Yao]

  const upperTop: [Yao, Yao, Yao] = [cloneYao(changed[0]), cloneYao(changed[1]), cloneYao(changed[2])]
  const lowerTop: [Yao, Yao, Yao] = [cloneYao(changed[3]), cloneYao(changed[4]), cloneYao(changed[5])]

  const upperName = getTrigramName([cloneYao(upperTop[2]), cloneYao(upperTop[1]), cloneYao(upperTop[0])])
  const lowerName = getTrigramName([cloneYao(lowerTop[2]), cloneYao(lowerTop[1]), cloneYao(lowerTop[0])])

  const upper: Trigram = { name: upperName, yaos: upperTop }
  const lower: Trigram = { name: lowerName, yaos: lowerTop }

  const variant = { lower, upper, yaos: changed, palace: `${lower.name}宫` }
  applyHexagramName(variant)
  applyPalace(variant)

  return variant
}

export function deriveMutual(hex: Hexagram): Hexagram {
  const yaos = hex.yaos
  // 互卦：取第2-4爻为下卦，第3-5爻为上卦（按自下而上规则映射到上->下数组）
  const lowerTop: [Yao, Yao, Yao] = [cloneYao(yaos[2]), cloneYao(yaos[3]), cloneYao(yaos[4])]
  const upperTop: [Yao, Yao, Yao] = [cloneYao(yaos[1]), cloneYao(yaos[2]), cloneYao(yaos[3])]

  const upperName = getTrigramName([cloneYao(upperTop[2]), cloneYao(upperTop[1]), cloneYao(upperTop[0])])
  const lowerName = getTrigramName([cloneYao(lowerTop[2]), cloneYao(lowerTop[1]), cloneYao(lowerTop[0])])

  const upper: Trigram = { name: upperName, yaos: upperTop }
  const lower: Trigram = { name: lowerName, yaos: lowerTop }

  const combined: [Yao, Yao, Yao, Yao, Yao, Yao] = [
    cloneYao(upperTop[0]), cloneYao(upperTop[1]), cloneYao(upperTop[2]),
    cloneYao(lowerTop[0]), cloneYao(lowerTop[1]), cloneYao(lowerTop[2])
  ]

  const mutual = { lower, upper, yaos: combined, palace: `${lower.name}宫` }
  applyHexagramName(mutual)
  applyPalace(mutual)

  return mutual
}

// ============= 时间干支 =============
export function getDayStemBranch(date: Date): { stem: Stem; branch: Branch } {
  const lunar = Lunar.fromDate(date)
  return {
    stem: lunar.getDayGan() as Stem,
    branch: lunar.getDayZhi() as Branch
  }
}

export function getTimeGanZhi(date: Date) {
  const lunar = Lunar.fromDate(date)
  return {
    year: { stem: lunar.getYearGan() as Stem, branch: lunar.getYearZhi() as Branch },
    month: { stem: lunar.getMonthGan() as Stem, branch: lunar.getMonthZhi() as Branch },
    day: { stem: lunar.getDayGan() as Stem, branch: lunar.getDayZhi() as Branch },
    hour: { stem: lunar.getTimeGan() as Stem, branch: lunar.getTimeZhi() as Branch }
  }
}

// ============= 伏神处理 =============
function applyFuShen(hex: Hexagram, yaos: [Yao, Yao, Yao, Yao, Yao, Yao], rule: SchoolRuleSet, self: WuXing) {
  const allRelations = new Set(['父母', '官星', '子孙', '妻财', '兄弟'] as const)
  const existingRelations = new Set(yaos.map(y => y.relation).filter(Boolean))
  const missingRelations = Array.from(allRelations).filter(r => !existingRelations.has(r))

  if (missingRelations.length === 0) return

  const palaceCode = codeFromYaos(hex.yaos)
  const palaceMeta = findPalaceByCode(palaceCode)
  if (!palaceMeta) return

  const base = PALACE_HEXAGRAMS.find(h => h.palace === palaceMeta.palace && h.category === '本宫')
  if (!base) return

  const baseHex = buildHexagramFromCode(base.code)
  const baseNaJia = mapNaJia(baseHex, rule)
  baseNaJia.forEach(y => { y.relation = getRelation(self, y.branch, y.stem) })

  baseNaJia.forEach((b, idx) => {
    if (b.relation && missingRelations.includes(b.relation)) {
      yaos[idx].fuShen = { stem: b.stem, branch: b.branch, relation: b.relation }
    }
  })
}

// ============= 六神分配 =============
export function assignSixGods(date: Date, rule: SchoolRuleSet, yaos: [Yao, Yao, Yao, Yao, Yao, Yao]): SixGod[] {
  const base = rule.sixGod
  const { stem, branch } = getDayStemBranch(date)

  const start: SixGod = base.baseBy === 'dayStem'
    ? (base.startByStem?.[stem] || SIX_GODS[0])
    : (base.startByBranch?.[branch] || SIX_GODS[0])

  const seq = base.sequence
  const startIndex = seq.indexOf(start)

  // 六神按自下而上顺序循环，数组为上->下时需映射索引
  const result: SixGod[] = yaos.map((_, i) => {
    const bottomIndex = toBottomIndex(i)
    return seq[(startIndex - bottomIndex + seq.length * 100) % seq.length]
  })
  result.forEach((sg, i) => { yaos[i].sixGod = sg })

  return result
}

// ============= 纳甲装卦 =============
export function mapNaJia(hex: Hexagram, rule: SchoolRuleSet): [Yao, Yao, Yao, Yao, Yao, Yao] {
  const res = hex.yaos.map(cloneYao) as [Yao, Yao, Yao, Yao, Yao, Yao]
  const lowerName = hex.lower.name
  const upperName = hex.upper.name
  const trigramStem = rule.naJia.trigramStem

  const setAtBottomIndex = (bottomIndex: number, updater: (y: Yao) => void) => {
    const topIndex = toTopIndex(bottomIndex)
    updater(res[topIndex])
  }

  // 天干排法
  const lowerStemSeq = TRIGRAM_STEM_SEQUENCE[lowerName]
  const upperStemSeq = TRIGRAM_STEM_SEQUENCE[upperName]

  if (lowerStemSeq) {
    setAtBottomIndex(0, (y) => { y.stem = lowerStemSeq[0] })
    setAtBottomIndex(1, (y) => { y.stem = lowerStemSeq[1] })
    setAtBottomIndex(2, (y) => { y.stem = lowerStemSeq[2] })
  } else {
    const lowerStem = trigramStem[lowerName]
    if (Array.isArray(lowerStem)) {
      setAtBottomIndex(0, (y) => { y.stem = lowerStem[0] })
      setAtBottomIndex(1, (y) => { y.stem = lowerStem[1] })
      setAtBottomIndex(2, (y) => { y.stem = lowerStem[2] })
    } else {
      setAtBottomIndex(0, (y) => { y.stem = lowerStem })
      setAtBottomIndex(1, (y) => { y.stem = lowerStem })
      setAtBottomIndex(2, (y) => { y.stem = lowerStem })
    }
  }

  if (upperStemSeq) {
    setAtBottomIndex(3, (y) => { y.stem = upperStemSeq[3] })
    setAtBottomIndex(4, (y) => { y.stem = upperStemSeq[4] })
    setAtBottomIndex(5, (y) => { y.stem = upperStemSeq[5] })
  } else {
    const upperStem = trigramStem[upperName]
    if (Array.isArray(upperStem)) {
      setAtBottomIndex(3, (y) => { y.stem = upperStem[0] })
      setAtBottomIndex(4, (y) => { y.stem = upperStem[1] })
      setAtBottomIndex(5, (y) => { y.stem = upperStem[2] })
    } else {
      setAtBottomIndex(3, (y) => { y.stem = upperStem })
      setAtBottomIndex(4, (y) => { y.stem = upperStem })
      setAtBottomIndex(5, (y) => { y.stem = upperStem })
    }
  }

  // 地支排法
  const lowerSeq = TRIGRAM_BRANCH_SEQUENCE[lowerName] || (rule.naJia.branchSequence as Branch[]) || DEFAULT_BRANCH_SEQUENCE
  const upperSeq = TRIGRAM_BRANCH_SEQUENCE[upperName] || (rule.naJia.branchSequence as Branch[]) || DEFAULT_BRANCH_SEQUENCE

  setAtBottomIndex(0, (y) => { y.branch = lowerSeq[0] })
  setAtBottomIndex(1, (y) => { y.branch = lowerSeq[1] })
  setAtBottomIndex(2, (y) => { y.branch = lowerSeq[2] })
  setAtBottomIndex(3, (y) => { y.branch = upperSeq[3] })
  setAtBottomIndex(4, (y) => { y.branch = upperSeq[4] })
  setAtBottomIndex(5, (y) => { y.branch = upperSeq[5] })

  return res
}

export function getBranchOrder(hex: Hexagram, rule: SchoolRuleSet): Branch[] {
  const res = mapNaJia(hex, rule)
  return res.map(y => y.branch!).filter(Boolean) as Branch[]
}

// ============= 综合计算 =============
export function computeAll(lines: Array<{ isYang: boolean; isMoving: boolean }>, options: ComputeOptions) {
  const rule = RULE_SETS[options.ruleSetKey]
  if (!rule) throw new Error(`未找到规则集: ${options.ruleSetKey}`)

  const hex = buildHexagram(lines)
  const variant = deriveVariant(hex)
  const date = options.date || new Date()
  const lunar = Lunar.fromDate(date)

  const withNaJia = mapNaJia(hex, rule)
  assignSixGods(date, rule, withNaJia)

  const variantNaJia = mapNaJia(variant, rule).map(y => ({ ...y, isMoving: false })) as [Yao, Yao, Yao, Yao, Yao, Yao]

  // 六亲判定
  const { stem: dayStem } = getDayStemBranch(date)
  const selfElement = toWuXing(hex.element) || STEM_WUXING[dayStem]
  const variantSelfElement = toWuXing(variant.element) || STEM_WUXING[dayStem]

  withNaJia.forEach(y => { y.relation = getRelation(selfElement, y.branch, y.stem) })
  variantNaJia.forEach(y => { y.relation = getRelation(variantSelfElement, y.branch, y.stem) })

  assignChangsheng(dayStem, withNaJia)
  assignChangsheng(dayStem, variantNaJia)

  assignFiveElement(withNaJia)
  assignFiveElement(variantNaJia)

  applyFuShen(hex, withNaJia, rule, selfElement)

  const timeGanZhi = getTimeGanZhi(date)
  const shenSha = computeShenSha(timeGanZhi.day.stem, timeGanZhi.day.branch, timeGanZhi.month.branch, timeGanZhi.year.branch)
  const xunKong = computeXunKong(timeGanZhi.day.stem, timeGanZhi.day.branch)

  // 四时旺衰
  const seasonEl = getSeasonElement(timeGanZhi.month.branch)

  withNaJia.forEach(y => {
    if (y.stem) {
      const el = STEM_WUXING[y.stem]
      y.seasonStrength = seasonStatus(timeGanZhi.month.branch, el)
    }
  })

  variantNaJia.forEach(y => {
    if (y.stem) {
      const el = STEM_WUXING[y.stem]
      y.seasonStrength = seasonStatus(timeGanZhi.month.branch, el)
    }
  })

  const youHun = hex.palaceCategory === '游魂'
  const guiHun = hex.palaceCategory === '归魂'
  // 能量评分集成
  // 构造 LingshuEnergyCalculator 所需输入
  const hexagramInput: HexagramInput = {
    date: {
      monthBranch: timeGanZhi.month.branch,
      dayBranch: timeGanZhi.day.branch,
      voidBranches: xunKong || [],
    },
    lines: withNaJia.map((y, idx) => {
      const branch = y.branch
      if (!branch) throw new Error('能量评分缺少地支')
      const changeBranch = variantNaJia[idx]?.branch
      return {
        position: y.index || (idx + 1),
        name: branch,
        element: BRANCH_WUXING[branch],
        branch,
        isMoving: y.isMoving,
        changeBranch,
        changeElement: changeBranch ? BRANCH_WUXING[changeBranch] : undefined,
      }
    }),
    globalPattern: undefined,
  }
  const energyAnalysis: AnalysisResult = LingshuEnergyCalculator.analyze(hexagramInput)

  return {
    rule,
    date,
    lunar: {
      year: lunar.getYearInChinese(),
      month: lunar.getMonthInChinese(),
      day: lunar.getDayInChinese(),
      jieQi: lunar.getJieQi() || ''
    },
    timeGanZhi,
    shenSha,
    xunKong,
    hex,
    variant,
    palace: hex.palace,
    youHun,
    guiHun,
    yaos: withNaJia,
    variantYaos: variantNaJia,
    energyAnalysis, // 新增能量评分结果
    // fiveElementCounts,
  }
}
