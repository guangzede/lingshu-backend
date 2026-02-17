import { Lunar, LunarYear, Solar } from 'lunar-javascript'
import type { Branch, Stem } from '@/types/liuyao'
import { BRANCH_ORDER, BRANCH_WUXING, CN_TO_WUXING, GENERATES, OVERCOMES, STEM_WUXING, WUXING_CN, SIX_CLASH, SIX_HARM, SIX_HARMONY, TRIPLE_HARMONY, TRIPLE_PUNISHMENT } from '@/services/ganzhi/constants'
import { computeShenSha, computeXunKong } from '@/services/ganzhi/shensha'
import { BRANCHES, STEMS, TIANJIANG_ORDER, KE_TI_HINTS } from './constants'

export interface DaLiuRenInput {
  datetime: {
    year: number
    month: number
    day: number
    hour: number
    minute: number
  }
  calendar?: 'solar' | 'lunar'
  lunarLeap?: boolean
  timeMode?: 'beijing' | 'trueSolar'
  manualPillars?: {
    year: { stem: Stem; branch: Branch }
    month: { stem: Stem; branch: Branch }
    day: { stem: Stem; branch: Branch }
    hour: { stem: Stem; branch: Branch }
  }
}

const pad2 = (n: number) => n.toString().padStart(2, '0')

const STEM_HOME: Record<Stem, Branch> = {
  '甲': '寅',
  '乙': '卯',
  '丙': '巳',
  '丁': '午',
  '戊': '巳',
  '己': '午',
  '庚': '申',
  '辛': '酉',
  '壬': '亥',
  '癸': '子'
}

const DAY_NIGHT_NOBLE: Record<Stem, [Branch, Branch]> = {
  '甲': ['丑', '未'],
  '乙': ['子', '申'],
  '丙': ['亥', '酉'],
  '丁': ['亥', '酉'],
  '戊': ['丑', '未'],
  '己': ['子', '申'],
  '庚': ['丑', '未'],
  '辛': ['午', '寅'],
  '壬': ['巳', '卯'],
  '癸': ['巳', '卯']
}

function equationOfTime(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const day = Math.floor(diff / 86400000)
  const B = (2 * Math.PI * (day - 81)) / 364
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(2 * B)
}

function applyTrueSolarTime(solar: any): any {
  const date = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute(), 0)
  const eot = equationOfTime(date)
  const adjusted = new Date(date.getTime() + eot * 60000)
  return Solar.fromDate(adjusted)
}

function buildSolarFromInput(input: DaLiuRenInput) {
  const { datetime, calendar = 'solar', lunarLeap = false, timeMode = 'beijing' } = input
  const lunarMonth = lunarLeap ? -datetime.month : datetime.month
  let solar = calendar === 'solar'
    ? Solar.fromYmdHms(datetime.year, datetime.month, datetime.day, datetime.hour, datetime.minute, 0)
    : Lunar.fromYmdHms(datetime.year, lunarMonth, datetime.day, datetime.hour, datetime.minute, 0).getSolar()
  if (timeMode === 'trueSolar') {
    solar = applyTrueSolarTime(solar)
  }
  return solar
}

function rotate<T>(arr: T[], startIndex: number) {
  const len = arr.length
  const idx = ((startIndex % len) + len) % len
  return arr.slice(idx).concat(arr.slice(0, idx))
}

function elementRelation(upper: string | undefined, lower: string | undefined) {
  if (!upper || !lower) return '—'
  const up = (CN_TO_WUXING as any)[upper] || upper
  const down = (CN_TO_WUXING as any)[lower] || lower
  if (!GENERATES[up as keyof typeof GENERATES] || !GENERATES[down as keyof typeof GENERATES]) return '—'
  if (up === down) return '比和'
  if (GENERATES[up] === down) return '生'
  if (OVERCOMES[up] === down) return '克'
  if (GENERATES[down] === up) return '受生'
  if (OVERCOMES[down] === up) return '受克'
  return '—'
}

export function computeDaLiuRenChart(input: DaLiuRenInput) {
  const solar = buildSolarFromInput(input)
  const lunar = solar.getLunar()
  const eightChar = lunar.getEightChar()
  eightChar.setSect(2)

  const pillars = input.manualPillars ?? {
    year: { stem: eightChar.getYearGan() as Stem, branch: eightChar.getYearZhi() as Branch },
    month: { stem: eightChar.getMonthGan() as Stem, branch: eightChar.getMonthZhi() as Branch },
    day: { stem: eightChar.getDayGan() as Stem, branch: eightChar.getDayZhi() as Branch },
    hour: { stem: eightChar.getTimeGan() as Stem, branch: eightChar.getTimeZhi() as Branch }
  }

  const dayStem = pillars.day.stem
  const dayBranch = pillars.day.branch
  const hourBranch = pillars.hour.branch

  const xunKong = computeXunKong(dayStem, dayBranch)
  const shenSha = computeShenSha(dayStem, dayBranch, pillars.month.branch, pillars.year.branch)

  const earthPlate = BRANCH_ORDER
  const hourIndex = earthPlate.indexOf(hourBranch)
  const heavenPlate = rotate(earthPlate, hourIndex)

  const hourIndexForDay = earthPlate.indexOf(hourBranch)
  const isDayTime = hourIndexForDay >= 3 && hourIndexForDay <= 9
  const noblePair = DAY_NIGHT_NOBLE[dayStem] || (shenSha['天乙贵人'] as Branch[] | undefined)
  const nobleBranch = Array.isArray(noblePair)
    ? (isDayTime ? noblePair[0] : noblePair[1] || noblePair[0])
    : (shenSha['天乙贵人']?.[0] || dayBranch)
  const nobleIndex = Math.max(0, heavenPlate.indexOf(nobleBranch))
  const generals = heavenPlate.map((_, idx) => TIANJIANG_ORDER[(idx - nobleIndex + 12) % 12])

  const plateMap = earthPlate.map((earth, idx) => ({
    earth,
    heaven: heavenPlate[idx],
    general: generals[idx]
  }))

  const dayBranchIndex = earthPlate.indexOf(dayBranch)
  const generalByHeaven: Record<Branch, string> = {}
  heavenPlate.forEach((b, idx) => {
    generalByHeaven[b] = generals[idx]
  })

  const lessonData = [
    { label: '一课', upper: { type: 'stem', value: dayStem }, lower: { type: 'branch', value: dayBranch } },
    { label: '二课', upper: { type: 'stem', value: pillars.hour.stem }, lower: { type: 'branch', value: hourBranch } },
    { label: '三课', upper: { type: 'branch', value: heavenPlate[dayBranchIndex] }, lower: { type: 'branch', value: dayBranch } },
    { label: '四课', upper: { type: 'branch', value: heavenPlate[hourIndex] }, lower: { type: 'branch', value: hourBranch } }
  ].map((lesson) => {
    const upperHome = lesson.upper.type === 'stem' ? STEM_HOME[lesson.upper.value as Stem] : undefined
    const upperGeneral = lesson.upper.type === 'branch'
      ? generalByHeaven[lesson.upper.value as Branch]
      : upperHome
        ? generalByHeaven[upperHome]
        : ''
    const lowerGeneral = generalByHeaven[lesson.lower.value as Branch]
    const upperElement = lesson.upper.type === 'stem'
      ? WUXING_CN[STEM_WUXING[lesson.upper.value as Stem]]
      : WUXING_CN[BRANCH_WUXING[lesson.upper.value as Branch]]
    const lowerElement = WUXING_CN[BRANCH_WUXING[lesson.lower.value as Branch]]
    return {
      ...lesson,
      upperHome,
      upperGeneral,
      lowerGeneral,
      upperElement,
      lowerElement,
      relation: elementRelation(upperElement, lowerElement)
    }
  })

  // 三传取法：按较正统口径（贼克优先，其次比用，再取涉害）
  const dayStemElement = WUXING_CN[STEM_WUXING[dayStem]]
  const lessonBranches = (l: any) => ({
    upper: l.upper.type === 'branch' ? l.upper.value : l.upperHome,
    lower: l.lower.value
  })
  const branchScore = (branch?: Branch) => {
    if (!branch) return 0
    let score = 0
    if (SIX_CLASH[branch] === dayBranch || SIX_CLASH[dayBranch] === branch) score += 2
    if (SIX_HARM[branch] === dayBranch || SIX_HARM[dayBranch] === branch) score += 1
    if (TRIPLE_PUNISHMENT[branch]?.includes(dayBranch) || TRIPLE_PUNISHMENT[dayBranch]?.includes(branch)) score += 1
    return score
  }
  const lessonScore = (l: any) => {
    const { upper, lower } = lessonBranches(l)
    let score = 0
    if (l.upperElement === dayStemElement) score += 2
    if (l.lowerElement === dayStemElement) score += 1
    score += Math.max(branchScore(upper as Branch), branchScore(lower as Branch))
    return score
  }
  const pickByScore = (candidates: any[]) => candidates.reduce((best, item) => (
    lessonScore(item) > lessonScore(best) ? item : best
  ), candidates[0])
  const pickLessons = (relations: string[]) => lessonData.filter((l) => relations.includes(l.relation))

  let transmissionMethod = '常用'
  let candidates = pickLessons(['克', '受克'])
  if (candidates.length) {
    transmissionMethod = '贼克'
  } else {
    candidates = pickLessons(['比和'])
    if (candidates.length) {
      transmissionMethod = '比用'
    } else {
      candidates = pickLessons(['生', '受生'])
      if (candidates.length) transmissionMethod = '涉害'
    }
  }
  if (!candidates.length) candidates = lessonData

  const useLesson = candidates.length > 1 ? pickByScore(candidates) : candidates[0]
  const { upper: useUpper, lower: useLower } = lessonBranches(useLesson)
  const useBranch = useLesson.relation === '受克' || useLesson.relation === '受生'
    ? useLower
    : (useUpper || useLower)

  const chu = (useBranch as Branch) || dayBranch
  const getHeaven = (branch: Branch) => heavenPlate[earthPlate.indexOf(branch)]
  const zhong = getHeaven(chu)
  const mo = getHeaven(zhong as Branch)

  const transmissionList = [
    { label: '初传', branch: chu },
    { label: '中传', branch: zhong },
    { label: '末传', branch: mo }
  ].map((item) => {
    const idx = heavenPlate.indexOf(item.branch)
    const general = generals[idx] || '—'
    const element = WUXING_CN[BRANCH_WUXING[item.branch]]
    const relation = elementRelation(WUXING_CN[STEM_WUXING[dayStem]], element)
    return {
      ...item,
      general,
      element,
      relation
    }
  })

  const keTi: string[] = []
  if (dayBranch === hourBranch) keTi.push('伏吟')
  if (SIX_CLASH[dayBranch] === hourBranch) keTi.push('反吟')
  if (shenSha['天乙贵人']?.includes(hourBranch)) keTi.push('贵人临时')
  if (xunKong.includes(chu) || xunKong.includes(zhong) || xunKong.includes(mo)) keTi.push('空亡临传')

  const relationTags: string[] = []
  const checkBranch = (a: Branch, b: Branch) => {
    if (SIX_HARMONY[a] === b) relationTags.push(`${a}${b}六合`)
    if (SIX_CLASH[a] === b) relationTags.push(`${a}${b}六冲`)
    if (SIX_HARM[a] === b) relationTags.push(`${a}${b}六害`)
    const triple = TRIPLE_HARMONY[a]
    if (triple?.includes(b)) relationTags.push(`${a}${b}半合`)
    const punish = TRIPLE_PUNISHMENT[a]
    if (punish?.includes(b)) relationTags.push(`${a}${b}刑`)
  }

  checkBranch(dayBranch, chu)
  checkBranch(dayBranch, zhong)
  checkBranch(dayBranch, mo)

  const keTiHints = keTi.map((t) => KE_TI_HINTS[t]).filter(Boolean)

  const lunarLeapMonth = LunarYear.fromYear(lunar.getYear()).getLeapMonth()
  const lunarIsLeap = typeof (lunar as any).isLeap === 'function'
    ? (lunar as any).isLeap()
    : false

  return {
    solar: {
      date: `${solar.getYear()}-${pad2(solar.getMonth())}-${pad2(solar.getDay())}`,
      time: `${pad2(solar.getHour())}:${pad2(solar.getMinute())}`
    },
    lunar: {
      year: lunar.getYearInChinese(),
      month: lunar.getMonthInChinese(),
      day: lunar.getDayInChinese(),
      leap: Boolean(lunarLeapMonth && lunar.getMonth() === lunarLeapMonth && lunarIsLeap),
      jieQi: lunar.getJieQi() || ''
    },
    ganzhi: {
      year: { stem: pillars.year.stem, branch: pillars.year.branch },
      month: { stem: pillars.month.stem, branch: pillars.month.branch },
      day: { stem: pillars.day.stem, branch: pillars.day.branch },
      hour: { stem: pillars.hour.stem, branch: pillars.hour.branch }
    },
    xunKong,
    shenSha,
    earthPlate,
    heavenPlate,
    generals,
    plates: plateMap,
    fourLessons: lessonData,
    threeTransmissions: transmissionList,
    transmissionMethod,
    keTi,
    relationTags,
    summary: {
      main: keTi.length ? `课体：${keTi.join('、')}` : '课体平稳',
      hints: keTiHints
    },
    warnings: [
      `口径说明：三传取法按贼克优先、比用次之、涉害取用（当前为简化实现）。当前取法：${transmissionMethod}。`,
      '口径说明：贵人已区分昼夜，基于日干贵人双支取用。'
    ]
  }
}
