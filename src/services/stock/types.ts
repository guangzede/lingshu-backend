export type StockDirection = 'up' | 'down'

export interface StockSuggestion {
  code: string
  symbol: string
  name: string
  market: 'CN' | 'US' | 'HK' | 'UNKNOWN'
}

export interface StockQuote {
  symbol: string
  code: string
  name: string
  market: 'CN' | 'US' | 'HK' | 'UNKNOWN'
  currentPrice: number
  prevClose: number
  change: number
  changePct: number
  timestamp?: string
}

export interface StockKlinePoint {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume?: number
}

export interface StockPredictionResult {
  stock: StockQuote
  dayGanZhi: string
  direction: StockDirection
  upProbability: number
  downProbability: number
  confidence: number
  expectedMovePct: number
  expectedRangePct: [number, number]
  factors: {
    baseTrend: number
    momentum: number
    volatilityPenalty: number
    volumeBias: number
    ganZhiBias: number
  }
  signals: string[]
  samples: number
}
