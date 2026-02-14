/**
 * 六爻完整Tags计算模块
 * 整合：暗动、月破、日破、空亡、空亡填实、冲空实空、12长生、进神、退神、
 * 六合、六冲、三合、三刑、六害、合处逢冲、冲处逢合、墓库、入墓、出墓、
 * 回头生、回头克、伏藏与飞神生克、伏神临日月、伏神有气、六神得助、
 * 世应关系、爻位、游魂归魂卦、神煞、太岁、月将、贵人临爻、
 * 随鬼入墓、反吟、伏吟、用神忌神权重、动爻与静爻生克
 */

import type {
  Branch,
  Yao,
  SixGod,
  Stem,
  Relation,
} from '@/types/liuyao'

import type { ShenShaResult } from '@/services/ganzhi/shensha'
import { computeShenSha } from '@/services/ganzhi/shensha'

import {
  GENERATES,
  OVERCOMES,
  SIX_CLASH,
  SIX_HARMONY,
  TRIPLE_HARMONY,
  TRIPLE_PUNISHMENT,
  SIX_HARM,
  BRANCH_WUXING,
  CHANGSHENG_SEQ,
  CHANGSHENG_TABLE,
  DAY_BRANCH_GROUP,
  CN_TO_WUXING,
  type WuXing,
} from '@/services/ganzhi/constants'

export interface TagInfo {
  code: string
  label: string
  category: 'dynamic' | 'seasonal' | 'interaction' | 'mutation' | 'position' | 'spiritual'
  type: 'buff' | 'debuff' | 'neutral'
  description?: string
}

export interface YaoTagsResult {
  yaoIndex: number
  yaoLabel: string
  position: number
  branch?: Branch
  isMoving: boolean
  tags: TagInfo[]
}

export interface HexagramTagsResult {
  globalTags: TagInfo[]
  yaoTags: YaoTagsResult[]
  worldApplyRelation?: string
  hexInfo?: {
    name: string
    palace?: string
    isGhostHex?: boolean
    isReturningHex?: boolean
  }
}

/**
 * 主Tags计算器
 */
export class LiuyaoTagsCalculator {
  /**
   * 计算完整的tags
   * @param input 输入数据
   * @param shenShaResult 可选的已计算神煞结果（如果提供，将直接使用而不是重新计算，提高效率）
   */
  static calculate(input: {
    hexName?: string
    yaos: Array<Yao & { position?: number }>
    variantYaos?: Array<Yao>
    sixGods?: SixGod[]
    date: {
      dayStem: Stem
      dayBranch: Branch
      monthBranch: Branch
      voidBranches: Branch[]
    }
    timeGanZhi?: {
      year?: { stem: Stem; branch: Branch }
      month?: { stem: Stem; branch: Branch }
      day?: { stem: Stem; branch: Branch }
      hour?: { stem: Stem; branch: Branch }
    }
    hexInfo?: {
      palace?: string
      palaceCategory?: string
      shiIndex?: number
      yingIndex?: number
    }
  }, shenShaResult?: ShenShaResult): HexagramTagsResult {
    const result: HexagramTagsResult = {
      globalTags: [],
      yaoTags: [],
    }

    const { yaos, variantYaos = [], sixGods = [], date, hexName, timeGanZhi = {}, hexInfo } = input
    const { dayBranch, monthBranch, voidBranches } = date
    const shiIndex = this.normalizeIndex(hexInfo?.shiIndex, yaos.length)
    const yingIndex = this.normalizeIndex(hexInfo?.yingIndex, yaos.length)
    const indexMode = this.resolveIndexMode(yaos)

    // ========== 全局卦象Tags ==========
    const globalTags: TagInfo[] = []

    // 1. 游魂归魂卦判定
    const hexTags = this.analyzeHexType(hexInfo)
    globalTags.push(...hexTags)

    // 2. 世应关系
    const worldApplyTag = this.analyzeWorldApply(yaos, shiIndex, yingIndex, indexMode)
    if (worldApplyTag) {
      globalTags.push(worldApplyTag)
      result.worldApplyRelation = worldApplyTag.label
    }

    // 3. 神煞（太岁、月将、贵人等）
    // 如果没有传入预计算的shenShaResult，则自动计算
    // ⚠️ 注意：shenShaResult 应该是从 core.ts 的 computeAll 结果获取
    //    以避免重复计算。如果为空/未定义，则自动降级到本地计算
    const shenShaData = shenShaResult || (timeGanZhi?.day ?
      computeShenSha(timeGanZhi.day.stem, timeGanZhi.day.branch, timeGanZhi.month?.branch, timeGanZhi.year?.branch) :
      {})

    // 防御性检查：确保 shenShaData 是有效对象
    const validShenShaData: ShenShaResult = shenShaData && typeof shenShaData === 'object' ? shenShaData : {}
    const shenShaTaggs = this.analyzeShenSha(date, yaos, validShenShaData, timeGanZhi)
    globalTags.push(...shenShaTaggs)

    result.globalTags = globalTags
    if (hexName || hexInfo?.palace) {
      result.hexInfo = {
        name: hexName || '',
        palace: hexInfo?.palace,
        isGhostHex: hexInfo?.palaceCategory === '游魂',
        isReturningHex: hexInfo?.palaceCategory === '归魂',
      }
    }

    // ========== 爻位Tags ==========
    const yaoTags: YaoTagsResult[] = []

    for (let i = 0; i < yaos.length; i++) {
      const yao = yaos[i]
      const variantYao = variantYaos[i]
      const yaoElement = this.toWuXing(yao.fiveElement)
      const variantElement = variantYao?.fiveElement ? this.toWuXing(variantYao.fiveElement) : undefined
      const topIndex = this.getTopIndex(yao, i, indexMode)
      const position = topIndex + 1
      const yaoLabel = this.getYaoLabelByTopIndex(topIndex)

      const yaoTagsArray: TagInfo[] = []

      // 爻位信息
      const positionTag: TagInfo = {
        code: `YAO_POSITION_${position}`,
        label: yaoLabel,
        category: 'position',
        type: 'neutral',
        description: `此爻为${yaoLabel}`,
      }
      yaoTagsArray.push(positionTag)

      // 世应标记
      if (shiIndex === topIndex) {
        yaoTagsArray.push({
          code: 'WORLD_LINE',
          label: '世爻',
          category: 'position',
          type: 'neutral',
          description: '此爻为世爻，主自身与问事主体',
        })
      }
      if (yingIndex === topIndex) {
        yaoTagsArray.push({
          code: 'RESPOND_LINE',
          label: '应爻',
          category: 'position',
          type: 'neutral',
          description: '此爻为应爻，主对方与外在条件',
        })
      }

      // 2. 暗动 (日冲，旺相)
      if (!yao.isMoving && yao.branch) {
        const darkMovingTag = this.analyzeDarkMoving(yao.branch, dayBranch, yaoElement, monthBranch)
        if (darkMovingTag) yaoTagsArray.push(darkMovingTag)
      }

      // 3. 月破 (月令冲爻)
      if (yao.branch && yao.branch === SIX_CLASH[monthBranch]) {
        yaoTagsArray.push({
          code: 'MONTH_BREAK',
          label: '月破',
          category: 'seasonal',
          type: 'debuff',
          description: `此爻地支与月令相冲，为月破，本月气势受制，事象难以展开`,
        })
      }

      // 4. 日破 (日冲，休囚)
      if (yao.branch && yao.branch === SIX_CLASH[dayBranch]) {
        const strength = this.getSeasonStrength(yaoElement, monthBranch)
        if (['休', '囚', '死'].includes(strength)) {
          yaoTagsArray.push({
            code: 'DAY_BREAK',
            label: '日破',
            category: 'seasonal',
            type: 'debuff',
            description: `此爻被日支冲且处${strength}，为日破，当日多阻`,
          })
        }
      }

      // 5. 空亡 (旬空)
      if (yao.branch && voidBranches.includes(yao.branch)) {
        yaoTagsArray.push({
          code: 'VOID',
          label: '空亡',
          category: 'seasonal',
          type: 'neutral',
          description: '此爻逢旬空，气虚不实，事象难以落实',
        })

        // 5a. 空亡填实 (旬空遇冲)
        if (yao.isMoving && yao.branch === SIX_CLASH[dayBranch]) {
          yaoTagsArray.push({
            code: 'VOID_FILLED',
            label: '空亡填实',
            category: 'seasonal',
            type: 'buff',
            description: '此爻旬空又逢日冲（动爻），有填实之机，事象可转实',
          })
        }
      }

      // 6. 冲空实空
      if (yao.branch && voidBranches.includes(yao.branch) && !yao.isMoving) {
        const dayClashBranch = (Object.keys(SIX_CLASH) as Branch[]).find(
          (k) => SIX_CLASH[k] === dayBranch
        )
        if (dayClashBranch === yao.branch) {
          yaoTagsArray.push({
            code: 'CLASH_VOID_REAL_VOID',
            label: '冲空实空',
            category: 'seasonal',
            type: 'debuff',
            description: '此爻旬空且为静爻，又遭日冲，空象更甚，事多落空',
          })
        }
      }

      // 7. 12长生 (长生十二宫)
      if (yao.branch && yaoElement) {
        const changshengTag = this.analyzeChangsheng(yaoElement, yao.branch)
        if (changshengTag) yaoTagsArray.push(changshengTag)
      }

      // 8. 进神/退神 (化进/化退)
      if (yao.isMoving && yao.branch && variantYao?.branch && yaoElement && variantElement) {
        const advanceTag = this.analyzeAdvanceRetreat(
          yao.branch,
          variantYao.branch,
          yaoElement,
          variantElement,
          dayBranch,
          monthBranch,
          voidBranches,
          yao.isMoving
        )
        if (advanceTag) yaoTagsArray.push(advanceTag)
      }

      // 9. 六合、六冲、三刑、六害
      if (yao.branch) {
        const interactionTags = this.analyzeInteractions(yao.branch, yaos, i, dayBranch, monthBranch, indexMode)
        yaoTagsArray.push(...interactionTags)
      }

      // 10. 合处逢冲、冲处逢合
      if (yao.branch) {
        const complexInteractionTags = this.analyzeComplexInteractions(yao.branch, yaos, i)
        yaoTagsArray.push(...complexInteractionTags)
      }

      // 11. 墓库、入墓、出墓
      if (yao.branch && yaoElement) {
        const tombTags = this.analyzeTomb(yaoElement, yao.branch, variantYao?.branch, yao.isMoving)
        yaoTagsArray.push(...tombTags)
      }

      // 12. 回头生、回头克
      if (yao.isMoving && variantYao?.branch && yaoElement && variantElement) {
        const returnTags = this.analyzeReturningRelation(yaoElement, variantElement)
        yaoTagsArray.push(...returnTags)
      }

      // 13. 伏藏与飞神生克
      if (yao.branch && yaoElement) {
        const flyingHiddenTags = this.analyzeFlyingHidden(yaoElement, yaos)
        yaoTagsArray.push(...flyingHiddenTags)
      }

      // 14. 伏神临日月、伏神有气
      if (yao.branch) {
        const hiddenDeityTags = this.analyzeHiddenDeity(yao, dayBranch, monthBranch)
        yaoTagsArray.push(...hiddenDeityTags)
      }

      // 15. 六神得助：六神五行与爻支同气
      if (sixGods && sixGods[i] && yao.branch) {
        const godElement = this.getSixGodElement(sixGods[i])
        const branchElement = BRANCH_WUXING[yao.branch]
        if (godElement && branchElement && godElement === branchElement) {
          yaoTagsArray.push({
            code: `SIXGOD_SUPPORT_${sixGods[i]}`,
            label: `得神助`,
            category: 'spiritual',
            type: 'buff',
            description: `此爻六神与地支同气，得神助而势有扶持`,
          })
        }
      }

      // 16. 动爻与静爻生克
      if (yao.isMoving && yaoElement) {
        const relTags = this.analyzeMovingStaticRelation(yaoElement, yaos, i, indexMode)
        yaoTagsArray.push(...relTags)
      }

      // 17. 随鬼入墓
      if (yao.isMoving && variantYao?.branch && yaoElement) {
        const ghostTombTag = this.analyzeGhostInTomb(yao, variantYao.branch, yaoElement)
        if (ghostTombTag) yaoTagsArray.push(ghostTombTag)
      }

      // 18. 反吟、伏吟
      if (yao.branch && variantYao?.branch) {
        const yinTag = this.analyzeYinPattern(yao.branch, variantYao.branch)
        if (yinTag) yaoTagsArray.push(yinTag)
      }

      yaoTags.push({
        yaoIndex: i,
        yaoLabel,
        position,
        branch: yao.branch,
        isMoving: yao.isMoving,
        tags: yaoTagsArray,
      })
    }

    result.yaoTags = yaoTags
    return result
  }

  /**
   * 分析卦象类型（游魂、归魂）
   */
  private static analyzeHexType(hexInfo?: { palaceCategory?: string }): TagInfo[] {
    const tags: TagInfo[] = []

    const category = hexInfo?.palaceCategory
    if (category === '游魂') {
      tags.push({
        code: 'GHOST_HEX',
        label: '游魂卦',
        category: 'position',
        type: 'neutral',
        description: '本卦属游魂卦（八宫归类），魂气离位，事象漂泊反复、难定局',
      })
    } else if (category === '归魂') {
      tags.push({
        code: 'RETURNING_HEX',
        label: '归魂卦',
        category: 'position',
        type: 'neutral',
        description: '本卦属归魂卦（八宫归类），魂归本位，事象回转内敛、有归复之象',
      })
    }

    return tags
  }

  /**
   * 分析世应关系
   */
  private static analyzeWorldApply(
    yaos: Yao[],
    shiIndex: number | undefined,
    yingIndex: number | undefined,
    indexMode: 'top' | 'bottom'
  ): TagInfo | null {
    if (yaos.length < 6) return null
    if (shiIndex === undefined || yingIndex === undefined) return null

    const worldArrayIndex = this.getArrayIndexByTopIndex(yaos, shiIndex, indexMode)
    const applyArrayIndex = this.getArrayIndexByTopIndex(yaos, yingIndex, indexMode)
    if (worldArrayIndex === undefined || applyArrayIndex === undefined) return null

    const worldYao = yaos[worldArrayIndex]
    const applyYao = yaos[applyArrayIndex]
    if (!worldYao || !applyYao || !worldYao.branch || !applyYao.branch) return null

    const worldElement = this.toWuXing(worldYao.fiveElement)
    const applyElement = this.toWuXing(applyYao.fiveElement)
    const relation = this.getRelationName(worldElement, applyElement)
    const reverseRelation = this.getRelationName(applyElement, worldElement)

    let relationLabel = '世应无关'
    let description = '世应五行无生克，比助不明'
    let type: 'buff' | 'debuff' | 'neutral' = 'neutral'

    if (relation === '生') {
      relationLabel = '世生应'
      description = '世爻五行生应爻五行，我方对对方有扶持之势'
      type = 'buff'
    } else if (reverseRelation === '生') {
      relationLabel = '应生世'
      description = '应爻五行生世爻五行，外缘对我有扶助之势'
      type = 'buff'
    } else if (relation === '克') {
      relationLabel = '世克应'
      description = '世爻五行克应爻五行，我方对对方有制约之势'
      type = 'debuff'
    } else if (reverseRelation === '克') {
      relationLabel = '应克世'
      description = '应爻五行克世爻五行，外缘对我有制约之势'
      type = 'debuff'
    } else if (relation === '比') {
      relationLabel = '世应比和'
      description = '世应同气，比和相应，彼此对等'
      type = 'neutral'
    }

    return {
      code: 'WORLD_APPLY_RELATION',
      label: `世应：${relationLabel}`,
      category: 'position',
      type,
      description,
    }
  }

  /**
   * 分析暗动（日冲，旺相）
   */
  private static analyzeDarkMoving(
    yaoBranch: Branch,
    dayBranch: Branch,
    yaoElement: WuXing | undefined,
    monthBranch: Branch
  ): TagInfo | null {
    if (yaoBranch === SIX_CLASH[dayBranch]) {
      const strength = this.getSeasonStrength(yaoElement, monthBranch)
      if (['旺', '相'].includes(strength)) {
        return {
          code: 'DARK_MOVING',
          label: '暗动',
          category: 'dynamic',
          type: 'buff',
          description: `此爻为静爻，日支相冲且处于${strength}，暗中有动象，事势可能突变`,
        }
      }
    }
    return null
  }

  /**
   * 分析长生十二宫
   */
  private static analyzeChangsheng(element: WuXing, branch: Branch): TagInfo | null {
    const sequence = CHANGSHENG_TABLE[element]
    if (!sequence) return null

    const idx = sequence.indexOf(branch)
    if (idx === -1) return null

    // CHANGSHENG_SEQ 12个阶段
    const status = CHANGSHENG_SEQ[idx]
    const typeMap: Record<string, 'buff' | 'debuff' | 'neutral'> = {
      长生: 'buff',
      沐浴: 'neutral',
      绝: 'debuff',
      病: 'debuff',
      墓: 'neutral',
      库: 'neutral',
    }

    const descriptionMap: Record<string, string> = {
      长生: '此爻五行处于长生，气机生发，活力充足',
      沐浴: '此爻五行处于沐浴，主变化与波动，吉凶参半',
      冠带: '此爻五行处于冠带，初成其势，渐显其名',
      临官: '此爻五行处于临官，气势上行，权位可见',
      帝旺: '此爻五行处于帝旺，气势最盛，力量充足',
      衰: '此爻五行处于衰，气势渐退，力量下降',
      病: '此爻五行处于病，主阻滞与不顺',
      死: '此爻五行处于死，事象趋于终止',
      墓: '此爻五行处于墓，气势收藏，不易显露',
      绝: '此爻五行处于绝，气势断绝，事难续',
      胎: '此爻五行处于胎，事象酝酿未成',
      养: '此爻五行处于养，蓄势待发',
    }

    return {
      code: `CHANGSHENG_${status}`,
      label: `${status}`,
      category: 'seasonal',
      type: typeMap[status] || 'neutral',
      description: descriptionMap[status] || `此爻五行处于${status}状态`,
    }
  }

  /**
   * 分析进神/退神
   */
  private static analyzeAdvanceRetreat(
    baseBranch: Branch,
    variantBranch: Branch,
    baseElement: WuXing,
    variantElement: WuXing,
    dayBranch: Branch,
    monthBranch: Branch,
    voidBranches: Branch[],
    isMoving: boolean
  ): TagInfo | null {
    if (!isMoving) return null

    if (baseElement !== variantElement) return null

    const advanceMap: Record<WuXing, Partial<Record<Branch, Branch>>> = {
      wood: { 寅: '卯' },
      fire: { 巳: '午' },
      metal: { 申: '酉' },
      water: { 亥: '子' },
      earth: { 丑: '辰', 辰: '未', 未: '戌', 戌: '丑' },
    }

    const retreatMap: Record<WuXing, Partial<Record<Branch, Branch>>> = {
      wood: { 卯: '寅' },
      fire: { 午: '巳' },
      metal: { 酉: '申' },
      water: { 子: '亥' },
      earth: { 辰: '丑', 未: '辰', 戌: '未', 丑: '戌' },
    }

    const isAdvance = advanceMap[baseElement]?.[baseBranch] === variantBranch
    const isRetreat = retreatMap[baseElement]?.[baseBranch] === variantBranch

    if (!isAdvance && !isRetreat) return null

    const dayElement = BRANCH_WUXING[dayBranch]
    const monthElement = BRANCH_WUXING[monthBranch]

    const isClashedByDay = SIX_CLASH[dayBranch] === baseBranch || SIX_CLASH[dayBranch] === variantBranch
    const isClashedByMonth = SIX_CLASH[monthBranch] === baseBranch || SIX_CLASH[monthBranch] === variantBranch
    const isOvercomeByDay = OVERCOMES[dayElement] === baseElement
    const isOvercomeByMonth = OVERCOMES[monthElement] === baseElement
    const variantIsVoid = voidBranches.includes(variantBranch)
    const variantIsTomb = this.isTombBranch(baseElement, variantBranch)

    if (isAdvance) {
      if (isClashedByDay || isClashedByMonth || isOvercomeByDay || isOvercomeByMonth || variantIsVoid || variantIsTomb) {
        return {
          code: 'ADVANCE_GOD_WEAK',
          label: '进神受克',
          category: 'mutation',
          type: 'debuff',
          description: '此爻化进成立，但受冲克、空亡或入墓影响，进势受阻',
        }
      }

      return {
        code: 'ADVANCE_GOD',
        label: '进神',
        category: 'mutation',
        type: 'buff',
        description: '此爻动化进神，气势前行，事势推进',
      }
    }

    const supportedByDay = dayElement === baseElement || GENERATES[dayElement] === baseElement
    const supportedByMonth = monthElement === baseElement || GENERATES[monthElement] === baseElement
    const variantIsDayOrMonth = variantBranch === dayBranch || variantBranch === monthBranch

    if (supportedByDay || supportedByMonth || variantIsDayOrMonth) {
      return {
        code: 'RETREAT_GOD_HOLD',
        label: '退神不退',
        category: 'mutation',
        type: 'neutral',
        description: '此爻化退但得日月生扶或变爻临日月，退势被牵制',
      }
    }

    return {
      code: 'RETREAT_GOD',
      label: '退神',
      category: 'mutation',
      type: 'debuff',
      description: '此爻动化退神，气势退缩，事势减弱',
    }
  }

  /**
   * 分析地支相互关系
   */
  private static analyzeInteractions(
    yaoBranch: Branch,
    yaos: Yao[],
    yaoIndex: number,
    dayBranch: Branch,
    monthBranch: Branch,
    indexMode: 'top' | 'bottom'
  ): TagInfo[] {
    const tags: TagInfo[] = []

    // 与其他爻的关系
    for (let i = 0; i < yaos.length; i++) {
      if (i === yaoIndex) continue
      const otherBranch = yaos[i].branch
      if (!otherBranch) continue

      const otherLabel = this.getYaoLabelForYao(yaos[i], i, indexMode)
      // 六合
      if (SIX_HARMONY[yaoBranch] === otherBranch) {
        tags.push({
          code: `SIX_HARMONY_${i}`,
          label: `六合`,
          category: 'interaction',
          type: 'buff',
          description: `此爻与${otherLabel}六合，相合相生，事象趋于和合`,
        })
      }
      // 六冲
      else if (SIX_CLASH[yaoBranch] === otherBranch) {
        tags.push({
          code: `SIX_CLASH_${i}`,
          label: `六冲`,
          category: 'interaction',
          type: 'neutral',
          description: `此爻与${otherLabel}六冲，冲动多变，事象易起波澜`,
        })
      }
      // 三刑
      else if (TRIPLE_PUNISHMENT[yaoBranch]?.includes(otherBranch)) {
        tags.push({
          code: `TRIPLE_PUNISH_${i}`,
          label: `三刑`,
          category: 'interaction',
          type: 'debuff',
          description: `此爻与${otherLabel}三刑，相刑相伤，主阻滞与是非`,
        })
      }
      // 六害
      else if (this.checkHarm(yaoBranch, otherBranch)) {
        tags.push({
          code: `SIX_HARM_${i}`,
          label: `六害`,
          category: 'interaction',
          type: 'debuff',
          description: `此爻与${otherLabel}六害，暗损相害，易生隐患`,
        })
      }
    }

    // 三合局：动爻参与，与日辰/月令或他爻凑齐三者
    const currentYao = yaos[yaoIndex]
    const harmonyGroup = TRIPLE_HARMONY[yaoBranch]
    if (currentYao?.isMoving && harmonyGroup) {
      const helpers = new Set<Branch>()
      if (harmonyGroup.includes(dayBranch)) helpers.add(dayBranch)
      if (harmonyGroup.includes(monthBranch)) helpers.add(monthBranch)
      for (let i = 0; i < yaos.length; i++) {
        if (i === yaoIndex || !yaos[i].branch) continue
        if (harmonyGroup.includes(yaos[i].branch!)) {
          helpers.add(yaos[i].branch!)
        }
      }
      if (helpers.size >= 2) {
        tags.push({
          code: 'TRIPLE_HARMONY_FULL',
          label: '三合局',
          category: 'interaction',
          type: 'buff',
          description: '此动爻与日辰/月令或他爻凑齐三合局，气势成局',
        })
      }
    }

    // 与日月的关系
    if (SIX_HARMONY[yaoBranch] === dayBranch) {
      tags.push({
        code: 'HARMONY_DAY',
        label: `与日支合`,
        category: 'interaction',
        type: 'buff',
        description: `此爻地支与日支相合，当日得助，事象顺遂`,
      })
    }
    if (SIX_CLASH[yaoBranch] === dayBranch) {
      tags.push({
        code: 'CLASH_DAY',
        label: `与日支冲`,
        category: 'interaction',
        type: 'neutral',
        description: `此爻地支与日支相冲，当日易生变数`,
      })
    }

    if (SIX_HARMONY[yaoBranch] === monthBranch) {
      tags.push({
        code: 'HARMONY_MONTH',
        label: `与月令合`,
        category: 'interaction',
        type: 'buff',
        description: `此爻地支与月令相合，得月令生扶，气势旺盛`,
      })
    }

    return tags
  }

  /**
   * 分析复杂相互作用
   */
  private static analyzeComplexInteractions(yaoBranch: Branch, yaos: Yao[], yaoIndex: number): TagInfo[] {
    const tags: TagInfo[] = []

    // 合处逢冲：本爻与另一爻合，但这个另一爻被第三爻冲
    for (let i = 0; i < yaos.length; i++) {
      if (i === yaoIndex || !yaos[i].branch) continue

      if (SIX_HARMONY[yaoBranch] === yaos[i].branch) {
        // 现在检查 yaos[i] 是否被其他爻冲
        for (let j = 0; j < yaos.length; j++) {
          if (j === i || !yaos[j].branch) continue
          if (SIX_CLASH[yaos[i].branch!] === yaos[j].branch) {
            tags.push({
              code: 'HARMONY_MEET_CLASH',
              label: '合处逢冲',
              category: 'interaction',
              type: 'debuff',
              description: `此爻与他爻相合，但合爻又被第三爻冲破，合力受损`,
            })
          }
        }
      }
    }

    // 冲处逢合：本爻冲另一爻，但这个另一爻又与第三爻合
    for (let i = 0; i < yaos.length; i++) {
      if (i === yaoIndex || !yaos[i].branch) continue

      if (SIX_CLASH[yaoBranch] === yaos[i].branch) {
        for (let j = 0; j < yaos.length; j++) {
          if (j === i || !yaos[j].branch) continue
          if (SIX_HARMONY[yaos[i].branch!] === yaos[j].branch) {
            tags.push({
              code: 'CLASH_MEET_HARMONY',
              label: '冲处逢合',
              category: 'interaction',
              type: 'buff',
              description: `此爻与他爻相冲，但被冲之爻又与第三爻相合，冲势受牵`,
            })
          }
        }
      }
    }

    return tags
  }

  /**
   * 分析墓库
   */
  private static analyzeTomb(
    element: WuXing,
    branch: Branch,
    variantBranch: Branch | undefined,
    isMoving: boolean
  ): TagInfo[] {
    const tags: TagInfo[] = []
    const tomb = this.getTombBranch(element)
    if (!tomb) return tags

    // 入墓
    if (branch === tomb) {
      tags.push({
        code: 'INTO_TOMB',
        label: '入墓',
        category: 'seasonal',
        type: 'debuff',
        description: '此爻入墓，气势收藏，难以发挥',
      })
    }

    // 化墓、出墓
    if (isMoving && variantBranch === tomb) {
      tags.push({
        code: 'TRANSFORM_TOMB',
        label: '化墓',
        category: 'mutation',
        type: 'debuff',
        description: '此爻动化入墓，事象被收敛，进展受阻',
      })
    } else if (isMoving && branch === tomb) {
      tags.push({
        code: 'OUT_TOMB',
        label: '出墓',
        category: 'mutation',
        type: 'buff',
        description: '此爻动而出墓，气势释放，事象见转机',
      })
    }

    return tags
  }

  /**
   * 分析回头生克
   */
  private static analyzeReturningRelation(yaoElement: WuXing, variantElement: WuXing): TagInfo[] {
    const tags: TagInfo[] = []

    if (GENERATES[variantElement] === yaoElement) {
      tags.push({
        code: 'RETURN_BORN',
        label: '回头生',
        category: 'mutation',
        type: 'buff',
        description: '变爻五行生本爻，回头生，助力回补',
      })
    } else if (OVERCOMES[variantElement] === yaoElement) {
      tags.push({
        code: 'RETURN_KILL',
        label: '回头克',
        category: 'mutation',
        type: 'debuff',
        description: '变爻五行克本爻，回头克，反受牵制',
      })
    }

    return tags
  }

  /**
   * 分析飞伏生克
   */
  private static analyzeFlyingHidden(element: WuXing, yaos: Yao[]): TagInfo[] {
    const tags: TagInfo[] = []

    // 简化实现：飞神是动爻，伏神是被压在下面的爻
    // 这里返回元素相关的tag
    return tags
  }

  /**
   * 分析伏神相关
   */
  private static analyzeHiddenDeity(
    yao: Yao,
    dayBranch: Branch,
    monthBranch: Branch
  ): TagInfo[] {
    const tags: TagInfo[] = []
    const fuBranch = yao.fuShen?.branch
    if (!fuBranch) return tags

    // 伏神临日月
    if (fuBranch === dayBranch) {
      tags.push({
        code: 'HIDDEN_ON_DAY',
        label: '伏神临日',
        category: 'spiritual',
        type: 'buff',
        description: '此爻伏神临日支，隐事受日激发，易有显露',
      })
    }
    if (fuBranch === monthBranch) {
      tags.push({
        code: 'HIDDEN_ON_MONTH',
        label: '伏神临月',
        category: 'spiritual',
        type: 'buff',
        description: '此爻伏神临月令，隐事得月扶持，力量增强',
      })
    }

    // 伏神有气
    const fuElement = BRANCH_WUXING[fuBranch]
    if (fuElement) {
      const strength = this.getSeasonStrength(fuElement, monthBranch)
      if (['旺', '相'].includes(strength)) {
        tags.push({
          code: 'HIDDEN_HAS_QI',
          label: '伏神有气',
          category: 'spiritual',
          type: 'buff',
          description: `此爻伏神得月令${strength}，有气可用，隐事可成`,
        })
      }
    }

    return tags
  }

  /**
   * 分析六亲
   */
  private static analyzeSixRelatives(yao: Yao, dayStem: Stem): TagInfo | null {
    if (!yao.relation) return null

    const relativeMap: Record<Relation, string> = {
      父母: '父',
      官星: '官',
      妻财: '财',
      子孙: '子',
      兄弟: '兄',
    }

    const relative = relativeMap[yao.relation]
    if (!relative) return null

    return {
      code: `SIX_RELATIVE_${relative}`,
      label: `六亲：${relative}`,
      category: 'spiritual',
      type: 'neutral',
      description: `此爻为${relative}，代表相应的人事物象与关系`,
    }
  }

  /**
   * 分析动爻与静爻生克
   */
  private static analyzeMovingStaticRelation(
    element: WuXing,
    yaos: Yao[],
    yaoIndex: number,
    indexMode: 'top' | 'bottom'
  ): TagInfo[] {
    const tags: TagInfo[] = []

    for (let i = 0; i < yaos.length; i++) {
      if (i === yaoIndex || yaos[i].isMoving || !yaos[i].fiveElement) continue
      const otherElement = this.toWuXing(yaos[i].fiveElement)
      if (!otherElement) continue

      const relation = this.getRelationName(element, otherElement)

      const otherLabel = this.getYaoLabelForYao(yaos[i], i, indexMode)
      if (relation === '生') {
        tags.push({
          code: `MOVING_GENERATE_STATIC_${i}`,
          label: `动爻生${otherLabel}`,
          category: 'interaction',
          type: 'buff',
          description: `此动爻五行生${otherLabel}，对其有扶持促进之力`,
        })
      } else if (relation === '克') {
        tags.push({
          code: `MOVING_OVERCOME_STATIC_${i}`,
          label: `动爻克${otherLabel}`,
          category: 'interaction',
          type: 'debuff',
          description: `此动爻五行克${otherLabel}，对其有制约压迫之力`,
        })
      }
    }

    return tags
  }

  /**
   * 分析随鬼入墓
   */
  private static analyzeGhostInTomb(yao: Yao, variantBranch: Branch, element: WuXing | undefined): TagInfo | null {
    if (!element) return null
    if (yao.relation !== '官星') return null
    const tombMap: Record<WuXing, Branch> = {
      wood: '辰',
      fire: '未',
      earth: '戌',
      metal: '丑',
      water: '子',
    }

    if (tombMap[element] === variantBranch) {
      return {
        code: 'GHOST_INTO_TOMB',
        label: '随鬼入墓',
        category: 'seasonal',
        type: 'debuff',
        description: '官鬼动化入墓，凶象收敛，事势受阻',
      }
    }

    return null
  }

  /**
   * 分析反吟、伏吟
   */
  private static analyzeYinPattern(baseBranch: Branch, variantBranch: Branch): TagInfo | null {
    // 反吟：相冲
    if (SIX_CLASH[baseBranch] === variantBranch) {
      return {
        code: 'CONTRARY_YIN',
        label: '反吟',
        category: 'mutation',
        type: 'debuff',
        description: '此爻与变爻相冲，为反吟，主反复不定',
      }
    }

    // 伏吟：相同
    if (baseBranch === variantBranch) {
      return {
        code: 'HIDDEN_YIN',
        label: '伏吟',
        category: 'mutation',
        type: 'neutral',
        description: '此爻与变爻同支，为伏吟，主停滞反复',
      }
    }

    return null
  }

  /**
   * 分析神煞
   * @param date 日期信息（用于月将和太岁）
   * @param yaos 所有爻
   * @param shenShaResult 已计算的神煞结果（直接从 computeShenSha 的返回值）
   *                      ⚠️ 调用端应确保此数据已完全计算完成（同步获取）
   * @param timeGanZhi 时间干支信息（用于太岁）
   */
  private static analyzeShenSha(
    date: { dayBranch: Branch; monthBranch: Branch },
    yaos: Yao[],
    shenShaResult: ShenShaResult,
    timeGanZhi?: any
  ): TagInfo[] {
    const tags: TagInfo[] = []

    // 1. 太岁
    if (timeGanZhi?.year?.branch) {
      const yearBranch = timeGanZhi.year.branch
      for (const yao of yaos) {
        if (yao.branch === yearBranch) {
          tags.push({
            code: 'TAI_SUI',
            label: '太岁',
            category: 'spiritual',
            type: 'debuff',
            description: '太岁临爻，势大难犯，主权威与约束，宜谨慎而行',
          })
          break
        }
      }
    }

    // 2. 月将
    const monthTag: TagInfo = {
      code: 'MOON_GENERAL',
      label: `月将：${date.monthBranch}`,
      category: 'spiritual',
      type: 'neutral',
      description: `月建${date.monthBranch}为月将，主本月气势与指向，影响吉凶判断`,
    }
    tags.push(monthTag)

    // 3. 从 shenShaResult 中匹配所有神煞
    // 防御性编程：shenShaResult 必须是有效对象，否则跳过
    if (!shenShaResult || typeof shenShaResult !== 'object') {
      return tags
    }

    const shenShaKeyMap: Record<string, string> = {
      '桃花': 'TAO_HUA',
      '驿马': 'YI_MA',
      '文昌贵人': 'WEN_CHANG_NOBLE',
      '禄神': 'LU_SHEN',
      '天乙贵人': 'TIAN_YI_NOBLE',
      '将星': 'JIANG_XING',
      '华盖': 'HUA_GAI',
      '天医': 'TIAN_YI_MEDICINE',
      '咸池': 'XIAN_CHI',
      '孤辰': 'GU_CHEN',
      '寡宿': 'GUA_SU',
    }

    // 遍历每个爻，检查是否包含在神煞中
    for (let i = 0; i < yaos.length; i++) {
      if (!yaos[i].branch) continue
      const yaoBranch = yaos[i].branch!

      // 检查所有神煞配置
      for (const [key, branches] of Object.entries(shenShaResult)) {
        // 防御性检查：branches 必须是数组或 undefined
        if (!Array.isArray(branches)) {
          continue
        }

        if (branches.includes(yaoBranch)) {
          const codeKey = shenShaKeyMap[key] || key
          tags.push({
            code: `${codeKey}_${i}`,
            label: key,
            category: 'spiritual',
            type: this.getShenShaType(key),
            description: this.getShenShaDescription(key),
          })
        }
      }
    }

    return tags
  }

  /**
   * 根据神煞类型返回对应的标签类型
   */
  private static getShenShaType(shenShaKey: string): 'buff' | 'debuff' | 'neutral' {
    const buffMap: Record<string, 'buff' | 'debuff' | 'neutral'> = {
      '桃花': 'neutral',        // 桃花吉凶各半
      '驿马': 'neutral',        // 驿马主动
      '文昌贵人': 'buff',       // 文昌贵人为吉
      '禄神': 'buff',           // 禄神为吉
      '天乙贵人': 'buff',       // 天乙贵人为吉
      '将星': 'buff',           // 将星为吉
      '华盖': 'neutral',        // 华盖为中性
      '天医': 'buff',           // 天医为吉
      '咸池': 'debuff',         // 咸池为凶
      '孤辰': 'debuff',         // 孤辰为凶
      '寡宿': 'debuff',         // 寡宿为凶
    }
    return buffMap[shenShaKey] || 'neutral'
  }

  /**
   * 获取神煞的详细解说
   */
  private static getShenShaDescription(shenShaKey: string): string {
    const descriptionMap: Record<string, string> = {
      '桃花': '此爻逢桃花，主异性缘与感情波澜，吉凶各半，需兼看它象',
      '驿马': '此爻逢驿马，主动象强，主奔波、迁移与变动',
      '文昌贵人': '此爻逢文昌贵人，主聪慧名誉，利学业与事业',
      '禄神': '此爻逢禄神，主俸禄财利与官禄之象',
      '天乙贵人': '此爻逢天乙贵人，主贵人扶助，逢凶化吉',
      '将星': '此爻逢将星，主权势与领导力，利竞争突破',
      '华盖': '此爻逢华盖，主聪慧艺术，亦易清冷孤傲',
      '天医': '此爻逢天医，主医药救助，利病情好转',
      '咸池': '此爻逢咸池，主情欲与波动，需防情感风险',
      '孤辰': '此爻逢孤辰，主孤独离散，易感背离',
      '寡宿': '此爻逢寡宿，主孤寡冷局，不利和合',
    }
    return descriptionMap[shenShaKey] || '神煞'
  }

  // ========== 工具方法 ==========

  private static resolveIndexMode(yaos: Array<Yao & { position?: number }>): 'top' | 'bottom' {
    let topMatches = 0
    let bottomMatches = 0

    yaos.forEach((yao, i) => {
      if (typeof yao.index !== 'number') return
      const pos = typeof yao.position === 'number' ? yao.position : i + 1
      if (yao.index === pos) topMatches += 1
      if (yao.index + pos === 7) bottomMatches += 1
    })

    return bottomMatches > topMatches ? 'bottom' : 'top'
  }

  private static getTopPosition(
    yao: Yao & { position?: number },
    fallbackIndex: number,
    indexMode: 'top' | 'bottom'
  ): number {
    const raw = typeof yao.index === 'number'
      ? yao.index
      : (typeof yao.position === 'number' ? yao.position : fallbackIndex + 1)
    return indexMode === 'top' ? raw : 7 - raw
  }

  private static getTopIndex(
    yao: Yao & { position?: number },
    fallbackIndex: number,
    indexMode: 'top' | 'bottom'
  ): number {
    const pos = this.getTopPosition(yao, fallbackIndex, indexMode)
    return Math.max(0, Math.min(5, pos - 1))
  }

  private static getYaoLabelByTopIndex(index: number): string {
    const labels = ['上爻', '五爻', '四爻', '三爻', '二爻', '初爻']
    return labels[index] || `第${index + 1}爻`
  }

  private static getYaoLabelForYao(
    yao: Yao & { position?: number },
    fallbackIndex: number,
    indexMode: 'top' | 'bottom'
  ): string {
    const topIndex = this.getTopIndex(yao, fallbackIndex, indexMode)
    return this.getYaoLabelByTopIndex(topIndex)
  }

  private static getArrayIndexByTopIndex(
    yaos: Array<Yao & { position?: number }>,
    topIndex: number,
    indexMode: 'top' | 'bottom'
  ): number | undefined {
    for (let i = 0; i < yaos.length; i++) {
      if (this.getTopIndex(yaos[i], i, indexMode) === topIndex) {
        return i
      }
    }
    return undefined
  }

  private static normalizeIndex(index: number | undefined, length: number): number | undefined {
    if (typeof index !== 'number' || Number.isNaN(index)) return undefined
    if (index < 0 || index >= length) return undefined
    return index
  }

  private static toWuXing(element?: Yao['fiveElement']): WuXing | undefined {
    if (!element) return undefined
    return CN_TO_WUXING[element]
  }

  private static getTombBranch(element: WuXing): Branch | undefined {
    const tombMap: Record<WuXing, Branch> = {
      wood: '辰',
      fire: '未',
      earth: '戌',
      metal: '丑',
      water: '子',
    }

    return tombMap[element]
  }

  private static isTombBranch(element: WuXing, branch: Branch): boolean {
    return this.getTombBranch(element) === branch
  }

  private static checkHarm(a: Branch, b: Branch): boolean {
    return SIX_HARM[a] === b
  }

  private static getSeasonStrength(
    element: WuXing | undefined,
    monthBranch: Branch
  ): '旺' | '相' | '休' | '囚' | '死' {
    if (!element) return '休'
    const monthElement = BRANCH_WUXING[monthBranch]

    if (element === monthElement) return '旺'
    if (GENERATES[monthElement] === element) return '相'
    if (GENERATES[element] === monthElement) return '休'
    if (OVERCOMES[element] === monthElement) return '囚'
    return '死'
  }

  private static getRelationName(a: WuXing | undefined, b: WuXing | undefined): string {
    if (!a || !b) return '无'
    if (a === b) return '比'
    if (GENERATES[a] === b) return '生'
    if (OVERCOMES[a] === b) return '克'
    return '无'
  }

  private static getSixGodElement(god: SixGod): WuXing | undefined {
    const map: Record<SixGod, WuXing> = {
      青龙: 'wood',
      朱雀: 'fire',
      勾陈: 'earth',
      腾蛇: 'fire',
      白虎: 'metal',
      玄武: 'water',
    }
    return map[god]
  }
}

export default LiuyaoTagsCalculator
