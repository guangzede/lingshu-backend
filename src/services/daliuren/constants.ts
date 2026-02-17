import type { Branch, Stem } from '@/types/liuyao'

export const STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
export const BRANCHES: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

export const TIANJIANG_ORDER = [
  '贵人',
  '腾蛇',
  '朱雀',
  '六合',
  '勾陈',
  '青龙',
  '天空',
  '白虎',
  '太常',
  '玄武',
  '太阴',
  '天后'
] as const

export const KE_TI_HINTS: Record<string, string> = {
  '伏吟': '日支与时支相同，主事情反复或缓慢推进。',
  '反吟': '日支与时支相冲，多主变化或反复。',
  '贵人临时': '贵人得地，主助力明显。',
  '空亡临传': '三传落空，主虚耗或延迟。'
}
