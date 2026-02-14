import type { Branch, Stem } from '@/types/liuyao'
import type { BaziComputeResult } from './index'
import { GENERATES, OVERCOMES, STEM_WUXING, WUXING_CN } from '@/services/ganzhi/constants'
import { JIA_ZI, STEM_YINYANG, getElementCnByStem } from './constants'

const BASE_YEAR = 1984 // 甲子年

function getTenGod(dayStem: Stem, otherStem: Stem): string {
  if (dayStem === otherStem) return '日主'
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

function getYearGanZhi(year: number): { ganZhi: string; stem: Stem; branch: Branch } {
  const idx = ((year - BASE_YEAR) % 60 + 60) % 60
  const ganZhi = JIA_ZI[idx]
  return { ganZhi, stem: ganZhi[0] as Stem, branch: ganZhi[1] as Branch }
}

function buildFocus(tenGod: string): string {
  const mapping: Record<string, string> = {
    '比肩': '自我驱动与协作平衡，适合稳住基本盘',
    '劫财': '竞争与资源分配提升，需注意人际边界',
    '食神': '输出、表达与享受提升，适合积累口碑',
    '伤官': '突破与表现欲增强，适合创新与破局',
    '偏财': '偏财与机会增多，谨慎投资节奏',
    '正财': '正财与稳定收益主题明确，适合稳步经营',
    '七杀': '压力与挑战并存，需加强执行与防风险',
    '正官': '规则与责任上升，适合稳扎稳打求进',
    '偏印': '学习与调整节奏，适合深耕内功',
    '正印': '贵人与学习运增强，适合充电与修复',
    '日主': '自我主导年度，适合夯实长期规划'
  }
  return mapping[tenGod] || '稳中求进，关注核心目标'
}

export function buildBaziYearReport(result: BaziComputeResult, year: number) {
  const dayStem = result.dayMaster.stem
  const { ganZhi, stem, branch } = getYearGanZhi(year)
  const yearElement = getElementCnByStem(stem)
  const yearTenGod = getTenGod(dayStem, stem)

  const dayun = result.luck?.daYun?.find((dy) => dy.startYear && dy.endYear && year >= dy.startYear && year <= dy.endYear)
    || result.luck?.daYun?.[0]

  const wuxingSummary = result.wuxing?.elements?.length
    ? result.wuxing.elements.map((e) => `${e.element}${e.percent}%`).join('，')
    : '暂无数据'

  const dayunSummary = dayun
    ? `大运 ${dayun.ganZhi}（${dayun.startYear ?? '--'}-${dayun.endYear ?? '--'}），十神为${dayun.tenGod}。`
    : '大运信息不足，建议补全起运数据后查看。'

  const lines: string[] = []
  lines.push(`2026年为${ganZhi}年，五行主${yearElement}，对应日主十神为「${yearTenGod}」。`)
  lines.push(`命盘日主为${dayStem}${getElementCnByStem(dayStem)}，日主${result.dayMaster.strength.level}，月令${result.dayMaster.season.status}。`)
  lines.push(`五行分布：${wuxingSummary}；偏旺为${result.wuxing.maxElement}，偏弱为${result.wuxing.minElement}。`)
  lines.push(`用神：${result.yongShen.use.join('、') || '--'}；喜神：${result.yongShen.favor.join('、') || '--'}；忌神：${result.yongShen.avoid.join('、') || '--'}。`)
  lines.push(dayunSummary)
  lines.push(`年度重点：${buildFocus(yearTenGod)}。建议多用「${result.yongShen.use.join('、') || '--'}」之气来平衡结构。`)

  const fullText = lines.join('\n\n')
  const previewText = lines.slice(0, 2).join('\n\n')

  return {
    year,
    ganZhi,
    stem,
    branch,
    yearElement,
    yearTenGod,
    fullText,
    previewText
  }
}
