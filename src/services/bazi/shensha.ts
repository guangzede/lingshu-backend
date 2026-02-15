import type { Branch, Stem } from '@/types/liuyao'
import { groupOfBranch } from '@/services/ganzhi/constants'
import { STEM_COMBINE, NAYIN, getNaYinElement } from './constants'
import { computeXunKong } from '@/services/ganzhi/shensha'

type PillarKey = 'year' | 'month' | 'day' | 'hour'
type PillarLabel = '年柱' | '月柱' | '日柱' | '时柱'

export type ShenShaKey =
  // 第一梯队
  | '天乙贵人'
  | '驿马'
  | '桃花'
  | '咸池'
  | '空亡'
  | '禄神'
  | '羊刃'
  | '魁罡'
  | '文昌贵人'
  | '华盖'
  | '将星'
  // 第二梯队
  | '天德贵人'
  | '月德贵人'
  | '天德合'
  | '月德合'
  | '太极贵人'
  | '学堂'
  | '词馆'
  | '国印贵人'
  | '金舆'
  | '天医'
  | '德秀贵人'
  | '天赦'
  | '天上三奇'
  | '地下三奇'
  | '人中三奇'
  | '福星贵人'
  | '节度贵人'
  // 第三梯队
  | '亡神'
  | '劫煞'
  | '元辰'
  | '孤辰'
  | '寡宿'
  | '阴阳差错'
  | '十恶大败'
  | '灾煞'
  | '流霞'
  | '红艳'
  | '四废'
  | '八专'
  | '九丑'
  | '天罗'
  | '地网'
  // 第四梯队
  | '金神'
  | '孤鸾'
  | '进神'
  | '退神'
  | '勾神'
  | '绞神'
  | '隔角'
  | '飞刃'
  | '丧门'
  | '吊客'
  | '披麻'
  | '披头'
  | '红鸾'
  | '天喜'
  | '天厨贵人'
  | '十灵日'
  | '童子煞'
  | '福星贵人'
  | '悬针'
  | '平头'
  | '阙槽'
  | '阑干'
  | '吞陷'
  // 第五梯队（小儿关煞）
  | '百日关'
  | '千日关'
  | '将军箭'
  | '落井关'
  | '铁扫帚'
  | '夜啼关'
  | '鬼门关'
  | '五鬼关'
  | '断桥关'
  | '汤火关'
  | '深水关'
  | '四柱关'
  | '急脚关'
  | '浴盆关'
  | '和尚关'
  | '雷公打脑关'
  | '阎王关'
  | '鸡飞关'
  | '取命关'
  | '白虎关'
  // 第六梯队
  | '截路空亡'
  | '天地转煞'
  | '十废'
  | '流害'
  | '破碎'
  | '的煞'
  | '墓库煞'

export type ShenShaToken = Branch | Stem | PillarLabel
export type ShenShaResult = Partial<Record<ShenShaKey, ShenShaToken[]>>

export interface BaziPillars {
  year: { stem: Stem; branch: Branch }
  month: { stem: Stem; branch: Branch }
  day: { stem: Stem; branch: Branch }
  hour: { stem: Stem; branch: Branch }
}

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

const TIAN_CHU: Record<Stem, Branch> = {
  '甲': '巳', '乙': '午',
  '丙': '巳', '丁': '午',
  '戊': '申', '己': '酉',
  '庚': '亥', '辛': '子',
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

const FEI_REN: Record<Stem, Branch> = {
  '甲': '丑', '乙': '寅',
  '丙': '午', '丁': '未',
  '戊': '午', '己': '未',
  '庚': '酉', '辛': '戌',
  '壬': '子', '癸': '丑'
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

const FU_XING: Record<Stem, Branch[]> = {
  '甲': ['寅', '子'],
  '丙': ['寅', '子'],
  '戊': ['申'],
  '己': ['未'],
  '丁': ['亥'],
  '乙': ['丑', '卯'],
  '癸': ['丑', '卯'],
  '庚': ['午'],
  '辛': ['巳'],
  '壬': ['辰']
}

const TIAN_DE: Record<Branch, Stem> = {
  '寅': '丁', '卯': '申', '辰': '壬', '巳': '辛',
  '午': '亥', '未': '甲', '申': '癸', '酉': '寅',
  '戌': '丙', '亥': '乙', '子': '巳', '丑': '庚'
}

const YUE_DE: Record<Branch, Stem> = {
  '寅': '甲', '卯': '甲', '辰': '丙', '巳': '丙',
  '午': '己', '未': '己', '申': '庚', '酉': '庚',
  '戌': '壬', '亥': '壬', '子': '癸', '丑': '癸'
}

const TAI_JI: Record<Stem, Branch[]> = {
  '甲': ['子', '午'], '乙': ['子', '午'],
  '丙': ['卯', '酉'], '丁': ['卯', '酉'],
  '戊': ['辰', '戌', '丑', '未'], '己': ['辰', '戌', '丑', '未'],
  '庚': ['寅', '亥'], '辛': ['寅', '亥'],
  '壬': ['巳', '申'], '癸': ['巳', '申']
}

const GUO_YIN: Record<Stem, Branch> = {
  '甲': '戌', '乙': '亥', '丙': '丑', '丁': '寅',
  '戊': '丑', '己': '寅', '庚': '辰', '辛': '巳',
  '壬': '未', '癸': '申'
}

const JIN_YU: Record<Stem, Branch> = {
  '甲': '辰', '乙': '巳', '丙': '未', '丁': '申',
  '戊': '未', '己': '申', '庚': '戌', '辛': '亥',
  '壬': '丑', '癸': '寅'
}

const XUE_TANG: Record<Stem, string[]> = {
  '甲': ['己亥'],
  '乙': ['壬午'],
  '丙': ['丙寅'],
  '丁': ['丁酉'],
  '戊': ['戊寅'],
  '己': ['己酉'],
  '庚': ['辛巳'],
  '辛': ['甲子'],
  '壬': ['壬申'],
  '癸': ['乙卯']
}

const CI_GUAN: Record<Stem, string[]> = {
  '甲': ['庚寅'],
  '乙': ['辛卯'],
  '丙': ['乙巳'],
  '丁': ['戊午'],
  '戊': ['丁巳'],
  '己': ['庚午'],
  '庚': ['壬申'],
  '辛': ['癸酉'],
  '壬': ['壬申'],
  '癸': ['癸酉']
}

const DE_XIU: Record<'寅午戌' | '申子辰' | '巳酉丑' | '亥卯未', { de: Stem[]; xiu: Stem[] }> = {
  '寅午戌': { de: ['丙', '丁'], xiu: ['戊', '癸'] },
  '申子辰': { de: ['壬', '癸'], xiu: ['丙', '辛'] },
  '巳酉丑': { de: ['庚', '辛'], xiu: ['乙', '庚'] },
  '亥卯未': { de: ['甲', '乙'], xiu: ['丁', '壬'] }
}

const TIAN_SHE: Record<'寅卯辰' | '巳午未' | '申酉戌' | '亥子丑', string[]> = {
  '寅卯辰': ['戊寅'],
  '巳午未': ['甲午'],
  '申酉戌': ['戊申'],
  '亥子丑': ['甲子']
}

const KUI_GANG: string[] = ['庚辰', '庚戌', '壬辰', '戊戌']
const YIN_YANG_CHA_CUO: string[] = ['丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳', '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥']
const SHI_E_DA_BAI: string[] = ['甲辰', '乙巳', '丙申', '丁酉', '戊戌', '己丑', '庚辰', '辛巳', '壬申', '癸酉']
const SHI_LING_RI: string[] = ['甲辰', '乙亥', '丙辰', '丁酉', '戊午', '庚寅', '庚戌', '辛亥', '壬寅', '癸未']
const BA_ZHUAN: string[] = ['甲寅', '乙卯', '己未', '丁未', '戊戌', '癸丑', '丙午', '壬子']
const JIU_CHOU: string[] = ['壬子', '壬午', '戊子', '戊午', '乙酉', '乙卯', '辛卯', '辛酉', '己卯', '己酉']
const SI_FEI: Record<'寅卯辰' | '巳午未' | '申酉戌' | '亥子丑', string[]> = {
  '寅卯辰': ['庚申', '辛酉'],
  '巳午未': ['壬子', '癸亥'],
  '申酉戌': ['甲寅', '乙卯'],
  '亥子丑': ['丙午', '丁巳']
}

const GU_LUAN: string[] = ['甲寅', '乙巳', '丙午', '丁巳', '戊午', '戊申', '辛亥', '壬子']
const XUAN_ZHEN: string[] = [
  '甲子', '丁卯', '庚午', '辛未', '壬申',
  '甲戌', '己卯', '辛巳', '壬午',
  '甲申', '辛卯',
  '甲午', '丙申', '辛丑', '癸卯',
  '甲辰', '丙午', '戊申', '辛亥',
  '甲寅', '乙卯', '戊午', '庚申', '辛酉'
]

const PING_TOU: string[] = ['甲子', '甲辰', '丙辰']
const JIN_SHEN: string[] = ['乙丑', '己巳', '癸酉']
const JIN_SHEN_ADVANCE: string[] = ['甲子', '甲午', '戊戌', '己卯', '己酉', '辛卯', '癸丑']
const JIN_SHEN_RETREAT: string[] = ['丁卯', '壬辰', '丁未']

const YUAN_CHEN: Record<'申子辰' | '亥卯未' | '寅午戌' | '巳酉丑', Branch> = {
  '申子辰': '未',
  '亥卯未': '申',
  '寅午戌': '丑',
  '巳酉丑': '寅'
}

const LIU_XIA: Record<Stem, Branch> = {
  '甲': '酉', '乙': '戌', '丙': '未', '丁': '申',
  '戊': '巳', '己': '丑', '庚': '亥', '辛': '子',
  '壬': '寅', '癸': '卯'
}

const HONG_YAN: Record<Stem, Branch> = {
  '甲': '午', '乙': '申', '丙': '寅', '丁': '未',
  '戊': '辰', '己': '辰', '庚': '戌', '辛': '酉',
  '壬': '子', '癸': '申'
}

const TIAN_LUO = ['戌', '亥']
const DI_WANG = ['辰', '巳']

const GOU_JIAO: Record<'申子辰' | '亥卯未' | '寅午戌' | '巳酉丑', { gou: Branch; jiao: Branch }> = {
  '申子辰': { gou: '戌', jiao: '寅' },
  '亥卯未': { gou: '丑', jiao: '巳' },
  '寅午戌': { gou: '未', jiao: '亥' },
  '巳酉丑': { gou: '辰', jiao: '申' }
}

const GE_JIAO: Record<Branch, Branch> = {
  '子': '卯', '丑': '辰', '寅': '巳', '卯': '午',
  '辰': '未', '巳': '申', '午': '酉', '未': '戌',
  '申': '亥', '酉': '子', '戌': '丑', '亥': '寅'
}

const SANG_MEN: Record<Branch, Branch> = {
  '子': '寅', '丑': '卯', '寅': '辰', '卯': '巳',
  '辰': '午', '巳': '未', '午': '申', '未': '酉',
  '申': '戌', '酉': '亥', '戌': '子', '亥': '丑'
}

const DIAO_KE: Record<Branch, Branch> = {
  '子': '戌', '丑': '亥', '寅': '子', '卯': '丑',
  '辰': '寅', '巳': '卯', '午': '辰', '未': '巳',
  '申': '午', '酉': '未', '戌': '申', '亥': '酉'
}

const PI_MA: Record<Branch, Branch> = {
  '子': '卯', '丑': '辰', '寅': '巳', '卯': '午',
  '辰': '未', '巳': '申', '午': '酉', '未': '戌',
  '申': '亥', '酉': '子', '戌': '丑', '亥': '寅'
}

const JIE_LU_KONG_WANG: Record<Stem, Branch[]> = {
  '甲': ['申', '酉'],
  '乙': ['申', '酉'],
  '丙': ['亥', '子'],
  '丁': ['亥', '子'],
  '戊': ['寅', '卯'],
  '己': ['寅', '卯'],
  '庚': ['巳', '午'],
  '辛': ['巳', '午'],
  '壬': ['辰', '戌'],
  '癸': ['辰', '戌']
}

const TIAN_DI_ZHUAN_SHA: Record<'寅卯辰' | '巳午未' | '申酉戌' | '亥子丑', string[]> = {
  '寅卯辰': ['乙卯', '辛卯'],
  '巳午未': ['丙午'],
  '申酉戌': ['辛酉', '癸酉'],
  '亥子丑': ['壬子', '丙子']
}

const SEASON_GROUP: Record<Branch, '寅卯辰' | '巳午未' | '申酉戌' | '亥子丑'> = {
  '寅': '寅卯辰',
  '卯': '寅卯辰',
  '辰': '寅卯辰',
  '巳': '巳午未',
  '午': '巳午未',
  '未': '巳午未',
  '申': '申酉戌',
  '酉': '申酉戌',
  '戌': '申酉戌',
  '亥': '亥子丑',
  '子': '亥子丑',
  '丑': '亥子丑'
}

const PILLAR_LABEL: Record<PillarKey, PillarLabel> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱'
}

function push(result: ShenShaResult, key: ShenShaKey, value?: ShenShaToken | ShenShaToken[]) {
  if (!value) return
  const list = Array.isArray(value) ? value : [value]
  const current = result[key] || []
  const merged = Array.from(new Set([...current, ...list]))
  result[key] = merged
}

export function computeBaziShenSha(pillars: BaziPillars): ShenShaResult {
  const result: ShenShaResult = {}
  const dayStem = pillars.day.stem
  const dayBranch = pillars.day.branch
  const monthBranch = pillars.month.branch
  const yearBranch = pillars.year.branch
  const yearStem = pillars.year.stem

  const pillarList = (['year', 'month', 'day', 'hour'] as PillarKey[]).map((key) => ({
    key,
    label: PILLAR_LABEL[key],
    stem: pillars[key].stem,
    branch: pillars[key].branch
  }))

  const addStemHit = (key: ShenShaKey, stem?: Stem) => {
    if (stem) push(result, key, stem)
  }

  const addBranchHit = (key: ShenShaKey, branch?: Branch) => {
    if (branch) push(result, key, branch)
  }

  const addBranchHits = (key: ShenShaKey, branches?: Branch[]) => {
    if (!branches) return
    branches.forEach((branch) => addBranchHit(key, branch))
  }

  const addPillarHit = (key: ShenShaKey, pillarKey: PillarKey) => {
    push(result, key, PILLAR_LABEL[pillarKey])
  }

  const addPillarMatch = (key: ShenShaKey, pillarKey: PillarKey, targets?: string[]) => {
    if (!targets) return
    const pillar = pillars[pillarKey]
    if (targets.includes(`${pillar.stem}${pillar.branch}`)) {
      addPillarHit(key, pillarKey)
    }
  }

  const addPillarMatchAny = (key: ShenShaKey, targets?: string[]) => {
    if (!targets) return
    pillarList.forEach((pillar) => {
      if (targets.includes(`${pillar.stem}${pillar.branch}`)) {
        addPillarHit(key, pillar.key)
      }
    })
  }

  const dayGroup = groupOfBranch(dayBranch)
  addBranchHit('桃花', TAO_HUA[dayGroup])
  addBranchHit('驿马', YI_MA[dayGroup])
  addBranchHit('将星', JIANG_XING[dayGroup])
  addBranchHit('华盖', HUA_GAI[dayGroup])
  addBranchHit('亡神', WANG_SHEN[dayGroup])
  addBranchHit('劫煞', JIE_SHA[dayGroup])
  addBranchHit('灾煞', ZAI_SHA[dayGroup])
  addBranchHit('元辰', YUAN_CHEN[dayGroup])

  addBranchHit('文昌贵人', WEN_CHANG[dayStem])
  addBranchHit('禄神', LU_SHEN[dayStem])
  addBranchHits('天乙贵人', TIAN_YI[dayStem])
  addBranchHit('咸池', XIAN_CHI[dayStem])
  addBranchHit('羊刃', YANG_REN[dayStem])
  addBranchHit('飞刃', FEI_REN[dayStem])
  addBranchHit('天厨贵人', TIAN_CHU[dayStem])

  const xunKong = computeXunKong(dayStem, dayBranch)
  xunKong.forEach((branch) => push(result, '空亡', branch))

  addPillarMatch('魁罡', 'day', KUI_GANG)
  addPillarMatch('阴阳差错', 'day', YIN_YANG_CHA_CUO)
  addPillarMatch('十恶大败', 'day', SHI_E_DA_BAI)
  addPillarMatch('十灵日', 'day', SHI_LING_RI)
  addPillarMatch('八专', 'day', BA_ZHUAN)
  addPillarMatch('九丑', 'day', JIU_CHOU)
  addPillarMatch('平头', 'day', PING_TOU)
  addPillarMatch('进神', 'day', JIN_SHEN_ADVANCE)
  addPillarMatch('退神', 'day', JIN_SHEN_RETREAT)

  const seasonGroup = SEASON_GROUP[monthBranch]
  const siFeiTargets = SI_FEI[seasonGroup]
  addPillarMatch('四废', 'day', siFeiTargets)

  addPillarMatchAny('悬针', XUAN_ZHEN)

  addPillarMatch('金神', 'day', JIN_SHEN)
  addPillarMatch('金神', 'hour', JIN_SHEN)

  addPillarMatch('孤鸾', 'day', GU_LUAN)
  addPillarMatch('孤鸾', 'hour', GU_LUAN)

  if (monthBranch) {
    addBranchHit('天医', TIAN_YI_MEDICINE[monthBranch])
  }

  if (yearBranch) {
    const gu = GU_CHEN_GUA_SU[yearBranch]
    if (gu) {
      addBranchHit('孤辰', gu.guChen)
      addBranchHit('寡宿', gu.guaSu)
    }
    addBranchHit('红鸾', HONG_LUAN[yearBranch])
    addBranchHit('天喜', TIAN_XI[yearBranch])
    addBranchHit('丧门', SANG_MEN[yearBranch])
    addBranchHit('吊客', DIAO_KE[yearBranch])
    addBranchHit('披麻', PI_MA[yearBranch])
    addBranchHit('披头', PI_MA[yearBranch])
  }

  const baseStems: Stem[] = Array.from(new Set([dayStem, yearStem]))
  baseStems.forEach((stem) => {
    addBranchHits('太极贵人', TAI_JI[stem])
    addBranchHit('国印贵人', GUO_YIN[stem])
    addBranchHit('金舆', JIN_YU[stem])
    addBranchHits('福星贵人', FU_XING[stem])
    addPillarMatchAny('学堂', XUE_TANG[stem])
    addPillarMatchAny('词馆', CI_GUAN[stem])
    addBranchHits('截路空亡', JIE_LU_KONG_WANG[stem])
  })

  if (monthBranch) {
    const tianDe = TIAN_DE[monthBranch]
    addStemHit('天德贵人', tianDe)
    const tianDeHe = tianDe ? STEM_COMBINE[tianDe] : undefined
    addStemHit('天德合', tianDeHe)

    const yueDe = YUE_DE[monthBranch]
    addStemHit('月德贵人', yueDe)
    const yueDeHe = yueDe ? STEM_COMBINE[yueDe] : undefined
    addStemHit('月德合', yueDeHe)

    const deXiu = DE_XIU[groupOfBranch(monthBranch)]
    if (deXiu) {
      deXiu.de.forEach((stem) => addStemHit('德秀贵人', stem))
      deXiu.xiu.forEach((stem) => addStemHit('德秀贵人', stem))
    }

    addPillarMatch('天赦', 'day', TIAN_SHE[seasonGroup])
    addPillarMatch('天地转煞', 'day', TIAN_DI_ZHUAN_SHA[seasonGroup])
  }

  const stemSeq = pillarList.map((p) => p.stem)
  const checkSanQi = (key: ShenShaKey, combo: Stem[]) => {
    for (let i = 0; i <= stemSeq.length - combo.length; i += 1) {
      if (combo.every((stem, idx) => stemSeq[i + idx] === stem)) {
        combo.forEach((_, idx) => addPillarHit(key, pillarList[i + idx].key))
      }
    }
  }
  checkSanQi('天上三奇', ['乙', '丙', '丁'])
  checkSanQi('地下三奇', ['辛', '壬', '癸'])
  checkSanQi('人中三奇', ['甲', '戊', '庚'])

  const yearNaYin = NAYIN[`${yearStem}${yearBranch}`]
  const yearElement = getNaYinElement(yearNaYin)
  const dayBranchValue = pillars.day.branch
  const hourBranchValue = pillars.hour.branch
  const checkTongzi = (branches: Branch[]) => {
    if (branches.includes(dayBranchValue)) addPillarHit('童子煞', 'day')
    if (branches.includes(hourBranchValue)) addPillarHit('童子煞', 'hour')
  }

  if (seasonGroup === '寅卯辰' || seasonGroup === '申酉戌') {
    checkTongzi(['寅', '子'])
  }
  if (seasonGroup === '巳午未' || seasonGroup === '亥子丑') {
    checkTongzi(['卯', '未', '辰'])
  }
  if (yearElement === '金' || yearElement === '木') {
    checkTongzi(['午', '卯'])
  }
  if (yearElement === '水' || yearElement === '火') {
    checkTongzi(['酉', '戌'])
  }
  if (yearElement === '土') {
    checkTongzi(['辰', '巳'])
  }

  if (yearElement === '火') {
    TIAN_LUO.forEach((branch) => addBranchHit('天罗', branch))
  }
  if (yearElement === '水') {
    DI_WANG.forEach((branch) => addBranchHit('地网', branch))
  }

  const gouJiao = GOU_JIAO[groupOfBranch(yearBranch)]
  if (gouJiao) {
    addBranchHit('勾神', gouJiao.gou)
    addBranchHit('绞神', gouJiao.jiao)
  }

  if (dayBranch) {
    addBranchHit('隔角', GE_JIAO[dayBranch])
  }

  addBranchHit('流霞', LIU_XIA[dayStem])
  addBranchHit('红艳', HONG_YAN[dayStem])

  return result
}
