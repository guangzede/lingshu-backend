import type { Branch, Stem } from '@/types/liuyao'
import { BRANCH_WUXING, GENERATES, OVERCOMES, STEM_WUXING, WUXING_CN, type WuXing } from '@/services/ganzhi/constants'

export const STEMS: Stem[] = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
export const BRANCHES: Branch[] = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']

export const STEM_YINYANG: Record<Stem, 'yang' | 'yin'> = {
  '甲': 'yang', '乙': 'yin',
  '丙': 'yang', '丁': 'yin',
  '戊': 'yang', '己': 'yin',
  '庚': 'yang', '辛': 'yin',
  '壬': 'yang', '癸': 'yin'
}

export const HIDDEN_STEMS: Record<Branch, Stem[]> = {
  '子': ['癸'],
  '丑': ['己', '癸', '辛'],
  '寅': ['甲', '丙', '戊'],
  '卯': ['乙'],
  '辰': ['戊', '乙', '癸'],
  '巳': ['丙', '庚', '戊'],
  '午': ['丁', '己'],
  '未': ['己', '丁', '乙'],
  '申': ['庚', '壬', '戊'],
  '酉': ['辛'],
  '戌': ['戊', '辛', '丁'],
  '亥': ['壬', '甲']
}

export const HIDDEN_WEIGHTS: Record<number, number[]> = {
  1: [1],
  2: [0.7, 0.3],
  3: [0.7, 0.2, 0.1]
}

export const JIA_ZI: string[] = Array.from({ length: 60 }, (_, i) => {
  const stem = STEMS[i % 10]
  const branch = BRANCHES[i % 12]
  return `${stem}${branch}`
})

const NAYIN_VALUES = [
  '海中金','炉中火','大林木','路旁土','剑锋金','山头火','涧下水','城头土','白蜡金','杨柳木',
  '泉中水','屋上土','霹雳火','松柏木','长流水','沙中金','山下火','平地木','壁上土','金箔金',
  '佛灯火','天河水','大驿土','钗钏金','桑柘木','大溪水','沙中土','天上火','石榴木','大海水'
]

export const NAYIN: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (let i = 0; i < 60; i++) {
    const pairIndex = Math.floor(i / 2)
    map[JIA_ZI[i]] = NAYIN_VALUES[pairIndex]
  }
  return map
})()

export function getNaYinElement(nayin?: string): '木' | '火' | '土' | '金' | '水' | undefined {
  if (!nayin) return undefined
  const last = nayin[nayin.length - 1] as any
  if (last === '木' || last === '火' || last === '土' || last === '金' || last === '水') return last
  return undefined
}

export const STEM_COMBINE: Record<Stem, Stem> = {
  '甲': '己', '己': '甲',
  '乙': '庚', '庚': '乙',
  '丙': '辛', '辛': '丙',
  '丁': '壬', '壬': '丁',
  '戊': '癸', '癸': '戊'
}

export const STEM_COMBINE_ELEMENT: Record<string, '木' | '火' | '土' | '金' | '水'> = {
  '甲己': '土',
  '乙庚': '金',
  '丙辛': '水',
  '丁壬': '木',
  '戊癸': '火'
}

export const THREE_HARMONY: Array<{ branches: Branch[]; element: '木' | '火' | '土' | '金' | '水' }> = [
  { branches: ['申', '子', '辰'], element: '水' },
  { branches: ['亥', '卯', '未'], element: '木' },
  { branches: ['寅', '午', '戌'], element: '火' },
  { branches: ['巳', '酉', '丑'], element: '金' }
]

export const THREE_MEET: Array<{ branches: Branch[]; element: '木' | '火' | '土' | '金' | '水' }> = [
  { branches: ['寅', '卯', '辰'], element: '木' },
  { branches: ['巳', '午', '未'], element: '火' },
  { branches: ['申', '酉', '戌'], element: '金' },
  { branches: ['亥', '子', '丑'], element: '水' }
]

export function getElementCnByStem(stem: Stem): '木' | '火' | '土' | '金' | '水' {
  return WUXING_CN[STEM_WUXING[stem]]
}

export function getElementCnByBranch(branch: Branch): '木' | '火' | '土' | '金' | '水' {
  return WUXING_CN[BRANCH_WUXING[branch]]
}

export function getGeneratedBy(element: WuXing): WuXing {
  const entries = Object.entries(GENERATES) as Array<[WuXing, WuXing]>
  const found = entries.find(([, v]) => v === element)
  return found ? found[0] : element
}

export function getOvercomedBy(element: WuXing): WuXing {
  const entries = Object.entries(OVERCOMES) as Array<[WuXing, WuXing]>
  const found = entries.find(([, v]) => v === element)
  return found ? found[0] : element
}
