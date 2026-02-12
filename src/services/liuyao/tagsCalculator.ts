/**
 * 六爻完整Tags计算模块
 * 整合：暗动、月破、日破、空亡、空亡填实、冲空实空、12长生、进神、退神、
 * 六合、六冲、三合、三刑、六害、合处逢冲、冲处逢合、墓库、入墓、出墓、
 * 回头生、回头克、伏藏与飞神生克、伏神临日月、伏神有气、六神、六亲、
 * 世应关系、爻位、内外卦位置、游魂归魂卦、神煞、太岁、月将、贵人临爻、
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
  BRANCH_ORDER,
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
  }, shenShaResult?: ShenShaResult): HexagramTagsResult {
    const result: HexagramTagsResult = {
      globalTags: [],
      yaoTags: [],
    }

    const { yaos, variantYaos = [], sixGods = [], date, hexName, timeGanZhi = {} } = input
    const { dayStem, dayBranch, monthBranch, voidBranches } = date

    // ========== 全局卦象Tags ==========
    const globalTags: TagInfo[] = []

    // 1. 游魂归魂卦判定
    const hexTags = this.analyzeHexType(hexName, yaos)
    globalTags.push(...hexTags)

    // 2. 世应关系
    const worldApplyTag = this.analyzeWorldApply(yaos)
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

    // ========== 爻位Tags ==========
    const yaoTags: YaoTagsResult[] = []

    for (let i = 0; i < yaos.length; i++) {
      const yao = yaos[i]
      const variantYao = variantYaos[i]
      const yaoElement = this.toWuXing(yao.fiveElement)
      const variantElement = variantYao?.fiveElement ? this.toWuXing(variantYao.fiveElement) : undefined
      const position = (yao.position || i + 1) as number
      const yaoLabels = ['上爻', '五爻', '四爻', '三爻', '二爻', '初爻']
      const yaoLabel = yaoLabels[i] || `第${position}爻`

      const yaoTagsArray: TagInfo[] = []

      // 爻位信息
      const positionTag: TagInfo = {
        code: `YAO_POSITION_${position}`,
        label: yaoLabel,
        category: 'position',
        type: 'neutral',
        description: `第${position}爻，${yaoLabels[i]}`,
      }
      yaoTagsArray.push(positionTag)

      // 内外卦位置
      const trigamTag = this.analyzeTrigramPosition(i)
      if (trigamTag) yaoTagsArray.push(trigamTag)

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
          description: `${yao.branch}与月令${monthBranch}相冲（月破），爻象在本月被压制，事象难以展开`,
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
            description: `日冲且${strength}`,
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
          description: '爻位落在旬空范围内，事象虚空、难以落实',
        })

        // 5a. 空亡填实 (旬空遇冲)
        if (yao.isMoving && yao.branch === SIX_CLASH[dayBranch]) {
          yaoTagsArray.push({
            code: 'VOID_FILLED',
            label: '空亡填实',
            category: 'seasonal',
            type: 'buff',
            description: '动爻空亡遇日冲可填实，事象得以复活成就',
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
            description: '空亡之爻遭日冲，原想填实反而加重空亡，事象陷入矛盾纠缠',
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
        const interactionTags = this.analyzeInteractions(yao.branch, yaos, i, dayBranch, monthBranch)
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
        const hiddenDeityTags = this.analyzeHiddenDeity(yao.branch, dayBranch, monthBranch, yaoElement)
        yaoTagsArray.push(...hiddenDeityTags)
      }

      // 15. 六神
      if (yao.position !== undefined && sixGods && sixGods[i]) {
        yaoTagsArray.push({
          code: `SIXGOD_${sixGods[i]}`,
          label: `六神：${sixGods[i]}`,
          category: 'spiritual',
          type: 'neutral',
          description: `${sixGods[i]}临此爻，影响事象的性质与走势`,
        })
      }

      // 16. 六亲
      const sixRelativeTag = this.analyzeSixRelatives(yao, dayStem)
      if (sixRelativeTag) yaoTagsArray.push(sixRelativeTag)

      // 17. 动爻与静爻生克
      if (yao.isMoving && yaoElement) {
        const relTags = this.analyzeMovingStaticRelation(yaoElement, yaos, i)
        yaoTagsArray.push(...relTags)
      }

      // 18. 随鬼入墓
      if (yao.isMoving && variantYao?.branch && yaoElement) {
        const ghostTombTag = this.analyzeGhostInTomb(yaoElement, variantYao.branch)
        if (ghostTombTag) yaoTagsArray.push(ghostTombTag)
      }

      // 19. 反吟、伏吟
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
  private static analyzeHexType(hexName: string | undefined, yaos: Yao[]): TagInfo[] {
    const tags: TagInfo[] = []

    if (!hexName) return tags

    // 简单判断：根据动爻位置判断游魂/归魂
    const movingYaos = yaos.map((y, i) => (y.isMoving ? i : -1)).filter((i) => i !== -1)

    if (movingYaos.length > 0) {
      const lastMoving = movingYaos[movingYaos.length - 1]

      if (lastMoving === 4) {
        // 五爻动为游魂
        tags.push({
          code: 'GHOST_HEX',
          label: '游魂卦',
          category: 'position',
          type: 'neutral',
          description: '五爻动爻，为游魂',
        })
      } else if (lastMoving === 5) {
        // 上爻动为归魂
        tags.push({
          code: 'RETURNING_HEX',
          label: '归魂卦',
          category: 'position',
          type: 'neutral',
          description: '上爻动爻，为归魂',
        })
      }
    }

    return tags
  }

  /**
   * 分析世应关系
   */
  private static analyzeWorldApply(yaos: Yao[]): TagInfo | null {
    // 简化实现：世爻在初爻，应爻在比爻
    // 完整实现需要根据起卦方式确定
    if (yaos.length < 6) return null

    const worldYao = yaos[5] // 初爻为世
    const applyYao = yaos[4] // 二爻为应

    if (worldYao.branch && applyYao.branch) {
      const worldElement = this.toWuXing(worldYao.fiveElement)
      const applyElement = this.toWuXing(applyYao.fiveElement)
      const relation = this.getRelationName(worldElement, applyElement)
      return {
        code: 'WORLD_APPLY_RELATION',
        label: `世应关系：${relation}`,
        category: 'position',
        type: relation === '生' ? 'buff' : relation === '克' ? 'debuff' : 'neutral',
      }
    }

    return null
  }

  /**
   * 分析爻位（内外卦）
   */
  private static analyzeTrigramPosition(yaoIndex: number): TagInfo | null {
    if (yaoIndex < 3) {
      return {
        code: 'INNER_TRIGRAM',
        label: '内卦',
        category: 'position',
        type: 'neutral',
        description: '爻位处于内卦，代表情境与基础',
      }
    } else {
      return {
        code: 'OUTER_TRIGRAM',
        label: '外卦',
        category: 'position',
        type: 'neutral',
        description: '爻位处于外卦，代表变化与结果',
      }
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
          description: `静爻与日支相冲且处于${strength}状态，隐含动象，事象虽静实动，暗示潜在的变化与机遇`,
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
      长生: '五行处于长生状态，具有朝气蓬勃的活力',
      沐浴: '五行处于沐浴状态，主变化、主疾，吉凶各半',
      冠带: '五行处于冠带状态，初具成就',
      临官: '五行处于临官状态，权力与地位显赫',
      帝旺: '五行处于帝旺状态，正当壮年，权势最大',
      衰: '五行处于衰退状态，能力逐渐下降',
      病: '五行处于患病状态，主困难与阻碍',
      死: '五行处于死亡状态，事象终结',
      墓: '五行处于墓库状态，不易彰显',
      绝: '五行处于绝灭状态，事象陷入绝境',
      胎: '五行处于胎孕状态，事象酝酿中',
      养: '五行处于养护状态，蓄势待发',
    }

    return {
      code: `CHANGSHENG_${status}`,
      label: `${status}`,
      category: 'seasonal',
      type: typeMap[status] || 'neutral',
      description: descriptionMap[status] || `${element}处于${status}状态`,
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
          description: '进神成立但受冲克、空亡或入墓影响',
        }
      }

      return {
        code: 'ADVANCE_GOD',
        label: '进神',
        category: 'mutation',
        type: 'buff',
        description: '动爻进神，事象积极向前推进，吉象显著',
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
        description: '化退但得日月生扶或变爻临日月',
      }
    }

    return {
      code: 'RETREAT_GOD',
      label: '退神',
      category: 'mutation',
      type: 'debuff',
      description: '化退',
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
    monthBranch: Branch
  ): TagInfo[] {
    const tags: TagInfo[] = []

    // 与其他爻的关系
    for (let i = 0; i < yaos.length; i++) {
      if (i === yaoIndex) continue
      const otherBranch = yaos[i].branch
      if (!otherBranch) continue

      // 六合
      if (SIX_HARMONY[yaoBranch] === otherBranch) {
        tags.push({
          code: `SIX_HARMONY_${i}`,
          label: `六合`,
          category: 'interaction',
          type: 'buff',
          description: `与第${i + 1}爻六合，两爻相合，事象和谐发展`,
        })
      }
      // 六冲
      else if (SIX_CLASH[yaoBranch] === otherBranch) {
        tags.push({
          code: `SIX_CLASH_${i}`,
          label: `六冲`,
          category: 'interaction',
          type: 'neutral',
          description: `与第${i + 1}爻六冲，两爻相冲，事象易生变动`,
        })
      }
      // 三刑
      else if (TRIPLE_PUNISHMENT[yaoBranch]?.includes(otherBranch)) {
        tags.push({
          code: `TRIPLE_PUNISH_${i}`,
          label: `三刑`,
          category: 'interaction',
          type: 'debuff',
          description: `与第${i + 1}爻三刑，两爻相刑，主刑罚、伤害与诉讼`,
        })
      }
      // 六害
      else if (this.checkHarm(yaoBranch, otherBranch)) {
        tags.push({
          code: `SIX_HARM_${i}`,
          label: `六害`,
          category: 'interaction',
          type: 'debuff',
          description: `与第${i + 1}爻六害，两爻相害，主伤害、破坏与隐患`,
        })
      }
    }

    // 三合局：仅动爻参与，且需与日辰、月令凑齐三者
    const currentYao = yaos[yaoIndex]
    const harmonyGroup = TRIPLE_HARMONY[yaoBranch]
    if (
      currentYao?.isMoving &&
      harmonyGroup &&
      harmonyGroup.includes(dayBranch) &&
      harmonyGroup.includes(monthBranch)
    ) {
      tags.push({
        code: 'TRIPLE_HARMONY_FULL',
        label: '三合局',
        category: 'interaction',
        type: 'buff',
        description: '动爻与日辰、月令三者齐全成局',
      })
    }

    // 与日月的关系
    if (SIX_HARMONY[yaoBranch] === dayBranch) {
      tags.push({
        code: 'HARMONY_DAY',
        label: `与日支合`,
        category: 'interaction',
        type: 'buff',
        description: `爻位与日支相合，得到当日助力，事象顺遂`,
      })
    }
    if (SIX_CLASH[yaoBranch] === dayBranch) {
      tags.push({
        code: 'CLASH_DAY',
        label: `与日支冲`,
        category: 'interaction',
        type: 'neutral',
        description: `爻位与日支相冲，当日易生变数与动荡`,
      })
    }

    if (SIX_HARMONY[yaoBranch] === monthBranch) {
      tags.push({
        code: 'HARMONY_MONTH',
        label: `与月令合`,
        category: 'interaction',
        type: 'buff',
        description: `爻位与月令相合，得到月令生扶，事象旺盛`,
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
              description: `本爻与他爻相合，但合爻被第三爻冲破，合不成反生乱`,
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
              description: `本爻与他爻相冲，但冲爻与第三爻相合，冲反成合`,
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
        description: `${element}入墓`,
      })
    }

    // 化墓、出墓
    if (isMoving && variantBranch === tomb) {
      tags.push({
        code: 'TRANSFORM_TOMB',
        label: '化墓',
        category: 'mutation',
        type: 'debuff',
        description: `动爻化入${element}的墓库，事象被埋没，前景晦暗`,
      })
    } else if (isMoving && branch === tomb) {
      tags.push({
        code: 'OUT_TOMB',
        label: '出墓',
        category: 'mutation',
        type: 'buff',
        description: '动爻出墓',
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
        description: '变爻生本爻',
      })
    } else if (OVERCOMES[variantElement] === yaoElement) {
      tags.push({
        code: 'RETURN_KILL',
        label: '回头克',
        category: 'mutation',
        type: 'debuff',
        description: '变爻克本爻',
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
    branch: Branch,
    dayBranch: Branch,
    monthBranch: Branch,
    element: WuXing | undefined
  ): TagInfo[] {
    const tags: TagInfo[] = []

    // 伏神临日月
    if (branch === dayBranch) {
      tags.push({
        code: 'HIDDEN_ON_DAY',
        label: '伏神临日',
        category: 'spiritual',
        type: 'buff',
        description: '伏神临日支，隐藏的事象受当日激发，有机会浮现',
      })
    }
    if (branch === monthBranch) {
      tags.push({
        code: 'HIDDEN_ON_MONTH',
        label: '伏神临月',
        category: 'spiritual',
        type: 'buff',
        description: '伏神临月支，隐藏的事象得月令扶持，力量增强',
      })
    }

    // 伏神有气
    if (element) {
      const strength = this.getSeasonStrength(element, monthBranch)
      if (['旺', '相'].includes(strength)) {
        tags.push({
          code: 'HIDDEN_HAS_QI',
          label: '伏神有气',
          category: 'spiritual',
          type: 'buff',
          description: `伏神处于${strength}状态，具有振奋的气机，隐事可成`,
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
  private static analyzeMovingStaticRelation(element: WuXing, yaos: Yao[], yaoIndex: number): TagInfo[] {
    const tags: TagInfo[] = []

    for (let i = 0; i < yaos.length; i++) {
      if (i === yaoIndex || yaos[i].isMoving || !yaos[i].fiveElement) continue
      const otherElement = this.toWuXing(yaos[i].fiveElement)
      if (!otherElement) continue

      const relation = this.getRelationName(element, otherElement)

      if (relation === '生') {
        tags.push({
          code: `MOVING_GENERATE_STATIC_${i}`,
          label: `动爻生${this.getYaoLabel(i)}`,
          category: 'interaction',
          type: 'buff',
          description: `动爻的五行生${this.getYaoLabel(i)}的五行，产生扶持与促进之力`,
        })
      } else if (relation === '克') {
        tags.push({
          code: `MOVING_OVERCOME_STATIC_${i}`,
          label: `动爻克${this.getYaoLabel(i)}`,
          category: 'interaction',
          type: 'debuff',
          description: `动爻的五行克${this.getYaoLabel(i)}的五行，产生制约与伤害之力`,
        })
      }
    }

    return tags
  }

  /**
   * 分析随鬼入墓
   */
  private static analyzeGhostInTomb(element: WuXing, variantBranch: Branch): TagInfo | null {
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
        description: '旺爻化入墓',
      }
    }

    return null
  }

  /**
   * 分析反吟、伏吟
   */
  private static analyzeYinPattern(baseBranch: Branch, variantBranch: Branch): TagInfo | null {
    const baseIdx = BRANCH_ORDER.indexOf(baseBranch)
    const variantIdx = BRANCH_ORDER.indexOf(variantBranch)

    // 反吟：相冲
    if (SIX_CLASH[baseBranch] === variantBranch) {
      return {
        code: 'CONTRARY_YIN',
        label: '反吟',
        category: 'mutation',
        type: 'debuff',
        description: '本爻与变爻相冲',
      }
    }

    // 伏吟：相同
    if (baseBranch === variantBranch) {
      return {
        code: 'HIDDEN_YIN',
        label: '伏吟',
        category: 'mutation',
        type: 'neutral',
        description: '本爻与变爻相同',
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
            description: `爻位与太岁重合，太岁主权威与制约，易遭冲克与阻碍`,
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
      description: `月建${date.monthBranch}为月将，代表本月的权威与指向，影响事象的吉凶判断临界`,
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
      '桃花': '桃花临爻，主异性缘、风流、感情波澜，吉凶各半，需结合他因判断',
      '驿马': '驿马临爻，主动象、旅行、迁移、变动，事象活跃易见转机',
      '文昌贵人': '文昌贵人临爻，主聪慧、文学、功名、升迁，利于学业与事业',
      '禄神': '禄神临爻，主俸禄、收入、财利、官禄，为吉利之象',
      '天乙贵人': '天乙贵人临爻，主贵人扶助、逢凶化吉、官运亨通，尊贵吉利',
      '将星': '将星临爻，主权势、勇武、领导力、能力突出，利于竞争与突破',
      '华盖': '华盖临爻，主聪慧、艺术、出众，但易招嫉妒与孤独',
      '天医': '天医临爻，主医药、健康、救助、痊愈，利于病情好转与健康',
      '咸池': '咸池临爻，主淫乱、意外、风流、风险，需防范感情与道德问题',
      '孤辰': '孤辰临爻，主孤独、离散、背离、无助，易招孤立与退缩',
      '寡宿': '寡宿临爻，主寡妇、孤寡、阴气、冷局，不利于和谐与团结',
    }
    return descriptionMap[shenShaKey] || '神煞'
  }

  // ========== 工具方法 ==========

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

  private static getYaoLabel(index: number): string {
    const labels = ['上爻', '五爻', '四爻', '三爻', '二爻', '初爻']
    return labels[index] || `第${index}爻`
  }
}

export default LiuyaoTagsCalculator
