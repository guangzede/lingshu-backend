// 灵枢六爻能量计算引擎
// Author: Lingshu AI
// Date: 2026-02-01
// ========== 基础常量（全部引用 ganzhi/constants） ==========
import {
    GENERATES,
    OVERCOMES,
    SIX_CLASH,
    SIX_HARMONY,
    BRANCH_ORDER,
    TRIPLE_HARMONY,
    TRIPLE_PUNISHMENT,
    WUXING_CN,
    CN_TO_WUXING,
    BRANCH_WUXING,
    DAY_BRANCH_GROUP,
    groupOfBranch,
    CHANGSHENG_SEQ,
} from '@/services/ganzhi/constants'

/**
 * 六爻输入结构
 */
export interface HexagramInput {
    date: {
        monthBranch: Branch
        dayBranch: Branch
        voidBranches: Branch[]
    }
    lines: Array<{
        position: number // 1-6
        name: string
        element: WuXing
        branch: Branch
        isMoving: boolean
        changeBranch?: Branch
        changeElement?: WuXing
    }>
    globalPattern?: 'SIX_CLASH' | 'SIX_COMBINE' | null
}

/**
 * 输出结构
 */
export interface AnalysisResult {
    lines: Array<{
        position: number
        base_score: number
        final_score: number
        level: 'SS' | 'S' | 'A' | 'B' | 'C' | 'F'
        tags: Array<{
            code: string
            label: string
            type: 'buff' | 'debuff' | 'neutral'
        }>
        audit_logs: string[]
    }>
}


type WuXing = keyof typeof WUXING_CN // 'wood' | 'fire' | 'earth' | 'metal' | 'water'
type Branch = keyof typeof BRANCH_WUXING

// 中文五行转英文
function toWuXingEn(cn: string): WuXing {
    return CN_TO_WUXING[cn as keyof typeof CN_TO_WUXING]
}



// ========== 工具函数 ==========

/**
 * 获取五行生克关系
 * @returns 'same' | 'generate' | 'be_generated' | 'overcome' | 'be_overcome' | 'none'
 */
// 五行生克关系直接用 ganzhi/constants 的 GENERATES/OVERCOMES
function getRelation(a: WuXing, b: WuXing): string {
    if (a === b) return 'same'
    if (GENERATES[a] === b) return 'generate'
    if (GENERATES[b] === a) return 'be_generated'
    if (OVERCOMES[a] === b) return 'overcome'
    if (OVERCOMES[b] === a) return 'be_overcome'
    return 'none'
}

/**
 * 检查地支是否六冲
 */
// 地支六冲、六合、三合局等全部用 ganzhi/constants
function checkClash(a: Branch, b: Branch): boolean {
    return SIX_CLASH[a] === b
}
function checkCombine(a: Branch, b: Branch): boolean {
    return SIX_HARMONY[a] === b
}
function branchDiff(from: Branch, to: Branch): number {
    const i = BRANCH_ORDER.indexOf(from)
    const j = BRANCH_ORDER.indexOf(to)
    return ((j - i) + 12) % 12
}
function checkTrinity(branches: Branch[]): Branch[] | null {
    for (const k of Object.keys(DAY_BRANCH_GROUP) as Array<keyof typeof DAY_BRANCH_GROUP>) {
        const group = DAY_BRANCH_GROUP[k]
        if (group.every(b => branches.includes(b))) return group
    }
    return null
}

/**
 * 分析爻与其他爻的刑冲合害关系
 */
function analyzeInteractions(currentBranch: Branch, allLines: Array<{ position: number, branch: Branch, isMoving: boolean }>): { interactions: Array<{ position: number, relation: string }>, tags: StepResult['tags'] } {
    const tags: StepResult['tags'] = []
    const interactions: Array<{ position: number, relation: string }> = []
    
    for (const line of allLines) {
        if (line.branch === currentBranch) continue
        const otherBranch = line.branch
        
        // 检查六冲
        if (SIX_CLASH[currentBranch] === otherBranch) {
            const label = line.isMoving ? '动爻冲' : '静爻冲'
            interactions.push({ position: line.position, relation: '冲' })
            tags.push({ code: 'CLASH_WITH_YAO', label: `被${label}`, type: 'neutral' })
        }
        // 检查六合
        else if (SIX_HARMONY[currentBranch] === otherBranch) {
            const label = line.isMoving ? '动爻合' : '静爻合'
            interactions.push({ position: line.position, relation: '合' })
            tags.push({ code: 'COMBINE_WITH_YAO', label: `被${label}`, type: 'neutral' })
        }
        // 检查三刑
        else if (TRIPLE_PUNISHMENT[currentBranch]?.includes(otherBranch)) {
            const label = line.isMoving ? '动爻刑' : '静爻刑'
            interactions.push({ position: line.position, relation: '刑' })
            tags.push({ code: 'PUNISH_WITH_YAO', label: `被${label}`, type: 'debuff' })
        }
        // 检查害（与天干十干之后的地支关系，这里简化为相对位置）
        else {
            const currentIdx = BRANCH_ORDER.indexOf(currentBranch)
            const otherIdx = BRANCH_ORDER.indexOf(otherBranch)
            const diff = Math.abs(currentIdx - otherIdx)
            // 害为相差6个位置（相对相冲）
            if (diff === 6) {
                const label = line.isMoving ? '动爻害' : '静爻害'
                interactions.push({ position: line.position, relation: '害' })
                tags.push({ code: 'HARM_WITH_YAO', label: `被${label}`, type: 'debuff' })
            }
        }
    }
    
    return { interactions, tags }
}

/**
 * 分析爻与日支、月支的比合关系
 */
function analyzeDayMonthRelations(currentBranch: Branch, dayBranch: Branch, monthBranch: Branch): StepResult['tags'] {
    const tags: StepResult['tags'] = []
    
    // 与日支的关系
    if (currentBranch === dayBranch) {
        tags.push({ code: 'SAME_AS_DAY', label: '与日支比', type: 'buff' })
    } else if (SIX_HARMONY[currentBranch] === dayBranch) {
        tags.push({ code: 'COMBINE_WITH_DAY', label: '与日支合', type: 'buff' })
    } else if (SIX_CLASH[currentBranch] === dayBranch) {
        tags.push({ code: 'CLASH_WITH_DAY', label: '与日支冲', type: 'neutral' })
    } else if (TRIPLE_PUNISHMENT[currentBranch]?.includes(dayBranch)) {
        tags.push({ code: 'PUNISH_WITH_DAY', label: '与日支刑', type: 'debuff' })
    } else {
        const currentIdx = BRANCH_ORDER.indexOf(currentBranch)
        const dayIdx = BRANCH_ORDER.indexOf(dayBranch)
        const diff = Math.abs(currentIdx - dayIdx)
        if (diff === 6) {
            tags.push({ code: 'HARM_WITH_DAY', label: '与日支害', type: 'debuff' })
        }
    }
    
    // 与月支的关系
    if (currentBranch === monthBranch) {
        tags.push({ code: 'SAME_AS_MONTH', label: '与月令比', type: 'buff' })
    } else if (SIX_HARMONY[currentBranch] === monthBranch) {
        tags.push({ code: 'COMBINE_WITH_MONTH', label: '与月令合', type: 'buff' })
    } else if (SIX_CLASH[currentBranch] === monthBranch) {
        tags.push({ code: 'CLASH_WITH_MONTH', label: '与月令冲', type: 'neutral' })
    } else if (TRIPLE_PUNISHMENT[currentBranch]?.includes(monthBranch)) {
        tags.push({ code: 'PUNISH_WITH_MONTH', label: '与月令刑', type: 'debuff' })
    } else {
        const currentIdx = BRANCH_ORDER.indexOf(currentBranch)
        const monthIdx = BRANCH_ORDER.indexOf(monthBranch)
        const diff = Math.abs(currentIdx - monthIdx)
        if (diff === 6) {
            tags.push({ code: 'HARM_WITH_MONTH', label: '与月令害', type: 'debuff' })
        }
    }
    
    return tags
}

function getSeasonStrength(element: WuXing, monthBranch: Branch): '旺' | '相' | '休' | '囚' | '死' {
    const season = BRANCH_WUXING[monthBranch]
    if (season === element) return '旺'
    if (GENERATES[season] === element) return '相'
    if (GENERATES[element] === season) return '休'
    if (OVERCOMES[element] === season) return '囚'
    return '死'
}

/**
 * 检查长生/绝地
 */
// 长生十二宫直接用 ganzhi/constants 的顺序
function getChangShengStatus(element: WuXing, branch: Branch): 'changsheng' | 'mu' | 'ku' | 'jue' | null {
    // 五行与地支的长生十二宫表
    let arr: Branch[] = []
    switch (element) {
        case 'wood': arr = ['亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌']; break;
        case 'fire': arr = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']; break;
        case 'earth': arr = ['巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰']; break;
        case 'metal': arr = ['巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰']; break;
        case 'water': arr = ['申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未']; break;
    }
    if (!arr) return null
    const idx = arr.indexOf(branch)
    if (idx === -1) return null
    const label = CHANGSHENG_SEQ[idx]
    if (label === '长生') return 'changsheng'
    if (label === '墓') {
        // 辰丑未戌为库，其余为墓
        if (['辰', '丑', '未', '戌'].includes(branch)) return 'ku'
        return 'mu'
    }
    if (label === '绝') return 'jue'
    return null
}

// ========== 主计算引擎 ==========


// ====== 分步流水线实现 ======
type StepResult = {
    score: number
    tags: { code: string; label: string; type: 'buff' | 'debuff' | 'neutral' }[]
    logs: string[]
    level?: 'SS' | 'S' | 'A' | 'B' | 'C' | 'F'
    override?: boolean // 是否强制覆盖后续
}

function step1Seasonality(params: any): StepResult {
    const { element, branch, monthBranch, isMoving } = params as { element: WuXing, branch: Branch, monthBranch: Branch, isMoving: boolean }
    let score = 60, logs: string[] = [], tags: StepResult['tags'] = [], level: 'SS' | 'S' | 'A' | 'B' | 'C' | 'F' | undefined
    if (checkClash(branch, monthBranch)) {
        score = 0; level = 'F'
        tags.push({ code: 'MONTH_CRASH', label: '月破', type: 'debuff' })
        logs.push(`月破：${branch}冲月建${monthBranch}，分数清零`)
        return { score, tags, logs, level, override: true }
    }
    if (element === BRANCH_WUXING[monthBranch]) {
        score = 100; logs.push('月建同五行，旺，100分')
    } else if (getRelation(element, BRANCH_WUXING[monthBranch]) === 'be_generated') {
        score = 90; logs.push('月生爻，相，90分')
    } else if (getRelation(element, BRANCH_WUXING[monthBranch]) === 'generate') {
        score = 60; logs.push('爻生月，休，60分')
    } else if (getRelation(element, BRANCH_WUXING[monthBranch]) === 'overcome') {
        score = 50; logs.push('爻克月，囚，50分')
    } else if (getRelation(element, BRANCH_WUXING[monthBranch]) === 'be_overcome') {
        score = 40; logs.push('月克爻，死，40分')
    } else {
        score = 60; logs.push('无特殊月建关系，60分')
    }
    // 静爻四时旺衰加减分
    if (!isMoving) {
        const strength = getSeasonStrength(element, monthBranch)
        const delta = strength === '旺' ? 20 : strength === '相' ? 10 : strength === '休' ? 0 : strength === '囚' ? -10 : -20
        score += delta
        logs.push(`静爻四时旺衰：${strength}${delta >= 0 ? `+${delta}` : delta}分`)
    }
    return { score, tags, logs }
}

function step2DayAuthority(params: any, prev: StepResult): StepResult {
    const { element, branch, dayBranch } = params as { element: WuXing, branch: Branch, dayBranch: Branch }
    let { score, tags, logs, level } = prev
    if (checkClash(branch, dayBranch)) {
        if (score >= 60) {
            score += 30
            tags.push({ code: 'DAY_CRASH', label: '日冲/暗动', type: 'buff' })
            logs.push('日冲：旺相爻被日冲，暗动，+30分')
        } else {
            score = 0; level = 'F'
            tags.push({ code: 'DAY_BREAK', label: '日破', type: 'debuff' })
            logs.push('日冲：休囚爻被日冲，日破，分数清零')
            return { score, tags, logs, level, override: true }
        }
    }
    if (checkCombine(branch, dayBranch)) {
        tags.push({ code: 'DAY_COMBINE', label: '日合/贪合', type: 'neutral' })
        logs.push('日合：被日辰合住，分数不变')
    }
    const dayElement = BRANCH_WUXING[dayBranch]
    if (getRelation(dayElement, element) === 'generate') {
        score += 20; logs.push('日生爻，+20分')
    } else if (getRelation(dayElement, element) === 'overcome') {
        score -= 20; logs.push('日克爻，-20分')
    }
    return { score, tags, logs, level }
}

function step3Mutation(params: any, prev: StepResult): StepResult {
    let { score, tags, logs, level } = prev
    const { isMoving, changeBranch, changeElement, element, branch } = params
    if (isMoving && changeBranch && changeElement) {
        if (getRelation(changeElement, element) === 'generate') {
            score += 50
            tags.push({ code: 'BACK_BORN', label: '回头生', type: 'buff' })
            logs.push('动爻变爻生本爻，回头生，+50分')
        }
        if (getRelation(changeElement, element) === 'overcome') {
            score = 0; level = 'F'
            tags.push({ code: 'BACK_KILL', label: '回头克/大凶', type: 'debuff' })
            logs.push('动爻变爻克本爻，回头克，分数清零')
            return { score, tags, logs, level, override: true }
        }
        if (changeElement === element) {
            const diff = branchDiff(branch, changeBranch)
            if (diff === 1) {
                score = Math.round(score * 1.5)
                tags.push({ code: 'ADVANCE', label: '化进', type: 'buff' })
                logs.push('动爻变爻同五行且顺行，化进神，分数*1.5')
            } else if (diff === 11) {
                score = Math.round(score * 0.5)
                tags.push({ code: 'RETREAT', label: '化退', type: 'debuff' })
                logs.push('动爻变爻同五行且逆行，化退神，分数*0.5')
            }
        }
        const changsheng = getChangShengStatus(element, changeBranch)
        if (changsheng === 'jue') {
            score = 0; tags.push({ code: 'TO_DEAD', label: '化绝', type: 'debuff' }); logs.push('动爻变爻入绝地，分数清零'); return { score, tags, logs, level, override: true }
        } else if (changsheng === 'mu' || changsheng === 'ku') {
            score = Math.min(score, 40); tags.push({ code: 'TO_TOMB', label: '化墓', type: 'debuff' }); logs.push('动爻变爻入墓库，分数不高于40')
        }
    }
    return { score, tags, logs, level }
}

function step4Override(params: any, prev: StepResult, trinity: Branch[] | null): StepResult {
    let { score, tags, logs, level } = prev
    const { branch, isMoving, changeBranch, element } = params
    if (trinity && trinity.includes(branch)) {
        score = 150; level = 'SS'
        tags.push({ code: 'TRINITY', label: '三合局', type: 'buff' })
        logs.push('三合局：参与三合合局，分数强制150')
        return { score, tags, logs, level, override: true }
    }
    const changshengBase = getChangShengStatus(element, branch)
    if (changshengBase === 'jue' && isMoving && changeBranch && getChangShengStatus(element, changeBranch) === 'changsheng') {
        score = 70; tags.push({ code: 'REBIRTH', label: '绝处逢生', type: 'buff' }); logs.push('绝处逢生：本爻绝地，变爻长生，分数70'); return { score, tags, logs, level, override: true }
    }
    return { score, tags, logs, level }
}

function step5FinalFilter(params: any, prev: StepResult): StepResult {
    let { score, tags, logs, level } = prev
    const { voidBranches, branch, element } = params
    if (voidBranches.includes(branch)) {
        if (score > 80) {
            tags.push({ code: 'VOID_FAKE', label: '旺空/待用', type: 'neutral' }); logs.push('旬空：旺空，分数不变')
        } else if (score < 50) {
            score = 0; tags.push({ code: 'VOID_TRUE', label: '真空/到底', type: 'debuff' }); logs.push('旬空：真空，分数清零')
        }
    }
    const muStatus = getChangShengStatus(element, branch)
    if (muStatus === 'mu' || muStatus === 'ku') {
        if (score > 70) {
            tags.push({ code: muStatus === 'ku' ? 'TOMB_KU' : 'TOMB_IN', label: muStatus === 'ku' ? '入库/待冲' : '入墓/待冲', type: 'neutral' }); logs.push(muStatus === 'ku' ? '入库：有气入库，分数不变' : '入墓：有气入墓，分数不变')
        } else if (score < 50) {
            score = 0; tags.push({ code: muStatus === 'ku' ? 'TOMB_KU_BURIED' : 'TOMB_BURIED', label: muStatus === 'ku' ? '入库/被埋' : '入墓/被埋', type: 'debuff' }); logs.push(muStatus === 'ku' ? '入库：无气入库，分数清零' : '入墓：无气入墓，分数清零')
        }
    }
    return { score, tags, logs, level }
}

export class LingshuEnergyCalculator {
    static analyze(input: HexagramInput): AnalysisResult {
        const { date, lines } = input
        const { monthBranch, dayBranch, voidBranches } = date
        const result: AnalysisResult = { lines: [] }
        
        // 预处理：建立所有爻的分支和位置映射
        const allYaoInfo = lines.map(line => ({
            position: line.position,
            branch: line.branch as Branch,
            isMoving: line.isMoving
        }))
        
        for (const line of lines) {
            const element = toWuXingEn(line.element)
            const branch = line.branch as Branch
            const isMoving = line.isMoving
            const changeBranch = line.changeBranch as Branch | undefined
            const changeElement = line.changeElement ? toWuXingEn(line.changeElement) : undefined
            const position = line.position
            
            // 分析与其他爻的刑冲合害
            const { interactions, tags: interactionTags } = analyzeInteractions(branch, allYaoInfo)
            
            // 分析与日支、月支的比合关系
            const dayMonthTags = analyzeDayMonthRelations(branch, dayBranch as Branch, monthBranch as Branch)
            
            // 合并所有交互 tags
            const allInteractionTags = [...interactionTags, ...dayMonthTags]
            
            // 三合局判断：本爻、变爻、日、月
            const trinityBranches = [branch, changeBranch, dayBranch as Branch, monthBranch as Branch].filter(Boolean) as Branch[]
            const trinity = checkTrinity(trinityBranches)
            // step1
            let stepParams = { element, branch, monthBranch: monthBranch as Branch, dayBranch: dayBranch as Branch, isMoving, changeBranch, changeElement, voidBranches }
            let r1 = step1Seasonality(stepParams)
            if (r1.override) {
                result.lines.push({ position, base_score: r1.score, final_score: r1.score, level: r1.level || getLevel(r1.score), tags: [...r1.tags, ...allInteractionTags], audit_logs: r1.logs }); continue
            }
            let r2 = step2DayAuthority(stepParams, r1)
            if (r2.override) {
                result.lines.push({ position, base_score: r1.score, final_score: r2.score, level: r2.level || getLevel(r2.score), tags: [...r2.tags, ...allInteractionTags], audit_logs: r2.logs }); continue
            }
            let r3 = step3Mutation(stepParams, r2)
            if (r3.override) {
                result.lines.push({ position, base_score: r1.score, final_score: r3.score, level: r3.level || getLevel(r3.score), tags: [...r3.tags, ...allInteractionTags], audit_logs: r3.logs }); continue
            }
            let r4 = step4Override(stepParams, r3, trinity)
            if (r4.override) {
                result.lines.push({ position, base_score: r1.score, final_score: r4.score, level: r4.level || getLevel(r4.score), tags: [...r4.tags, ...allInteractionTags], audit_logs: r4.logs }); continue
            }
            let r5 = step5FinalFilter(stepParams, r4)
            const finalScore = Math.max(0, Math.min(150, r5.score))
            result.lines.push({ position, base_score: r1.score, final_score: finalScore, level: r5.level || getLevel(finalScore), tags: [...r5.tags, ...allInteractionTags], audit_logs: r5.logs })
        }
        return result
    }
}

function getLevel(score: number): 'SS' | 'S' | 'A' | 'B' | 'C' | 'F' {
    if (score >= 130) return 'SS'
    if (score >= 100) return 'S'
    if (score >= 80) return 'A'
    if (score >= 60) return 'B'
    if (score >= 40) return 'C'
    return 'F'
}

// 地支五行直接用 BRANCH_WUXING
