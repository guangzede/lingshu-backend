// ============= 主入口文件 - 统一导出所有功能 =============

// 核心功能
export {
  buildHexagram,
  deriveVariant,
  deriveMutual,
  getDayStemBranch,
  getTimeGanZhi,
  assignSixGods,
  mapNaJia,
  getBranchOrder,
  computeAll
} from './core'

// 神煞计算
export {
  computeShenSha,
  computeXunKong,
  type ShenShaResult
} from '@/services/ganzhi/shensha'

// 五行相关
export {
  getRelation,
  assignFiveElement,
  toWuXing,
  assignChangsheng,
  getSeasonElement,
  seasonStatus,
  analyzeYaoInteractions,
  STEM_WUXING,
  BRANCH_WUXING,
  GENERATES,
  OVERCOMES,
  type WuXing
} from '@/services/ganzhi/wuxing'

// 地支关系
export {
  analyzeBranchRelation,
  SIX_HARMONY,
  SIX_CLASH,
  TRIPLE_HARMONY,
  TRIPLE_PUNISHMENT
} from '@/services/ganzhi/branch'
// 常量
export {
  CHANGSHENG_SEQ,
  BRANCH_ORDER,
  DAY_BRANCH_GROUP,
  groupOfBranch,
  type Changsheng
} from './constants'
