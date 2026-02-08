import type { TrigramName } from '@/types/liuyao'

export interface PalaceHexagram {
  name: string
  code: string // 六位二进制，自下而上：阳=1 阴=0
  palace: string
  element: string
  category: string // 本宫/一世/二世/三世/四世/五世/游魂/归魂
  shiIndex: number // 0=初爻 ... 5=上爻（自下而上存储）
  yingIndex: number
  upper?: TrigramName
  lower?: TrigramName
  tableName?: string // 名称取自 HEXAGRAM_NAME_TABLE（仅缓存，便于对齐）
}

function trigramFromBits(bits: string): TrigramName {
  const map: Record<string, TrigramName> = {
    '111': '乾',
    '110': '兑',
    '101': '离',
    '100': '震',
    '011': '巽',
    '010': '坎',
    '001': '艮',
    '000': '坤'
  }
  return map[bits]
}

const RAW: Omit<PalaceHexagram, 'upper' | 'lower' | 'tableName'>[] = [
  // 世爻 应爻的数据是从下往上数第n个爻,从0开始为初爻,5为六爻

  // 乾宫
  { name: '乾为天', code: '111111', palace: '乾宫', element: '金', category: '本宫', shiIndex: 5, yingIndex: 2 },
  { name: '天风姤', code: '011111', palace: '乾宫', element: '金', category: '一世', shiIndex: 0, yingIndex: 3 },
  { name: '天山遁', code: '001111', palace: '乾宫', element: '金', category: '二世', shiIndex: 1, yingIndex: 4 },
  { name: '天地否', code: '000111', palace: '乾宫', element: '金', category: '三世', shiIndex: 2, yingIndex: 5 },
  { name: '风地观', code: '000011', palace: '乾宫', element: '金', category: '四世', shiIndex: 3, yingIndex: 0 },
  { name: '山地剥', code: '000001', palace: '乾宫', element: '金', category: '五世', shiIndex: 4, yingIndex: 1 },
  { name: '火地晋', code: '000101', palace: '乾宫', element: '金', category: '游魂', shiIndex: 3, yingIndex: 0 },
  { name: '火天大有', code: '111101', palace: '乾宫', element: '金', category: '归魂', shiIndex: 2, yingIndex: 5 },
  // 震宫
  { name: '震为雷', code: '100100', palace: '震宫', element: '木', category: '本宫', shiIndex: 5, yingIndex: 2 },
  { name: '雷地豫', code: '000100', palace: '震宫', element: '木', category: '一世', shiIndex: 0, yingIndex: 3 },
  { name: '雷水解', code: '010100', palace: '震宫', element: '木', category: '二世', shiIndex: 1, yingIndex: 4 },
  { name: '雷风恒', code: '011100', palace: '震宫', element: '木', category: '三世', shiIndex: 2, yingIndex: 5 },
  { name: '地风升', code: '011000', palace: '震宫', element: '木', category: '四世', shiIndex: 3, yingIndex: 0 },
  { name: '水风井', code: '011010', palace: '震宫', element: '木', category: '五世', shiIndex: 4, yingIndex: 1 },
  { name: '泽风大过', code: '011110', palace: '震宫', element: '木', category: '游魂', shiIndex: 3, yingIndex: 0 },
  { name: '泽雷随', code: '100110', palace: '震宫', element: '木', category: '归魂', shiIndex: 2, yingIndex: 5 },
  // 坎宫
  { name: '坎为水', code: '010010', palace: '坎宫', element: '水', category: '本宫', shiIndex: 5, yingIndex: 2 },
  { name: '水泽节', code: '110010', palace: '坎宫', element: '水', category: '一世', shiIndex: 0, yingIndex: 3 },
  { name: '水雷屯', code: '100010', palace: '坎宫', element: '水', category: '二世', shiIndex: 1, yingIndex: 4 },
  { name: '水火既济', code: '101010', palace: '坎宫', element: '水', category: '三世', shiIndex: 2, yingIndex: 5 },
  { name: '泽火革', code: '101110', palace: '坎宫', element: '水', category: '四世', shiIndex: 3, yingIndex: 0 },
  { name: '雷火丰', code: '101100', palace: '坎宫', element: '水', category: '五世', shiIndex: 4, yingIndex: 1 },
  { name: '地火明夷', code: '101000', palace: '坎宫', element: '水', category: '游魂', shiIndex: 3, yingIndex: 0 },
  { name: '地水师', code: '010000', palace: '坎宫', element: '水', category: '归魂', shiIndex: 2, yingIndex: 5 },
  // 艮宫
  { name: '艮为山', code: '001001', palace: '艮宫', element: '土', category: '本宫', shiIndex: 5, yingIndex: 2 },
  { name: '山火贲', code: '101001', palace: '艮宫', element: '土', category: '一世', shiIndex: 0, yingIndex: 3 },
  { name: '山天大畜', code: '111001', palace: '艮宫', element: '土', category: '二世', shiIndex: 1, yingIndex: 4 },
  { name: '山泽损', code: '110001', palace: '艮宫', element: '土', category: '三世', shiIndex: 2, yingIndex: 5 },
  { name: '火泽睽', code: '110101', palace: '艮宫', element: '土', category: '四世', shiIndex: 3, yingIndex: 0 },
  { name: '天泽履', code: '110111', palace: '艮宫', element: '土', category: '五世', shiIndex: 4, yingIndex: 1 },
  { name: '风泽中孚', code: '110011', palace: '艮宫', element: '土', category: '游魂', shiIndex: 3, yingIndex: 0 },
  { name: '风山渐', code: '001011', palace: '艮宫', element: '土', category: '归魂', shiIndex: 2, yingIndex: 5 },
  // 坤宫
  { name: '坤为地', code: '000000', palace: '坤宫', element: '土', category: '本宫', shiIndex: 5, yingIndex: 2 },
  { name: '地雷复', code: '100000', palace: '坤宫', element: '土', category: '一世', shiIndex: 0, yingIndex: 3 },
  { name: '地泽临', code: '110000', palace: '坤宫', element: '土', category: '二世', shiIndex: 1, yingIndex: 4 },
  { name: '地天泰', code: '111000', palace: '坤宫', element: '土', category: '三世', shiIndex: 2, yingIndex: 5 },
  { name: '雷天大壮', code: '111100', palace: '坤宫', element: '土', category: '四世', shiIndex: 3, yingIndex: 0 },
  { name: '泽天夬', code: '111110', palace: '坤宫', element: '土', category: '五世', shiIndex: 4, yingIndex: 1 },
  { name: '水天需', code: '111010', palace: '坤宫', element: '土', category: '游魂', shiIndex: 3, yingIndex: 0 },
  { name: '水地比', code: '000010', palace: '坤宫', element: '土', category: '归魂', shiIndex: 2, yingIndex: 5 },
  // 巽宫
  { name: '巽为风', code: '011011', palace: '巽宫', element: '木', category: '本宫', shiIndex: 5, yingIndex: 2 },
  { name: '风天小畜', code: '111011', palace: '巽宫', element: '木', category: '一世', shiIndex: 0, yingIndex: 3 },
  { name: '风火家人', code: '101011', palace: '巽宫', element: '木', category: '二世', shiIndex: 1, yingIndex: 4 },
  { name: '风雷益', code: '100011', palace: '巽宫', element: '木', category: '三世', shiIndex: 2, yingIndex: 5 },
  { name: '天雷无妄', code: '100111', palace: '巽宫', element: '木', category: '四世', shiIndex: 3, yingIndex: 0 },
  { name: '火雷噬嗑', code: '100101', palace: '巽宫', element: '木', category: '五世', shiIndex: 4, yingIndex: 1 },
  { name: '山雷颐', code: '100001', palace: '巽宫', element: '木', category: '游魂', shiIndex: 3, yingIndex: 0 },
  { name: '山风蛊', code: '011001', palace: '巽宫', element: '木', category: '归魂', shiIndex: 2, yingIndex: 5 },
  // 离宫
  { name: '离为火', code: '101101', palace: '离宫', element: '火', category: '本宫', shiIndex: 5, yingIndex: 2 },
  { name: '火山旅', code: '001101', palace: '离宫', element: '火', category: '一世', shiIndex: 0, yingIndex: 3 },
  { name: '火风鼎', code: '011101', palace: '离宫', element: '火', category: '二世', shiIndex: 1, yingIndex: 4 },
  { name: '火水未济', code: '010101', palace: '离宫', element: '火', category: '三世', shiIndex: 2, yingIndex: 5 },
  { name: '山水蒙', code: '010001', palace: '离宫', element: '火', category: '四世', shiIndex: 3, yingIndex: 0 },
  { name: '风水涣', code: '010011', palace: '离宫', element: '火', category: '五世', shiIndex: 4, yingIndex: 1 },
  { name: '天水讼', code: '010111', palace: '离宫', element: '火', category: '游魂', shiIndex: 3, yingIndex: 0 },
  { name: '天火同人', code: '101111', palace: '离宫', element: '火', category: '归魂', shiIndex: 2, yingIndex: 5 },
  // 兑宫
  { name: '兑为泽', code: '110110', palace: '兑宫', element: '金', category: '本宫', shiIndex: 5, yingIndex: 2 },
  { name: '泽水困', code: '010110', palace: '兑宫', element: '金', category: '一世', shiIndex: 0, yingIndex: 3 },
  { name: '泽地萃', code: '000110', palace: '兑宫', element: '金', category: '二世', shiIndex: 1, yingIndex: 4 },
  { name: '泽山咸', code: '001110', palace: '兑宫', element: '金', category: '三世', shiIndex: 2, yingIndex: 5 },
  { name: '水山蹇', code: '001010', palace: '兑宫', element: '金', category: '四世', shiIndex: 3, yingIndex: 0 },
  { name: '地山谦', code: '001000', palace: '兑宫', element: '金', category: '五世', shiIndex: 4, yingIndex: 1 },
  { name: '雷山小过', code: '001100', palace: '兑宫', element: '金', category: '游魂', shiIndex: 3, yingIndex: 0 },
  { name: '雷泽归妹', code: '110100', palace: '兑宫', element: '金', category: '归魂', shiIndex: 2, yingIndex: 5 }
]

export const PALACE_HEXAGRAMS: PalaceHexagram[] = RAW.map(item => {
  const lowerBits = item.code.slice(0, 3)
  const upperBits = item.code.slice(3)
  const lower = trigramFromBits(lowerBits)
  const upper = trigramFromBits(upperBits)
  return {
    ...item,
    lower,
    upper,
    tableName: item.name
  }
})

export function resolveHexagramName(upper: TrigramName, lower: TrigramName): string {
  const found = PALACE_HEXAGRAMS.find(h => h.upper === upper && h.lower === lower)
  return found?.name || `${upper}${lower}`
}

export function findPalaceByCode(code: string): PalaceHexagram | undefined {
  return PALACE_HEXAGRAMS.find(h => h.code === code)
}
