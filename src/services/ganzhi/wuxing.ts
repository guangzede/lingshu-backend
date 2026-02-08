import type { Branch, Stem, Yao } from '@/types/liuyao'
import { BRANCH_ORDER, BRANCH_WUXING, CHANGSHENG_SEQ, CN_TO_WUXING, GENERATES, OVERCOMES, STEM_WUXING, WUXING_CN, type Changsheng, type WuXing } from './constants'

export function getRelation(src: WuXing, tgt: WuXing): 'generate' | 'overcome' | 'countered' | 'generated' | 'same'
export function getRelation(self: WuXing, yaoBranch?: Branch, yaoStem?: Stem): '父母' | '兄弟' | '子孙' | '妻财' | '官星' | undefined
export function getRelation(src: WuXing, tgt?: Branch | Stem | WuXing): any {
  if (typeof tgt === 'string' && ['wood', 'fire', 'earth', 'metal', 'water'].includes(tgt)) {
    // tgt is WuXing
    const me = src
    if (me === tgt) return '兄弟'
    if (GENERATES[me] === tgt) return '子孙'
    if (GENERATES[tgt as WuXing] === me) return '父母'
    if (OVERCOMES[me] === tgt) return '妻财'
    if (OVERCOMES[tgt as WuXing] === me) return '官星'
    return undefined
  } else {
    // tgt is Branch or Stem
    const other = tgt ? (BRANCH_WUXING[tgt as Branch] || STEM_WUXING[tgt as Stem]) : undefined
    if (!other) return undefined
    return getRelation(src, other)
  }
}

export function toWuXing(input?: string): WuXing | undefined {
  if (!input) return undefined
  if (input === '木' || input === '火' || input === '土' || input === '金' || input === '水') return CN_TO_WUXING[input]
  if (['wood', 'fire', 'earth', 'metal', 'water'].includes(input)) return input as WuXing
  return (STEM_WUXING as Record<string, WuXing>)[input] ?? (BRANCH_WUXING as Record<string, WuXing>)[input]
}

export function getSeasonElement(monthBranch: Branch): WuXing {
  if (['寅', '卯', '辰'].includes(monthBranch)) return 'wood'
  if (['巳', '午', '未'].includes(monthBranch)) return 'fire'
  if (['申', '酉', '戌'].includes(monthBranch)) return 'metal'
  return 'water' // 亥子丑
}

export function seasonStatus(monthBranch: Branch, target: WuXing): '旺' | '相' | '休' | '囚' | '死' {
  const season = getSeasonElement(monthBranch)
  if (season === target) return '旺'
  if (GENERATES[season] === target) return '相'
  if (GENERATES[target] === season) return '休'
  if (OVERCOMES[target] === season) return '囚'
  return '死'
}

export interface YaoInteraction {
  yaoIndex: number
  yaoLabel: string
  yaoInfo: string
  intraRelations: { otherIndex: number; otherLabel: string; relation: string }[]
  variantRelation?: string
}

export function analyzeYaoInteractions(baseYaos: Yao[], variantYaos: Yao[]): YaoInteraction[] {
  const labelMap: Record<number, string> = { 0: '上爻', 1: '五爻', 2: '四爻', 3: '三爻', 4: '二爻', 5: '初爻' }

  return baseYaos.map((yao, idx) => {
    const yaoInfo = yao.branch ? `${yao.branch}(${yao.fiveElement || '?'})` : '无支'
    const intraRelations: { otherIndex: number; otherLabel: string; relation: string }[] = []

    // 只处理有支且是动爻的情况
    if (yao.branch && yao.isMoving) {
      const yaoWuxing = BRANCH_WUXING[yao.branch]
      if (yaoWuxing) {
        // 与本卦其他爻的关系
        baseYaos.forEach((otherYao, otherIdx) => {
          if (otherIdx === idx || !otherYao.branch) return
          const otherWuxing = BRANCH_WUXING[otherYao.branch]
          if (otherWuxing) {
            if (GENERATES[yaoWuxing] === otherWuxing) {
              intraRelations.push({ otherIndex: otherIdx, otherLabel: labelMap[otherIdx], relation: '生' })
            } else if (OVERCOMES[yaoWuxing] === otherWuxing) {
              intraRelations.push({ otherIndex: otherIdx, otherLabel: labelMap[otherIdx], relation: '克' })
            }
          }
        })
      }
    }

    // 变卦同位爻的关系
    let variantRelation: string | undefined
    if (yao.branch && variantYaos[idx]?.branch) {
      const variantWuxing = BRANCH_WUXING[variantYaos[idx].branch]
      const yaoWuxing = BRANCH_WUXING[yao.branch]
      if (variantWuxing && yaoWuxing) {
        if (GENERATES[yaoWuxing] === variantWuxing) {
          variantRelation = `生变卦${labelMap[idx]}(${variantYaos[idx].branch})`
        } else if (OVERCOMES[yaoWuxing] === variantWuxing) {
          variantRelation = `克变卦${labelMap[idx]}(${variantYaos[idx].branch})`
        }
      }
    }

    return {
      yaoIndex: idx,
      yaoLabel: labelMap[idx],
      yaoInfo,
      intraRelations,
      variantRelation
    }
  })
}

export function assignChangsheng(dayStem: Stem, yaos: Yao[]): void {
  const changshengOrder: Record<'木' | '火' | '土' | '金' | '水', Branch[]> = {
    '木': ['亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌'],
    '火': ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'],
    '土': ['申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未'],
    '金': ['巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰'],
    '水': ['申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未']
  }

  const changshengNames: Changsheng[] = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养']

  yaos.forEach(yao => {
    if (yao.fiveElement && yao.branch) {
      const order = changshengOrder[yao.fiveElement as '木' | '火' | '土' | '金' | '水']
      const branchIndex = order.indexOf(yao.branch)
      if (branchIndex !== -1) {
        yao.changsheng = changshengNames[branchIndex]
      }
    }
  })
}

export function assignFiveElement(yaos: Yao[]): void {
  yaos.forEach(yao => {
    if (yao.branch) {
      yao.fiveElement = WUXING_CN[BRANCH_WUXING[yao.branch]]
    } else if (yao.stem) {
      yao.fiveElement = WUXING_CN[STEM_WUXING[yao.stem]]
    }
  })
}

export { STEM_WUXING, BRANCH_WUXING, GENERATES, OVERCOMES, type WuXing, type Changsheng }
