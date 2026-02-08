import type { Branch } from '@/types/liuyao'
import { SIX_CLASH, SIX_HARMONY, TRIPLE_HARMONY, TRIPLE_PUNISHMENT } from './constants'

export function analyzeBranchRelation(dayBranch: Branch, hourBranch: Branch, hexBranches: Branch[]) {
  const dayRelations = hexBranches.map((branch) => {
    const isHarmony = SIX_HARMONY[branch] === dayBranch
    const isClash = SIX_CLASH[branch] === dayBranch
    const triple = TRIPLE_HARMONY[branch] ?? []
    const isTriple = triple.includes(dayBranch)
    const punishment = TRIPLE_PUNISHMENT[branch] ?? []
    const isPunish = punishment.includes(dayBranch)

    return { branch, isHarmony, isClash, isTriple, isPunish }
  })

  const hourRelations = hexBranches.map((branch) => {
    const isHarmony = SIX_HARMONY[branch] === hourBranch
    const isClash = SIX_CLASH[branch] === hourBranch
    const triple = TRIPLE_HARMONY[branch] ?? []
    const isTriple = triple.includes(hourBranch)
    const punishment = TRIPLE_PUNISHMENT[branch] ?? []
    const isPunish = punishment.includes(hourBranch)

    return { branch, isHarmony, isClash, isTriple, isPunish }
  })

  return { dayRelations, hourRelations }
}

export { SIX_HARMONY, SIX_CLASH, TRIPLE_HARMONY, TRIPLE_PUNISHMENT }
