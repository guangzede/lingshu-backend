import type { Branch, SixGod, Stem, TrigramName, SchoolRuleSet } from '@/types/liuyao'

export const STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
export const BRANCHES: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
export const SIX_GODS: SixGod[] = ['青龙', '朱雀', '勾陈', '腾蛇', '白虎', '玄武']
export const TRIGRAM_NAMES: TrigramName[] = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤']

// 常用八卦纳甲（基础）：乾甲、兑丁、离己、震庚、巽辛、坎戊、艮丙、坤乙
export const BASIC_TRIGRAM_STEM: Record<TrigramName, Stem | [Stem, Stem, Stem]> = {
  '乾': '甲',
  '兑': '丁',
  '离': '己',
  '震': '庚',
  '巽': '辛',
  '坎': '戊',
  '艮': '丙',
  '坤': '乙'
}

// 六神起例（按日干）：
// 甲乙→青龙；丙丁→朱雀；戊→勾陈；己→腾蛇；庚辛→白虎；壬癸→玄武
export const SIX_GOD_START_BY_STEM: Record<Stem, SixGod> = {
  '甲': '青龙', '乙': '青龙',
  '丙': '朱雀', '丁': '朱雀',
  '戊': '勾陈',
  '己': '腾蛇',
  '庚': '白虎', '辛': '白虎',
  '壬': '玄武', '癸': '玄武'
}

// 自下而上循环显示的六神顺序
export const SIX_GOD_SEQUENCE: SixGod[] = ['青龙', '朱雀', '勾陈', '腾蛇', '白虎', '玄武']

// 默认地支序列（占位，供不同派系覆盖）
export const DEFAULT_BRANCH_SEQUENCE: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳']

// 按八卦定义的六位地支排法（自下而上六位）。
// 已确认：乾六位为 子→寅→辰→午→申→戌。
// 其他卦位若未提供，将回退到 DEFAULT_BRANCH_SEQUENCE 循环。
export const TRIGRAM_BRANCH_SEQUENCE: Partial<Record<TrigramName, [Branch, Branch, Branch, Branch, Branch, Branch]>> = {
  '乾': ['子', '寅', '辰', '午', '申', '戌'],
  '坎': ['寅', '辰', '午', '申', '戌', '子'],
  '艮': ['辰', '午', '申', '戌', '子', '寅'],
  '震': ['子', '寅', '辰', '午', '申', '戌'],
  '巽': ['丑', '亥', '酉', '未', '巳', '卯'],
  '离': ['卯', '丑', '亥', '酉', '未', '巳'],
  '坤': ['未', '巳', '卯', '丑', '亥', '酉'],
  '兑': ['巳', '卯', '丑', '亥', '酉', '未']
}
// 按八卦定义的六位天干排法（自下而上六位）
// 仅用于支持复杂的纳甲规则，如果未定义，则回退到 trigramStem 的传统处理
export const TRIGRAM_STEM_SEQUENCE: Partial<Record<TrigramName, [Stem, Stem, Stem, Stem, Stem, Stem]>> = {
  '乾': ['甲', '甲', '甲', '壬', '壬', '壬'],
  '坎': ['戊', '戊', '戊', '戊', '戊', '戊'],
  '艮': ['丙', '丙', '丙', '丙', '丙', '丙'],
  '震': ['庚', '庚', '庚', '庚', '庚', '庚'],
  '巽': ['辛', '辛', '辛', '辛', '辛', '辛'],
  '离': ['己', '己', '己', '己', '己', '己'],
  '坤': ['乙', '乙', '乙', '癸', '癸', '癸'],
  '兑': ['丁', '丁', '丁', '丁', '丁', '丁']
}
export const DEFAULT_RULE_SET: SchoolRuleSet = {
  key: 'jingfang-basic',
  name: '京房基础',
  naJia: {
    trigramStem: BASIC_TRIGRAM_STEM,
    branchSequence: DEFAULT_BRANCH_SEQUENCE
  },
  sixGod: {
    baseBy: 'dayStem',
    startByStem: SIX_GOD_START_BY_STEM,
    sequence: SIX_GOD_SEQUENCE
  },
  worldResponse: 'byPosition'
}

export const RULE_SETS: Record<string, SchoolRuleSet> = {
  [DEFAULT_RULE_SET.key]: DEFAULT_RULE_SET
}
