export type Stem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸'
export type Branch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥'
export type SixGod = '青龙' | '朱雀' | '勾陈' | '腾蛇' | '白虎' | '玄武'
export type Relation = '父母' | '兄弟' | '妻财' | '官星' | '子孙'
export type TrigramName = '乾' | '坤' | '震' | '巽' | '坎' | '离' | '艮' | '兑'

export interface Yao {
  index: 1 | 2 | 3 | 4 | 5 | 6 // 上爻为1，下爻为6
  isYang: boolean // 阳爻（—）或阴爻（--）
  isMoving: boolean // 动爻（变爻）标记
  stem?: Stem // 纳甲后的天干
  branch?: Branch // 纳甲后的地支（或按派系规则生成）
  sixGod?: SixGod // 六神
  relation?: Relation // 六亲
  changsheng?: string // 长生十二宫状态
  seasonStrength?: '旺' | '相' | '休' | '囚' | '死' // 四时旺衰
  fiveElement?: '木' | '火' | '土' | '金' | '水'
  fuShen?: {
    stem?: Stem
    branch?: Branch
    relation?: Relation
  },
}

export interface Trigram {
  name: TrigramName
  yaos: [Yao, Yao, Yao] // 自下而上的三爻
}

export interface Hexagram {
  upper: Trigram // 上卦（三爻）
  lower: Trigram // 下卦（三爻）
  yaos: [Yao, Yao, Yao, Yao, Yao, Yao] // 六爻（自下到上）
  name?: string // 卦名（可选）
  palace?: string // 卦宫（八宫）
  palaceCategory?: string // 本宫/一世/游魂/归魂
  element?: string // 卦宫五行
  shiIndex?: number // 世爻索引（0 上爻-5 初爻）
  yingIndex?: number // 应爻索引
}

export interface NaJiaRule {
  // 每个八卦纳入的天干：可为单一天干或三位分配（下/中/上爻）
  trigramStem: Record<TrigramName, Stem | [Stem, Stem, Stem]>
  // 可选：为六爻排地支的序列（不同行派可覆盖）
  branchSequence?: Branch[]
}

export interface SixGodRule {
  // 依据日干或日支起六神
  baseBy: 'dayStem' | 'dayBranch'
  startByStem?: Record<Stem, SixGod>
  startByBranch?: Record<Branch, SixGod>
  // 六神循环顺序（自下而上）
  sequence: SixGod[]
}

export interface SchoolRuleSet {
  key: string
  name: string
  naJia: NaJiaRule
  sixGod: SixGodRule
  worldResponse?: 'byPosition' | 'byPalace' // 世应定位法占位
}

export interface ComputeOptions {
  ruleSetKey: string
  date?: Date
}
