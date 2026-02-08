import type { Branch, Stem } from '@/types/liuyao'

// ============= 五行相关常量 =============
export type WuXing = 'wood' | 'fire' | 'earth' | 'metal' | 'water'

export const STEM_WUXING: Record<Stem, WuXing> = {
  '甲': 'wood', '乙': 'wood', '丙': 'fire', '丁': 'fire', '戊': 'earth',
  '己': 'earth', '庚': 'metal', '辛': 'metal', '壬': 'water', '癸': 'water'
}

export const BRANCH_WUXING: Record<Branch, WuXing> = {
  '子': 'water', '丑': 'earth', '寅': 'wood', '卯': 'wood', '辰': 'earth', '巳': 'fire',
  '午': 'fire', '未': 'earth', '申': 'metal', '酉': 'metal', '戌': 'earth', '亥': 'water'
}

export const WUXING_CN: Record<WuXing, '木' | '火' | '土' | '金' | '水'> = {
  wood: '木', fire: '火', earth: '土', metal: '金', water: '水'
}

export const CN_TO_WUXING: Record<'木' | '火' | '土' | '金' | '水', WuXing> = {
  '木': 'wood', '火': 'fire', '土': 'earth', '金': 'metal', '水': 'water'
}

export const GENERATES: Record<WuXing, WuXing> = {
  wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood'
}

export const OVERCOMES: Record<WuXing, WuXing> = {
  wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood'
}

// ============= 地支关系常量 =============
export const SIX_HARMONY: Record<Branch, Branch> = {
  '子': '丑', '丑': '子',
  '寅': '亥', '亥': '寅',
  '卯': '戌', '戌': '卯',
  '辰': '酉', '酉': '辰',
  '巳': '申', '申': '巳',
  '午': '未', '未': '午'
}

export const SIX_CLASH: Record<Branch, Branch> = {
  '子': '午', '午': '子',
  '丑': '未', '未': '丑',
  '寅': '申', '申': '寅',
  '卯': '酉', '酉': '卯',
  '辰': '戌', '戌': '辰',
  '巳': '亥', '亥': '巳'
}

export const TRIPLE_HARMONY: Record<Branch, Branch[]> = {
  '申': ['子', '辰'], '子': ['申', '辰'], '辰': ['申', '子'],
  '寅': ['午', '戌'], '午': ['寅', '戌'], '戌': ['寅', '午'],
  '亥': ['卯', '未'], '卯': ['亥', '未'], '未': ['亥', '卯'],
  '巳': ['酉', '丑'], '酉': ['巳', '丑'], '丑': ['巳', '酉']
}

export const TRIPLE_PUNISHMENT: Record<Branch, Branch[]> = {
  '寅': ['巳', '申'], '巳': ['申', '寅'], '申': ['寅', '巳'],
  '丑': ['戌', '未'], '戌': ['未', '丑'], '未': ['丑', '戌'],
  '子': ['卯'], '卯': ['子'],
  '辰': ['辰'], '午': ['午'], '酉': ['酉'], '亥': ['亥']  // 自刑
}

// ============= 长生十二宫常量 =============
export const CHANGSHENG_SEQ = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'] as const
export type Changsheng = typeof CHANGSHENG_SEQ[number]

export const YANG_START: Branch = '亥' // 阳干起长生亥，顺行
export const YIN_START: Branch = '午'  // 阴干起长生午，逆行
export const BRANCH_ORDER: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

// ============= 三合局分组 =============
export const DAY_BRANCH_GROUP: Record<'申子辰' | '亥卯未' | '寅午戌' | '巳酉丑', Branch[]> = {
  '申子辰': ['申', '子', '辰'],
  '亥卯未': ['亥', '卯', '未'],
  '寅午戌': ['寅', '午', '戌'],
  '巳酉丑': ['巳', '酉', '丑']
}

export function groupOfBranch(b: Branch): keyof typeof DAY_BRANCH_GROUP {
  for (const k of Object.keys(DAY_BRANCH_GROUP) as Array<keyof typeof DAY_BRANCH_GROUP>) {
    if (DAY_BRANCH_GROUP[k].includes(b)) return k
  }
  return '申子辰'
}
