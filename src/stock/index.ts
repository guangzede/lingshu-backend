import { Hono } from 'hono'
import { Lunar } from 'lunar-javascript'
import { errorResponse, successResponse } from '@/utils/response'
import {
  crawlStockKline,
  crawlStockQuote,
  crawlStockSuggestions,
  predictStockProbability,
  resolveStockByName
} from '@/services/stock'
import type { StockQuote } from '@/services/stock'

interface CloudflareBindings {
  lingshu_db: D1Database
  JWT_SECRET: string
}

export const stockRouter = new Hono<{ Bindings: CloudflareBindings }>()

function formatTodayDate(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fallbackQuote(input: {
  symbol: string
  code: string
  name: string
  market: 'CN' | 'US' | 'HK' | 'UNKNOWN'
  kline: Array<{ close: number }>
}): StockQuote {
  const latestClose = input.kline[input.kline.length - 1]?.close ?? 0
  const prevClose = input.kline[input.kline.length - 2]?.close ?? latestClose
  const change = latestClose - prevClose
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0
  return {
    symbol: input.symbol,
    code: input.code,
    name: input.name,
    market: input.market,
    currentPrice: latestClose,
    prevClose,
    change,
    changePct
  }
}

stockRouter.get('/today-ganzhi', (c) => {
  const now = new Date()
  const lunar = Lunar.fromDate(now)
  return c.json(successResponse({
    date: formatTodayDate(now),
    dayGanZhi: lunar.getDayInGanZhi()
  }))
})

stockRouter.get('/suggest', async (c) => {
  const keyword = (c.req.query('keyword') || '').trim()
  if (!keyword) {
    return c.json(successResponse({ list: [] }))
  }

  if (keyword.length < 2) {
    return c.json(errorResponse('请输入至少2个字符进行股票搜索'), 400)
  }

  try {
    const list = await crawlStockSuggestions(keyword)
    return c.json(successResponse({ list }))
  } catch (err: any) {
    console.error('[STOCK SUGGEST ERROR]', err)
    return c.json(errorResponse('股票搜索失败，请稍后重试'), 502)
  }
})

stockRouter.post('/predict', async (c) => {
  let body: any = null
  try {
    body = await c.req.json().catch(() => null)
  } catch {
    return c.json(errorResponse('请求体格式错误'), 400)
  }

  const stockName = String(body?.stockName || '').trim()
  if (!stockName) {
    return c.json(errorResponse('缺少stockName参数'), 400)
  }

  const dayGanZhiInput = String(body?.dayGanZhi || '').trim()
  const dayGanZhi = dayGanZhiInput || Lunar.fromDate(new Date()).getDayInGanZhi()

  try {
    const target = await resolveStockByName(stockName)
    if (!target) {
      return c.json(errorResponse('未找到对应股票，请尝试输入更准确的名称或代码'), 404)
    }
    if (target.market !== 'CN') {
      return c.json(errorResponse('当前版本仅支持A股（沪深北）预测'), 422)
    }

    const kline = await crawlStockKline(target.symbol, 180)
    if (kline.length < 30) {
      return c.json(errorResponse('行情数据不足，暂时无法预测'), 422)
    }

    const quote =
      await crawlStockQuote(target.symbol)
      || fallbackQuote({
        symbol: target.symbol,
        code: target.code,
        name: target.name,
        market: target.market,
        kline
      })

    const normalizedQuote: StockQuote = {
      ...quote,
      code: quote.code || target.code,
      name: quote.name || target.name,
      symbol: target.symbol,
      market: target.market
    }

    const result = predictStockProbability(kline, normalizedQuote, dayGanZhi)
    return c.json(successResponse({
      result,
      source: {
        search: 'eastmoney',
        kline: 'tencent',
        quote: quote.timestamp ? 'sina' : 'kline-fallback'
      },
      crawledAt: new Date().toISOString()
    }))
  } catch (err: any) {
    console.error('[STOCK PREDICT ERROR]', err)
    return c.json(errorResponse(err?.message || '预测失败，请稍后重试'), 500)
  }
})
