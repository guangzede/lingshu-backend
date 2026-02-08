import type { Branch, Stem } from '@/types/liuyao'
import { BRANCH_ORDER, groupOfBranch } from './constants'

export type ShenShaKey =
  | '桃花'
  | '驿马'
  | '文昌贵人'
  | '禄神'
  | '天乙贵人'
  | '将星'
  | '华盖'
  | '天医'
  | '咸池'
  | '孤辰'
  | '寡宿'

export type ShenShaConfig = Record<ShenShaKey, Partial<Record<Stem | Branch | '申子辰' | '亥卯未' | '寅午戌' | '巳酉丑', Branch | Branch[] | { guChen: Branch; guaSu: Branch }>>>

export type ShenShaResult = Partial<Record<ShenShaKey, Branch[]>>

export const GU_CHEN_GUA_SU_CONFIG: Record<Branch, { guChen: Branch; guaSu: Branch }> = {
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

export const SHENSHA_CONFIG: ShenShaConfig = {
  桃花: { '申子辰': '酉', '亥卯未': '子', '寅午戌': '卯', '巳酉丑': '午' },
  驿马: { '申子辰': '寅', '亥卯未': '巳', '寅午戌': '申', '巳酉丑': '亥' },
  文昌贵人: { '甲': '巳', '乙': '午', '丙': '申', '丁': '酉', '戊': '申', '己': '酉', '庚': '亥', '辛': '子', '壬': '寅', '癸': '卯' },
  禄神: { '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午', '戊': '巳', '己': '午', '庚': '申', '辛': '酉', '壬': '亥', '癸': '子' },

// 甲戊庚牛羊    乙己鼠猴乡
// 丙丁猪鸡位    壬癸蛇兔藏
// 六辛逢马虎    此是贵人方
  天乙贵人: {
    '甲': ['丑', '未'], '乙': ['申', '子'], '丙': ['亥', '酉'],
    '戊': ['丑', '未'], '己': ['申', '子'], '丁': ['亥', '酉'],
    '庚': ['丑', '未'], '辛': ['巳', '酉'],
    '壬': ['巳', '卯'], '癸': ['巳', '卯']
  },
  将星: { '申子辰': '子', '亥卯未': '卯', '寅午戌': '午', '巳酉丑': '酉' },
  华盖: { '申子辰': '辰', '亥卯未': '未', '寅午戌': '戌', '巳酉丑': '丑' },
  天医: {
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
    '亥': '戌',
  },
  咸池: { '甲': '子', '乙': '巳', '丙': '卯', '丁': '申', '戊': '卯', '己': '申', '庚': '午', '辛': '亥', '壬': '酉', '癸': '寅' },
  孤辰: {} as any,
  寡宿: {} as any
}

export function computeShenSha(dayStem: Stem, dayBranch: Branch, monthBranch?: Branch, yearBranch?: Branch): ShenShaResult {
  const result: ShenShaResult = {}

  const setResult = (key: ShenShaKey, value: Branch | Branch[] | { guChen: Branch; guaSu: Branch }) => {
    if (typeof value === 'string') {
      result[key] = [value]
    } else if (Array.isArray(value)) {
      result[key] = value
    } else if (value && typeof value === 'object' && 'guChen' in value) {
      // 对于孤辰寡宿，直接设置单个值
      result[key] = [value.guChen]
    }
  }

  // 桃花/驿马/文昌贵人 将星/华盖: 基于日支三合局
  const dayGroup = groupOfBranch(dayBranch)

  const taoHua = SHENSHA_CONFIG['桃花'][dayGroup]
  if (taoHua) setResult('桃花', taoHua)

  const yiMa = SHENSHA_CONFIG['驿马'][dayGroup]
  if (yiMa) setResult('驿马', yiMa)

  const wenChang = SHENSHA_CONFIG['文昌贵人'][dayStem]
  if (wenChang) setResult('文昌贵人', wenChang)

  const jiangXing = SHENSHA_CONFIG['将星'][dayGroup]
  if (jiangXing) setResult('将星', jiangXing)

  const huaGai = SHENSHA_CONFIG['华盖'][dayGroup]
  if (huaGai) setResult('华盖', huaGai)

  // 禄神/天乙贵人: 基于日干
  const luShen = SHENSHA_CONFIG['禄神'][dayStem]
  if (luShen) setResult('禄神', luShen)

  const tianYi = SHENSHA_CONFIG['天乙贵人'][dayStem]
  if (tianYi) setResult('天乙贵人', tianYi)

  // 天医: 基于月支
  if (monthBranch) {
    const tianYiBranch = SHENSHA_CONFIG['天医'][monthBranch]
    if (tianYiBranch) setResult('天医', tianYiBranch)
  }

  // 咸池: 基于日干
  const xianChi = SHENSHA_CONFIG['咸池'][dayStem]
  if (xianChi) setResult('咸池', xianChi)

  // 孤辰寡宿: 基于年支
  if (yearBranch) {
    const guChenGuaSu = GU_CHEN_GUA_SU_CONFIG[yearBranch]
    if (guChenGuaSu) {
      setResult('孤辰', guChenGuaSu.guChen)
      setResult('寡宿', guChenGuaSu.guaSu)
    }
  }

  return result
}

export function computeXunKong(dayStem: Stem, dayBranch: Branch): Branch[] {
  const STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
  const BRANCHES: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

  const stemIndex = STEMS.indexOf(dayStem)
  const branchIndex = BRANCHES.indexOf(dayBranch)

  // 计算旬首（天干甲对应的地支）
  const xunStartBranchIndex = (branchIndex - stemIndex + 12) % 12

  // 旬空是旬首往前推两位的地支
  const kong1Index = (xunStartBranchIndex - 2 + 12) % 12
  const kong2Index = (xunStartBranchIndex - 1 + 12) % 12

  return [BRANCHES[kong1Index], BRANCHES[kong2Index]]
}
