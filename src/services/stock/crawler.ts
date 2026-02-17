import type { StockKlinePoint, StockQuote, StockSuggestion } from './types'

const EAST_MONEY_TOKEN = 'D43BF722C8E33BDC906FB84D85E326E8'
const STOCK_SEARCH_URL = 'https://searchapi.eastmoney.com/api/suggest/get'
const KLINE_URL = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get'
const SINA_QUOTE_URL = 'https://hq.sinajs.cn/list='

const SEARCH_HEADERS = {
  Referer: 'https://quote.eastmoney.com/',
  'User-Agent': 'Mozilla/5.0 (compatible; LingshuStockBot/1.0)'
}

function isValidStockCode(code: string): boolean {
  return /^[0-9]{5,6}$/.test(code) || /^[A-Za-z.]{1,12}$/.test(code)
}

function detectMarket(code: string): StockSuggestion['market'] {
  if (/^[0-9]{6}$/.test(code)) return 'CN'
  if (/^[A-Za-z]{1,6}$/.test(code)) return 'US'
  if (/^[0-9]{5}$/.test(code)) return 'HK'
  return 'UNKNOWN'
}

function normalizeSymbol(codeOrSymbol: string): string {
  const value = codeOrSymbol.trim()
  if (!value) return ''
  const lower = value.toLowerCase()
  if (lower.startsWith('sh') || lower.startsWith('sz') || lower.startsWith('bj')) {
    return lower
  }
  if (/^\d{6}$/.test(value)) {
    if (value.startsWith('6')) return `sh${value}`
    if (value.startsWith('0') || value.startsWith('3')) return `sz${value}`
    if (value.startsWith('8') || value.startsWith('4')) return `bj${value}`
  }
  return lower
}

function asNumber(value: any): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function parseKLineArray(raw: any[]): StockKlinePoint | null {
  if (!Array.isArray(raw) || raw.length < 5) return null
  const close = asNumber(raw[2])
  if (close <= 0) return null
  return {
    date: String(raw[0] || ''),
    open: asNumber(raw[1]),
    close,
    high: asNumber(raw[3]),
    low: asNumber(raw[4]),
    volume: raw[5] != null ? asNumber(raw[5]) : undefined
  }
}

function normalizeSuggestion(item: any): StockSuggestion | null {
  const code = String(item?.Code ?? item?.code ?? '').trim()
  const name = String(item?.Name ?? item?.name ?? '').trim()
  if (!code || !name || !isValidStockCode(code)) return null
  const market = detectMarket(code)
  let symbol = code.toLowerCase()
  if (market === 'CN') {
    symbol = normalizeSymbol(code)
  }
  if (market === 'HK') {
    symbol = `hk${code}`
  }
  return { code, symbol, name, market }
}

export async function crawlStockSuggestions(keyword: string): Promise<StockSuggestion[]> {
  const key = keyword.trim()
  if (!key) return []

  const url =
    `${STOCK_SEARCH_URL}?input=${encodeURIComponent(key)}` +
    `&type=14&token=${EAST_MONEY_TOKEN}&count=10`

  const res = await fetch(url, { headers: SEARCH_HEADERS })
  if (!res.ok) {
    throw new Error(`股票搜索失败(${res.status})`)
  }

  const data = await res.json() as any
  const list = data?.QuotationCodeTable?.Data
  if (!Array.isArray(list)) return []

  const result: StockSuggestion[] = []
  const seen = new Set<string>()
  for (const row of list) {
    const item = normalizeSuggestion(row)
    if (!item || item.market === 'UNKNOWN') continue
    if (item.market === 'CN' && !/^(sh|sz|bj)/.test(item.symbol)) continue
    if (seen.has(item.symbol)) continue
    seen.add(item.symbol)
    result.push(item)
    if (result.length >= 8) break
  }
  return result
}

export async function resolveStockByName(stockName: string): Promise<StockSuggestion | null> {
  const key = stockName.trim()
  if (!key) return null
  const suggestions = await crawlStockSuggestions(key).catch(() => [])
  if (suggestions.length > 0) {
    const exact = suggestions.find((item) => item.name === key || item.code === key)
    return exact ?? suggestions[0]
  }

  if (/^(sh|sz|bj)\d{6}$/i.test(key)) {
    const symbol = key.toLowerCase()
    return {
      code: symbol.slice(2),
      symbol,
      name: key.toUpperCase(),
      market: 'CN'
    }
  }

  if (/^\d{6}$/.test(key)) {
    const symbol = normalizeSymbol(key)
    return {
      code: key,
      symbol,
      name: key,
      market: 'CN'
    }
  }
  return null
}

export async function crawlStockKline(symbolOrCode: string, limit = 180): Promise<StockKlinePoint[]> {
  const symbol = normalizeSymbol(symbolOrCode)
  if (!symbol) return []

  const safeLimit = Math.max(30, Math.min(limit, 260))
  const url = `${KLINE_URL}?param=${symbol},day,,,${safeLimit},qfq`
  const res = await fetch(url, { headers: SEARCH_HEADERS })
  if (!res.ok) {
    throw new Error(`股票K线抓取失败(${res.status})`)
  }

  const rawText = await res.text()
  let parsed: any = null
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error('股票K线数据格式异常')
  }
  const node = parsed?.data?.[symbol]
  const arr = node?.qfqday || node?.day || []
  if (!Array.isArray(arr)) return []
  return arr
    .map(parseKLineArray)
    .filter((row): row is StockKlinePoint => Boolean(row))
}

function parseSinaQuote(text: string, symbol: string): StockQuote | null {
  // var hq_str_sh600519="贵州茅台,1456.00,1455.00,1459.00,....,2026-02-16,15:00:00,00";
  const start = text.indexOf('"')
  const end = text.lastIndexOf('"')
  if (start < 0 || end <= start) return null
  const body = text.slice(start + 1, end)
  const parts = body.split(',')
  if (parts.length < 6) return null
  const name = parts[0] || symbol.toUpperCase()
  const open = asNumber(parts[1])
  const prevClose = asNumber(parts[2])
  const current = asNumber(parts[3])
  const currentPrice = current > 0 ? current : open
  const change = currentPrice - prevClose
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0
  const date = parts[30] || ''
  const time = parts[31] || ''
  return {
    symbol,
    code: symbol.replace(/^(sh|sz|bj)/, ''),
    name,
    market: 'CN',
    currentPrice,
    prevClose,
    change,
    changePct,
    timestamp: date && time ? `${date} ${time}` : undefined
  }
}

export async function crawlStockQuote(symbolOrCode: string): Promise<StockQuote | null> {
  const symbol = normalizeSymbol(symbolOrCode)
  if (!symbol) return null

  const res = await fetch(`${SINA_QUOTE_URL}${symbol}`, {
    headers: {
      ...SEARCH_HEADERS,
      Referer: 'https://finance.sina.com.cn/'
    }
  })
  if (!res.ok) return null
  const text = await res.text()
  return parseSinaQuote(text, symbol)
}
