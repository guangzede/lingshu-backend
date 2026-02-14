import type { Branch, Stem } from '@/types/liuyao'
import { groupOfBranch } from '@/services/ganzhi/constants'

export type ShenShaKey =
  | '桃花'
  | '咸池'
  | '驿马'
  | '文昌贵人'
  | '禄神'
  | '天乙贵人'
  | '将星'
  | '华盖'
  | '天医'
  | '孤辰'
  | '寡宿'
  | '羊刃'
  | '亡神'
  | '劫煞'
  | '灾煞'
  | '红鸾'
  | '天喜'

export type ShenShaResult = Partial<Record<ShenShaKey, Branch[]>>

const TAO_HUA: Record<'申子辰' | '亥卯未' | '寅午戌' | '巳酉丑', Branch> = {
  '申子辰': '酉',
  '亥卯未': '子',
  '寅午戌': '卯',
  '巳酉丑': '午'
}

const YI_MA: Record<'申子辰' | '亥卯未' | '寅午戌' | '巳酉丑', Branch> = {
  '申子辰': '寅',
  '亥卯未': '巳',
  '寅午戌': '申',
  '巳酉丑': '亥'
}

const JIANG_XING: Record<'申子辰' | '亥卯未' | '寅午戌' | '巳酉丑', Branch> = {
  '申子辰': '子',
  '亥卯未': '卯',
  '寅午戌': '午',
  '巳酉丑': '酉'
}

const HUA_GAI: Record<'申子辰' | '亥卯未' | '寅午戌' | '巳酉丑', Branch> = {
  '申子辰': '辰',
  '亥卯未': '未',
  '寅午戌': '戌',
  '巳酉丑': '丑'
}

const WANG_SHEN: Record<'申子辰' | '亥卯未' | '寅午戌' | '巳酉丑', Branch> = {
  '申子辰': '亥',
  '亥卯未': '申',
  '寅午戌': '巳',
  '巳酉丑': '寅'
}

const JIE_SHA: Record<'申子辰' | '亥卯未' | '寅午戌' | '巳酉丑', Branch> = {
  '申子辰': '巳',
  '亥卯未': '寅',
  '寅午戌': '申',
  '巳酉丑': '亥'
}

const ZAI_SHA: Record<'申子辰' | '亥卯未' | '寅午戌' | '巳酉丑', Branch> = {
  '申子辰': '午',
  '亥卯未': '酉',
  '寅午戌': '子',
  '巳酉丑': '卯'
}

const WEN_CHANG: Record<Stem, Branch> = {
  '甲': '巳', '乙': '午', '丙': '申', '丁': '酉',
  '戊': '申', '己': '酉', '庚': '亥', '辛': '子',
  '壬': '寅', '癸': '卯'
}

const LU_SHEN: Record<Stem, Branch> = {
  '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午',
  '戊': '巳', '己': '午', '庚': '申', '辛': '酉',
  '壬': '亥', '癸': '子'
}

const TIAN_YI: Record<Stem, Branch[]> = {
  '甲': ['丑', '未'],
  '乙': ['申', '子'],
  '丙': ['亥', '酉'],
  '丁': ['亥', '酉'],
  '戊': ['丑', '未'],
  '己': ['申', '子'],
  '庚': ['丑', '未'],
  '辛': ['巳', '酉'],
  '壬': ['巳', '卯'],
  '癸': ['巳', '卯']
}

const XIAN_CHI: Record<Stem, Branch> = {
  '甲': '子', '乙': '巳', '丙': '卯', '丁': '申',
  '戊': '卯', '己': '申', '庚': '午', '辛': '亥',
  '壬': '酉', '癸': '寅'
}

const YANG_REN: Record<Stem, Branch> = {
  '甲': '卯', '乙': '寅',
  '丙': '午', '丁': '巳',
  '戊': '午', '己': '巳',
  '庚': '酉', '辛': '申',
  '壬': '子', '癸': '亥'
}

const TIAN_YI_MEDICINE: Record<Branch, Branch> = {
  '子': '亥',
  '丑': '子',
  '寅': '丑',
  '卯': '寅',
  '辰': '卯',
  '巳': '辰',
  '午': '巳',
  '未': '午',
  '申': '未',
  '酉': '申',
  '戌': '酉',
  '亥': '戌'
}

const GU_CHEN_GUA_SU: Record<Branch, { guChen: Branch; guaSu: Branch }> = {
  '亥': { guChen: '寅', guaSu: '戌' },
  '子': { guChen: '寅', guaSu: '戌' },
  '丑': { guChen: '寅', guaSu: '戌' },
  '寅': { guChen: '巳', guaSu: '丑' },
  '卯': { guChen: '巳', guaSu: '丑' },
  '辰': { guChen: '巳', guaSu: '丑' },
  '巳': { guChen: '申', guaSu: '辰' },
  '午': { guChen: '申', guaSu: '辰' },
  '未': { guChen: '申', guaSu: '辰' },
  '申': { guChen: '亥', guaSu: '未' },
  '酉': { guChen: '亥', guaSu: '未' },
  '戌': { guChen: '亥', guaSu: '未' }
}

const HONG_LUAN: Record<Branch, Branch> = {
  '子': '卯', '丑': '寅', '寅': '丑', '卯': '子',
  '辰': '亥', '巳': '戌', '午': '酉', '未': '申',
  '申': '未', '酉': '午', '戌': '巳', '亥': '辰'
}

const TIAN_XI: Record<Branch, Branch> = {
  '子': '酉', '丑': '申', '寅': '未', '卯': '午',
  '辰': '巳', '巳': '辰', '午': '卯', '未': '寅',
  '申': '丑', '酉': '子', '戌': '亥', '亥': '戌'
}

function push(result: ShenShaResult, key: ShenShaKey, value?: Branch | Branch[]) {
  if (!value) return
  const list = Array.isArray(value) ? value : [value]
  const current = result[key] || []
  const merged = Array.from(new Set([...current, ...list]))
  result[key] = merged
}

export function computeBaziShenSha(dayStem: Stem, dayBranch: Branch, monthBranch?: Branch, yearBranch?: Branch): ShenShaResult {
  const result: ShenShaResult = {}

  const group = groupOfBranch(dayBranch)
  push(result, '桃花', TAO_HUA[group])
  push(result, '驿马', YI_MA[group])
  push(result, '将星', JIANG_XING[group])
  push(result, '华盖', HUA_GAI[group])
  push(result, '亡神', WANG_SHEN[group])
  push(result, '劫煞', JIE_SHA[group])
  push(result, '灾煞', ZAI_SHA[group])

  push(result, '文昌贵人', WEN_CHANG[dayStem])
  push(result, '禄神', LU_SHEN[dayStem])
  push(result, '天乙贵人', TIAN_YI[dayStem])
  push(result, '咸池', XIAN_CHI[dayStem])
  push(result, '羊刃', YANG_REN[dayStem])

  if (monthBranch) {
    push(result, '天医', TIAN_YI_MEDICINE[monthBranch])
  }

  if (yearBranch) {
    const gu = GU_CHEN_GUA_SU[yearBranch]
    if (gu) {
      push(result, '孤辰', gu.guChen)
      push(result, '寡宿', gu.guaSu)
    }
    push(result, '红鸾', HONG_LUAN[yearBranch])
    push(result, '天喜', TIAN_XI[yearBranch])
  }

  return result
}
