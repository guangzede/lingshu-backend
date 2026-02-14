import type { Branch, Stem } from '@/types/liuyao'
import {
  BRANCH_WUXING,
  CHANGSHENG_SEQ,
  CHANGSHENG_TABLE,
  GENERATES,
  OVERCOMES,
  SIX_CLASH,
  SIX_HARM,
  SIX_HARMONY,
  STEM_WUXING,
  TRIPLE_PUNISHMENT,
  WUXING_CN,
  type WuXing
} from '@/services/ganzhi/constants'
import { seasonStatus } from '@/services/ganzhi/wuxing'
import { computeXunKong } from '@/services/ganzhi/shensha'
import {
  HIDDEN_STEMS,
  HIDDEN_WEIGHTS,
  JIA_ZI,
  NAYIN,
  STEM_COMBINE,
  STEM_COMBINE_ELEMENT,
  STEM_YINYANG,
  THREE_HARMONY,
  THREE_MEET,
  getElementCnByBranch,
  getElementCnByStem,
  getGeneratedBy,
  getNaYinElement,
  getOvercomedBy
} from './constants'
import { computeBaziShenSha, type ShenShaResult } from './shensha'

export type Gender = 'male' | 'female'
export type DirectionRule = 'year' | 'day'

export interface PillarInput {
  stem: Stem
  branch: Branch
}

export interface BaziComputeInput {
  pillars: {
    year: PillarInput
    month: PillarInput
    day: PillarInput
    hour: PillarInput
  }
  gender?: Gender
  directionRule?: DirectionRule
  luckStart?: {
    startAge?: number
    startYear?: number
    isForward?: boolean
  }
  options?: {
    daYunCount?: number
    liuNianCount?: number
    currentYear?: number
  }
  birth?: {
    date?: string
    time?: string
    calendar?: 'solar' | 'lunar'
    timeMode?: 'beijing' | 'trueSolar'
  }
}

export interface PillarDetail extends PillarInput {
  stemElement: '木' | '火' | '土' | '金' | '水'
  branchElement: '木' | '火' | '土' | '金' | '水'
  tenGod: string
  hiddenStems: Array<{ stem: Stem; element: '木' | '火' | '土' | '金' | '水'; tenGod: string; weight: number }>
  naYin: string
  naYinElement?: '木' | '火' | '土' | '金' | '水'
  changSheng: string
}

export interface RelationItem {
  type: string
  pillars: string[]
  detail?: string
}

export interface BaziComputeResult {
  pillars: {
    year: PillarDetail
    month: PillarDetail
    day: PillarDetail
    hour: PillarDetail
  }
  dayMaster: {
    stem: Stem
    branch: Branch
    element: '木' | '火' | '土' | '金' | '水'
    yinYang: 'yin' | 'yang'
    season: { status: '旺' | '相' | '休' | '囚' | '死'; score: number }
    strength: { score: number; level: '偏强' | '偏弱' | '平衡' }
  }
  wuxing: {
    total: number
    elements: Array<{ element: '木' | '火' | '土' | '金' | '水'; weight: number; percent: number }>
    maxElement: '木' | '火' | '土' | '金' | '水'
    minElement: '木' | '火' | '土' | '金' | '水'
  }
  tenGods: {
    weights: Record<string, number>
    top: string[]
  }
  yongShen: {
    use: Array<'木' | '火' | '土' | '金' | '水'>
    favor: Array<'木' | '火' | '土' | '金' | '水'>
    avoid: Array<'木' | '火' | '土' | '金' | '水'>
  }
  shenSha: ShenShaResult
  xunKong: Branch[]
  relations: {
    stems: RelationItem[]
    branches: RelationItem[]
    combos: RelationItem[]
  }
  luck: {
    direction: 'forward' | 'backward'
    startAge?: number
    startYear?: number
    daYun: Array<{
      index: number
      ganZhi: string
      stem: Stem
      branch: Branch
      tenGod: string
      startAge?: number
      endAge?: number
      startYear?: number
      endYear?: number
      liuNian?: Array<{ year: number; ganZhi: string; tenGod: string }>
    }>
  }
  pattern: {
    hints: string[]
    summary: string[]
  }
  meta: {
    computedAt: number
    options: Required<BaziComputeInput['options']>
    birth?: BaziComputeInput['birth']
  }
}

function getJiaZiIndex(stem: Stem, branch: Branch): number {
  const key = `${stem}${branch}`
  return JIA_ZI.indexOf(key)
}

function addJiaZi(stem: Stem, branch: Branch, offset: number): { stem: Stem; branch: Branch } {
  const idx = getJiaZiIndex(stem, branch)
  if (idx < 0) return { stem, branch }
  const next = (idx + offset + 60 * 1000) % 60
  const ganZhi = JIA_ZI[next]
  return { stem: ganZhi[0] as Stem, branch: ganZhi[1] as Branch }
}

function getTenGod(dayStem: Stem, otherStem: Stem): string {
  if (dayStem === otherStem) return '比肩'
  const dayElement = getElementCnByStem(dayStem)
  const otherElement = getElementCnByStem(otherStem)
  const dayYinYang = STEM_YINYANG[dayStem]
  const otherYinYang = STEM_YINYANG[otherStem]

  if (dayElement === otherElement) return dayYinYang === otherYinYang ? '比肩' : '劫财'

  const dayWu = STEM_WUXING[dayStem]
  const otherWu = STEM_WUXING[otherStem]

  if (GENERATES[otherWu] === dayWu) return dayYinYang === otherYinYang ? '偏印' : '正印'
  if (GENERATES[dayWu] === otherWu) return dayYinYang === otherYinYang ? '食神' : '伤官'
  if (OVERCOMES[otherWu] === dayWu) return dayYinYang === otherYinYang ? '七杀' : '正官'
  if (OVERCOMES[dayWu] === otherWu) return dayYinYang === otherYinYang ? '偏财' : '正财'
  return '比肩'
}

function getChangSheng(dayStem: Stem, branch: Branch): string {
  const baseElement = STEM_WUXING[dayStem]
  const seq = CHANGSHENG_TABLE[baseElement]
  const isYang = STEM_YINYANG[dayStem] === 'yang'
  const seqAdjusted = isYang ? seq : [...seq].reverse()
  const idx = seqAdjusted.indexOf(branch)
  if (idx < 0) return ''
  return CHANGSHENG_SEQ[idx]
}

function buildPillarDetail(dayStem: Stem, pillar: PillarInput, isDay = false): PillarDetail {
  const stemElement = getElementCnByStem(pillar.stem)
  const branchElement = getElementCnByBranch(pillar.branch)
  const hidden = HIDDEN_STEMS[pillar.branch] || []
  const weights = HIDDEN_WEIGHTS[hidden.length] || []
  const hiddenStems = hidden.map((stem, idx) => ({
    stem,
    element: getElementCnByStem(stem),
    tenGod: getTenGod(dayStem, stem),
    weight: weights[idx] ?? 0
  }))
  const naYin = NAYIN[`${pillar.stem}${pillar.branch}`] || ''
  return {
    stem: pillar.stem,
    branch: pillar.branch,
    stemElement,
    branchElement,
    tenGod: isDay ? '日主' : getTenGod(dayStem, pillar.stem),
    hiddenStems,
    naYin,
    naYinElement: getNaYinElement(naYin),
    changSheng: getChangSheng(dayStem, pillar.branch)
  }
}

function buildWuxingEnergy(pillars: PillarInput[]) {
  const weights: Record<'木'|'火'|'土'|'金'|'水', number> = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 }
  for (const p of pillars) {
    const stemEl = getElementCnByStem(p.stem)
    weights[stemEl] += 1
    const hidden = HIDDEN_STEMS[p.branch] || []
    const w = HIDDEN_WEIGHTS[hidden.length] || []
    hidden.forEach((s, i) => {
      const el = getElementCnByStem(s)
      weights[el] += w[i] ?? 0
    })
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1
  const elements = (Object.keys(weights) as Array<'木'|'火'|'土'|'金'|'水'>).map((k) => ({
    element: k,
    weight: Number(weights[k].toFixed(2)),
    percent: Number(((weights[k] / total) * 100).toFixed(1))
  }))
  elements.sort((a, b) => b.weight - a.weight)
  const maxElement = elements[0]?.element || '木'
  const minElement = elements[elements.length - 1]?.element || '木'
  return { total: Number(total.toFixed(2)), elements, maxElement, minElement }
}

function buildTenGodWeights(dayStem: Stem, pillars: PillarInput[]) {
  const weights: Record<string, number> = {}
  pillars.forEach((p) => {
    if (p.stem !== dayStem) {
      const tg = getTenGod(dayStem, p.stem)
      weights[tg] = (weights[tg] || 0) + 1
    }
    const hidden = HIDDEN_STEMS[p.branch] || []
    const w = HIDDEN_WEIGHTS[hidden.length] || []
    hidden.forEach((s, i) => {
      const tg = getTenGod(dayStem, s)
      weights[tg] = (weights[tg] || 0) + (w[i] ?? 0)
    })
  })
  const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1])
  return { weights, top: sorted.slice(0, 3).map(([k]) => k) }
}

function buildRelations(pillars: { label: string; pillar: PillarInput }[]) {
  const stemRelations: RelationItem[] = []
  const branchRelations: RelationItem[] = []
  const comboRelations: RelationItem[] = []

  for (let i = 0; i < pillars.length; i++) {
    for (let j = i + 1; j < pillars.length; j++) {
      const a = pillars[i]
      const b = pillars[j]

      if (STEM_COMBINE[a.pillar.stem] === b.pillar.stem) {
        const key = `${a.pillar.stem}${b.pillar.stem}`
        const element = STEM_COMBINE_ELEMENT[key] || STEM_COMBINE_ELEMENT[`${b.pillar.stem}${a.pillar.stem}`]
        stemRelations.push({
          type: '天干相合',
          pillars: [a.label, b.label],
          detail: element ? `合化${element}` : '相合'
        })
      }

      if (SIX_HARMONY[a.pillar.branch] === b.pillar.branch) {
        branchRelations.push({ type: '六合', pillars: [a.label, b.label] })
      }
      if (SIX_CLASH[a.pillar.branch] === b.pillar.branch) {
        branchRelations.push({ type: '六冲', pillars: [a.label, b.label] })
      }
      if (SIX_HARM[a.pillar.branch] === b.pillar.branch) {
        branchRelations.push({ type: '六害', pillars: [a.label, b.label] })
      }

      const punish = TRIPLE_PUNISHMENT[a.pillar.branch]
      if (punish && punish.includes(b.pillar.branch)) {
        branchRelations.push({ type: '相刑', pillars: [a.label, b.label] })
      }

      const aWu = BRANCH_WUXING[a.pillar.branch]
      const bWu = BRANCH_WUXING[b.pillar.branch]
      if (OVERCOMES[aWu] === bWu || OVERCOMES[bWu] === aWu) {
        branchRelations.push({ type: '相克', pillars: [a.label, b.label] })
      }
    }
  }

  const branchList = pillars.map((p) => p.pillar.branch)
  const branchSet = new Set(branchList)

  THREE_HARMONY.forEach((group) => {
    const present = group.branches.filter((b) => branchSet.has(b))
    if (present.length === 3) {
      comboRelations.push({ type: '三合局', pillars: present, detail: `${group.branches.join('')}合${group.element}` })
    } else if (present.length === 2) {
      comboRelations.push({ type: '半合', pillars: present, detail: `${present.join('')}半合${group.element}` })
    }
  })

  THREE_MEET.forEach((group) => {
    const present = group.branches.filter((b) => branchSet.has(b))
    if (present.length === 3) {
      comboRelations.push({ type: '三会局', pillars: present, detail: `${group.branches.join('')}会${group.element}` })
    } else if (present.length === 2) {
      comboRelations.push({ type: '半会', pillars: present, detail: `${present.join('')}半会${group.element}` })
    }
  })

  const selfPunish = ['辰', '午', '酉', '亥'] as Branch[]
  selfPunish.forEach((b) => {
    const count = branchList.filter((x) => x === b).length
    if (count >= 2) {
      branchRelations.push({ type: '自刑', pillars: [b, b] })
    }
  })

  return { stemRelations, branchRelations, comboRelations }
}

function buildDayMasterStrength(dayStem: Stem, monthBranch: Branch, energy: ReturnType<typeof buildWuxingEnergy>) {
  const dayElement = getElementCnByStem(dayStem)
  const dayWu = STEM_WUXING[dayStem]
  const season = seasonStatus(monthBranch, dayWu)
  const seasonScoreMap: Record<typeof season, number> = { '旺': 2, '相': 1, '休': 0, '囚': -1, '死': -2 }
  const seasonScore = seasonScoreMap[season]

  const elementWeights = energy.elements.reduce((acc, e) => {
    acc[e.element] = e.weight
    return acc
  }, {} as Record<'木'|'火'|'土'|'金'|'水', number>)

  const total = energy.total || 1
  const resourceElement = getGeneratedBy(dayWu)
  const outputElement = GENERATES[dayWu]
  const wealthElement = OVERCOMES[dayWu]
  const officerElement = getOvercomedBy(dayWu)

  const mapWuToCn = (w: WuXing): '木' | '火' | '土' | '金' | '水' => WUXING_CN[w]

  const support = (elementWeights[dayElement] + elementWeights[mapWuToCn(resourceElement)]) / total
  const drain = (elementWeights[mapWuToCn(outputElement)] + elementWeights[mapWuToCn(wealthElement)] + elementWeights[mapWuToCn(officerElement)]) / total
  const score = Number((seasonScore + (support - drain) * 2).toFixed(2))

  let level: '偏强' | '偏弱' | '平衡' = '平衡'
  if (score >= 1.2) level = '偏强'
  if (score <= -0.8) level = '偏弱'

  return { season, seasonScore, score, level }
}

function buildYongShen(dayStem: Stem, strengthLevel: '偏强' | '偏弱' | '平衡') {
  const dayWu = STEM_WUXING[dayStem]
  const resource = getGeneratedBy(dayWu)
  const output = GENERATES[dayWu]
  const wealth = OVERCOMES[dayWu]
  const officer = getOvercomedBy(dayWu)

  const cn = (w: WuXing): '木' | '火' | '土' | '金' | '水' => WUXING_CN[w]

  if (strengthLevel === '偏强') {
    return {
      use: [cn(officer), cn(output)],
      favor: [cn(wealth)],
      avoid: [cn(resource), getElementCnByStem(dayStem)]
    }
  }
  if (strengthLevel === '偏弱') {
    return {
      use: [getElementCnByStem(dayStem), cn(resource)],
      favor: [cn(wealth)],
      avoid: [cn(output), cn(officer)]
    }
  }
  return {
    use: [cn(wealth), cn(output)],
    favor: [cn(resource)],
    avoid: [cn(officer)]
  }
}

function buildLuck(dayStem: Stem, yearPillar: PillarInput, monthPillar: PillarInput, luckStart?: BaziComputeInput['luckStart'], birthYear?: number, options?: BaziComputeInput['options']) {
  const direction = (luckStart?.isForward ?? true) ? 'forward' : 'backward'
  const count = options?.daYunCount ?? 10
  const startAge = luckStart?.startAge
  const startYear = luckStart?.startYear
  const list = [] as BaziComputeResult['luck']['daYun']

  for (let i = 0; i < count; i++) {
    const offset = direction === 'forward' ? i + 1 : -(i + 1)
    const next = addJiaZi(monthPillar.stem, monthPillar.branch, offset)
    const tenGod = getTenGod(dayStem, next.stem)
    const ageStart = startAge !== undefined ? Number((startAge + i * 10).toFixed(2)) : undefined
    const ageEnd = ageStart !== undefined ? Number((ageStart + 9.99).toFixed(2)) : undefined
    const yearStart = startYear !== undefined ? startYear + i * 10 : undefined
    const yearEnd = yearStart !== undefined ? yearStart + 9 : undefined

    let liuNian: Array<{ year: number; ganZhi: string; tenGod: string }> | undefined
    if (yearStart !== undefined && birthYear !== undefined) {
      liuNian = []
      for (let y = 0; y < 10; y++) {
        const year = yearStart + y
        const birthIndex = getJiaZiIndex(yearPillar.stem, yearPillar.branch)
        const yearGanZhi = JIA_ZI[(birthIndex + (year - birthYear) + 60 * 1000) % 60]
        liuNian.push({
          year,
          ganZhi: yearGanZhi,
          tenGod: getTenGod(dayStem, yearGanZhi[0] as Stem)
        })
      }
    }

    list.push({
      index: i + 1,
      ganZhi: `${next.stem}${next.branch}`,
      stem: next.stem,
      branch: next.branch,
      tenGod,
      startAge: ageStart,
      endAge: ageEnd,
      startYear: yearStart,
      endYear: yearEnd,
      liuNian
    })
  }

  return {
    direction,
    startAge,
    startYear,
    daYun: list
  }
}

export function computeBaziChart(input: BaziComputeInput): BaziComputeResult {
  const { pillars, birth, options } = input
  const dayStem = pillars.day.stem
  const dayBranch = pillars.day.branch

  const details = {
    year: buildPillarDetail(dayStem, pillars.year),
    month: buildPillarDetail(dayStem, pillars.month),
    day: buildPillarDetail(dayStem, pillars.day, true),
    hour: buildPillarDetail(dayStem, pillars.hour)
  }

  const energy = buildWuxingEnergy([pillars.year, pillars.month, pillars.day, pillars.hour])
  const strengthInfo = buildDayMasterStrength(dayStem, pillars.month.branch, energy)
  const yongShen = buildYongShen(dayStem, strengthInfo.level)
  const tenGods = buildTenGodWeights(dayStem, [pillars.year, pillars.month, pillars.day, pillars.hour])

  const relationsRaw = buildRelations([
    { label: '年柱', pillar: pillars.year },
    { label: '月柱', pillar: pillars.month },
    { label: '日柱', pillar: pillars.day },
    { label: '时柱', pillar: pillars.hour }
  ])

  const shenSha = computeBaziShenSha(dayStem, dayBranch, pillars.month.branch, pillars.year.branch)
  const xunKong = computeXunKong(dayStem, dayBranch)

  const birthYear = birth?.date ? Number(birth.date.slice(0, 4)) : undefined
  const yangStems: Stem[] = ['甲', '丙', '戊', '庚', '壬']
  const isForward = input.luckStart?.isForward ?? (() => {
    if (!input.gender) return true
    const rule = input.directionRule || 'year'
    const stem = rule === 'year' ? pillars.year.stem : pillars.day.stem
    const isYang = yangStems.includes(stem)
    const isMale = input.gender === 'male'
    return (isYang && isMale) || (!isYang && !isMale)
  })()
  const luckStart = { ...input.luckStart, isForward }
  const luck = buildLuck(dayStem, pillars.year, pillars.month, luckStart, birthYear, options)

  const summary: string[] = []
  summary.push(`日主为${dayStem}${getElementCnByStem(dayStem)}，${strengthInfo.level}，月令${strengthInfo.season}。`)
  summary.push(`五行偏${energy.maxElement}，最弱为${energy.minElement}。`)
  summary.push(`用神偏向${yongShen.use.join('、')}，忌神偏向${yongShen.avoid.join('、')}。`)

  const hints: string[] = []
  if (tenGods.top.length) {
    hints.push(`十神分布以${tenGods.top.join('、')}较为突出。`)
  }
  if (strengthInfo.level === '偏强') hints.push('日主偏强，宜取泄耗与克制之气平衡。')
  if (strengthInfo.level === '偏弱') hints.push('日主偏弱，宜取扶助与生扶之气补益。')

  const resolvedOptions = {
    daYunCount: options?.daYunCount ?? 10,
    liuNianCount: options?.liuNianCount ?? 10,
    currentYear: options?.currentYear ?? new Date().getFullYear()
  }

  return {
    pillars: details,
    dayMaster: {
      stem: dayStem,
      branch: dayBranch,
      element: getElementCnByStem(dayStem),
      yinYang: STEM_YINYANG[dayStem],
      season: { status: strengthInfo.season, score: strengthInfo.seasonScore },
      strength: { score: strengthInfo.score, level: strengthInfo.level }
    },
    wuxing: energy,
    tenGods,
    yongShen,
    shenSha,
    xunKong,
    relations: {
      stems: relationsRaw.stemRelations,
      branches: relationsRaw.branchRelations,
      combos: relationsRaw.comboRelations
    },
    luck,
    pattern: { hints, summary },
    meta: {
      computedAt: Date.now(),
      options: resolvedOptions,
      birth
    }
  }
}
