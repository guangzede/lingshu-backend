/**
 * 排卦业务模块：支持去重检查和配额扣减
 * Hash 包含：user_id + subject + category（避免不同问题被视为重复）
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, gt } from 'drizzle-orm';
import { users, divinationRecords } from '../schema';
import { successResponse, errorResponse } from '../utils/response';
import { computeAll } from '@/services/liuyao';
import { analyzeBranchRelation } from '@/services/ganzhi/branch';
import { analyzeYaoInteractions } from '@/services/ganzhi/wuxing';
import { JwtPayload, QuotaCheckResult } from '../utils/types';
import { checkQuotaStatus, deductQuota } from '../member/quota';
import { LiuyaoTagsCalculator } from '@/services/liuyao/tagsCalculator';

interface CloudflareBindings {
  lingshu_db: D1Database;
  JWT_SECRET: string;
}

export const divinationRouter = new Hono<{ Bindings: CloudflareBindings }>();

const YAO_LABELS: Record<number, string> = {
  0: '上爻',
  1: '五爻',
  2: '四爻',
  3: '三爻',
  4: '二爻',
  5: '初爻'
};

const BRANCH_WUXING: Record<string, string> = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火',
  '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水'
};

const BRANCH_HARMONY: Record<string, string> = {
  '子': '丑', '丑': '子', '寅': '亥', '亥': '寅', '卯': '戌', '戌': '卯',
  '辰': '酉', '酉': '辰', '巳': '申', '申': '巳', '午': '未', '未': '午'
};

const BRANCH_CLASH: Record<string, string> = {
  '子': '午', '午': '子', '丑': '未', '未': '丑', '寅': '申', '申': '寅',
  '卯': '酉', '酉': '卯', '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳'
};

const GENERATES: Record<string, string> = {
  '木': '火', '火': '土', '土': '金', '金': '水', '水': '木'
};

const OVERCOMES: Record<string, string> = {
  '木': '土', '土': '水', '水': '火', '火': '金', '金': '木'
};

const WUXING_CLASS: Record<string, string> = {
  '金': 'wuxing-metal',
  '木': 'wuxing-wood',
  '水': 'wuxing-water',
  '火': 'wuxing-fire',
  '土': 'wuxing-earth'
};

const STRENGTH_CLASS: Record<string, string> = {
  '旺': 'strength-wang',
  '相': 'strength-xiang',
  '休': 'strength-xiu',
  '囚': 'strength-qiu',
  '死': 'strength-si'
};

function buildInfoGrid(result: any, dateValue: string, timeValue: string) {
  const dateText = `${dateValue || ''} ${timeValue || ''}`.trim();
  const lunarText = `农历 ${result.lunar.month}月${result.lunar.day}日${result.lunar.jieQi ? `（${result.lunar.jieQi}）` : ''}`;
  const shenSha = result.shenSha || {};
  const formatVal = (val: any) => Array.isArray(val) ? val.join('、') : (val || '--');
  return {
    dateText,
    lunarText,
    ganzhi: {
      year: `${result.timeGanZhi.year.stem}${result.timeGanZhi.year.branch}`,
      month: `${result.timeGanZhi.month.stem}${result.timeGanZhi.month.branch}`,
      day: `${result.timeGanZhi.day.stem}${result.timeGanZhi.day.branch}`,
      hour: `${result.timeGanZhi.hour.stem}${result.timeGanZhi.hour.branch}`
    },
    xunKongText: `${result.xunKong?.[0] || ''}${result.xunKong?.[1] || ''}`,
    shenShaItems: [
      { label: '天乙贵人', value: formatVal(shenSha.天乙贵人) },
      { label: '驿马', value: formatVal(shenSha.驿马) },
      { label: '禄神', value: formatVal(shenSha.禄神), highlight: 'jade' },
      { label: '文昌', value: formatVal(shenSha.文昌贵人) },
      { label: '将星', value: formatVal(shenSha.将星) },
      { label: '华盖', value: formatVal(shenSha.华盖) },
      { label: '天医', value: formatVal(shenSha.天医), highlight: 'jade' },
      { label: '孤辰', value: formatVal(shenSha.孤辰) },
      { label: '寡宿', value: formatVal(shenSha.寡宿) },
      { label: '桃花', value: formatVal(shenSha.桃花), highlight: 'red' },
      { label: '咸池', value: formatVal(shenSha.咸池), highlight: 'red' }
    ]
  };
}

function getYaoState(yao: any) {
  const isYang = yao?.isYang !== undefined ? yao.isYang : true;
  const isMoving = yao?.isMoving || false;
  let cls = isYang ? 'yang' : 'yin';
  if (isMoving) cls += ' moving';
  return cls;
}

function buildHexagramTable(result: any) {
  const baseHex = result.hex || {};
  const variantHex = result.variant || {};
  const base = result.yaos || [];
  const variant = result.variantYaos || result.variant?.yaos || [];
  const rows = [0, 1, 2, 3, 4, 5].map((i) => {
    const y = base[i] || {};
    const v = variant[i] || {};
    return {
      index: i,
      left: {
        sixGod: y.sixGod || '--',
        fuShen: y.fuShen ? `${y.fuShen.relation || ''}${y.fuShen.stem || ''}${y.fuShen.branch || ''}` : '',
        relation: `${y.relation || '--'}${y.stem || ''}${y.branch || ''}`,
        yaoClass: getYaoState(y),
        fiveElement: y.fiveElement || '--',
        shiYing: baseHex.shiIndex === i ? '世' : baseHex.yingIndex === i ? '应' : ''
      },
      right: {
        relation: `${v.relation || '--'}${v.stem || ''}${v.branch || ''}`,
        yaoClass: getYaoState(v),
        fiveElement: v.fiveElement || '--',
        shiYing: variantHex.shiIndex === i ? '世' : variantHex.yingIndex === i ? '应' : ''
      }
    };
  });

  return {
    baseHeader: {
      name: baseHex?.name || '本卦',
      palace: baseHex?.palace || '',
      palaceCategory: baseHex?.palaceCategory || ''
    },
    variantHeader: {
      name: variantHex?.name || '变卦',
      palace: variantHex?.palace || '',
      palaceCategory: variantHex?.palaceCategory || ''
    },
    rows
  };
}

function formatRelation(rel: { isHarmony: boolean; isClash: boolean; isTriple: boolean; isPunish: boolean }) {
  const relations: string[] = [];
  if (rel.isClash) relations.push('六冲');
  if (rel.isHarmony) relations.push('六合');
  if (rel.isTriple) relations.push('三合');
  if (rel.isPunish) relations.push('三刑');
  return relations.join('、');
}

function analyzeYaoRelations(
  yaos: Array<{ branch?: string; fiveElement?: string; isMoving?: boolean }>,
  dayStem: string,
  dayBranch: string,
  monthStem: string,
  monthBranch: string
) {
  return yaos.map((yao, idx) => {
    if (!yao?.isMoving || !yao.branch) return null;
    const relations: string[] = [];
    const yaoBranch = yao.branch;
    const yaoWuxing = yao.fiveElement || BRANCH_WUXING[yaoBranch];

    yaos.forEach((otherYao, otherIdx) => {
      if (otherIdx === idx || !otherYao?.branch) return;
      const otherWuxing = otherYao.fiveElement || BRANCH_WUXING[otherYao.branch];
      if (!yaoWuxing || !otherWuxing) return;
      if (GENERATES[yaoWuxing] === otherWuxing) {
        relations.push(`生${YAO_LABELS[otherIdx]}${otherYao.branch}${otherWuxing}`);
      } else if (OVERCOMES[yaoWuxing] === otherWuxing) {
        relations.push(`克${YAO_LABELS[otherIdx]}${otherYao.branch}${otherWuxing}`);
      }
    });

    if (BRANCH_CLASH[yaoBranch] === dayBranch) {
      relations.push(`与日辰${dayStem}${dayBranch}六冲`);
    } else if (BRANCH_HARMONY[yaoBranch] === dayBranch) {
      relations.push(`与日辰${dayStem}${dayBranch}六合`);
    }

    if (BRANCH_CLASH[yaoBranch] === monthBranch) {
      relations.push(`与月令${monthStem}${monthBranch}六冲`);
    } else if (BRANCH_HARMONY[yaoBranch] === monthBranch) {
      relations.push(`与月令${monthStem}${monthBranch}六合`);
    }

    return {
      yaoBranch,
      yaoWuxing,
      relations
    };
  });
}

/**
 * POST /api/divination/compute
 * 计算排盘结果（前端提交原始爻位和时间）
 */
divinationRouter.post('/compute', async (c) => {
  let body;
  try {
    body = await c.req.json().catch(() => null);
  } catch (parseError: any) {
    console.error('[DIVINATION COMPUTE] JSON 解析失败:', parseError);
    return c.json(
      errorResponse('请求体格式错误'),
      400
    );
  }

  if (!body || !Array.isArray(body.lines) || body.lines.length !== 6) {
    return c.json(
      errorResponse('缺少必要参数：lines'),
      400
    );
  }

  const { lines, dateValue, timeValue, ruleSetKey = 'jingfang-basic', question, manualMode } = body;
  const dateStr = dateValue && timeValue ? `${dateValue}T${timeValue}:00` : undefined;
  const date = dateStr ? new Date(dateStr) : new Date();

  try {
    const result = computeAll(lines, { ruleSetKey, date });
    const dayBranch = result.timeGanZhi.day.branch;
    const hourBranch = result.timeGanZhi.hour.branch;
    const hexBranches = result.yaos
      .map((y: any) => y.branch)
      .filter(Boolean) as string[];

    const branchRelations = analyzeBranchRelation(
      dayBranch as any,
      hourBranch as any,
      hexBranches as any
    );
    const dayRelations = branchRelations.dayRelations.map((rel: any) => ({
      ...rel,
      relationText: formatRelation(rel)
    }));
    const hourRelations = branchRelations.hourRelations.map((rel: any) => ({
      ...rel,
      relationText: formatRelation(rel)
    }));
    const yaoInteractions = analyzeYaoInteractions(
      result.yaos as any,
      (result.variantYaos || result.variant.yaos) as any
    );
    const yaoRelations = analyzeYaoRelations(
      result.yaos as any,
      result.timeGanZhi.day.stem,
      result.timeGanZhi.day.branch,
      result.timeGanZhi.month.stem,
      result.timeGanZhi.month.branch
    );

    const tagsAnalysis = LiuyaoTagsCalculator.calculate({
      hexName: result.hex.name,
      yaos: (result.yaos as any[]).map((yao, idx) => ({
        ...yao,
        position: idx + 1,
      })),
      variantYaos: (result.variantYaos || result.variant?.yaos) as any[],
      sixGods: (result.yaos as any[]).map((yao: any) => yao.sixGod),
      date: {
        dayStem: result.timeGanZhi.day.stem,
        dayBranch: result.timeGanZhi.day.branch,
        monthBranch: result.timeGanZhi.month.branch,
        voidBranches: result.xunKong || [],
      },
      timeGanZhi: result.timeGanZhi,
    }, result.shenSha)

    const yaoUi = (result.yaos as any[]).map((yao, idx) => {
      const interaction = yaoInteractions.find((item: any) => item.yaoIndex === idx);
      const relation = yaoRelations[idx];
      const energyLine = result.energyAnalysis?.lines?.find((line: any) => line.position === idx + 1);
      const tagInfo = tagsAnalysis?.yaoTags?.find((tag: any) => tag.yaoIndex === idx || tag.position === idx + 1);
      const fiveElement = yao?.fiveElement || '';
      const seasonStrength = yao?.seasonStrength || '';
      return {
        yaoIndex: idx,
        yaoLabel: interaction?.yaoLabel || YAO_LABELS[idx],
        yaoInfo: interaction?.yaoInfo || '',
        isMoving: !!yao?.isMoving,
        fiveElement,
        fiveElementClass: fiveElement ? WUXING_CLASS[fiveElement] : '',
        seasonStrength,
        seasonStrengthClass: seasonStrength ? STRENGTH_CLASS[seasonStrength] : '',
        changsheng: yao?.changsheng || '',
        relations: relation?.relations || [],
        variantRelation: interaction?.variantRelation || '',
        tags: tagInfo?.tags || [],
        energy: energyLine
          ? {
            baseScore: energyLine.base_score,
            finalScore: energyLine.final_score,
            level: energyLine.level
          }
          : null
      };
    });

    const resultWithAnalysis = {
      ...result,
      infoGrid: buildInfoGrid(result, dateValue || '', timeValue || ''),
      hexagramTable: buildHexagramTable(result),
      branchRelations: {
        dayBranch,
        hourBranch,
        dayRelations,
        hourRelations
      },
      yaoInteractions,
      yaoRelations,
      yaoUi,
    };
    return c.json(
      successResponse({
        result: resultWithAnalysis,
        meta: {
          dateValue: dateValue || '',
          timeValue: timeValue || '',
          ruleSetKey,
          question: question || '',
          manualMode: !!manualMode
        }
      })
    );
  } catch (error: any) {
    console.error('[DIVINATION COMPUTE ERROR]', error);
    return c.json(
      errorResponse('排盘计算失败，请稍后重试'),
      500
    );
  }
});

/**
 * 计算排卦去重的哈希值（使用 SubtleCrypto）
 * Hash = SHA256(userId + subject + category)
 * @param userId 用户ID
 * @param subject 问事内容/原因描述
 * @param category 问事类别（如：财运、婚姻、健康等）
 */
export async function calculateDivinationHash(
  userId: number,
  subject: string,
  category: string = 'default'
): Promise<string> {
  const hashInput = `${userId}:${subject}:${category}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(hashInput);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // 将 ArrayBuffer 转换为 hex 字符串
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 检查是否在 5 分钟内重复排卦（相同 hash）
 * 使用查询时过滤，而非后台定时清理，节省资源
 * @param db Drizzle 数据库实例
 * @param subjectHash 排卦哈希值
 */
export async function checkDuplicateDivination(db: any, subjectHash: string): Promise<boolean> {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  const duplicate = await db
    .select()
    .from(divinationRecords)
    .where(
      and(
        eq(divinationRecords.subjectHash, subjectHash),
        gt(divinationRecords.lastUsedAt, fiveMinutesAgo)
      )
    )
    .get();

  return !!duplicate;
}

/**
 * POST /api/divination/check-quota
 * 检查用户是否可以排卦
 * 请求体：{ subject, category? }
 * 返回：是否可以排卦 + 原因 + 是否重复
 */
divinationRouter.post('/check-quota', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(
      errorResponse('未授权：请先登录'),
      401
    );
  }

  const body = await c.req.json().catch(() => null);
  if (!body || !body.subject) {
    return c.json(
      errorResponse('缺少必要参数：subject'),
      400
    );
  }

  const { subject, category = 'default' } = body;
  const userId = payload.id;

  try {
    // 计算排卦哈希
    const subjectHash = await calculateDivinationHash(userId, subject, category);

    // 检查是否在 5 分钟内重复排卦
    const isDuplicate = await checkDuplicateDivination(db, subjectHash);

    // 检查配额状态
    const quotaStatus = await checkQuotaStatus(db, userId);

    const result: QuotaCheckResult = {
      canDivine: quotaStatus.canDivine && !isDuplicate,
      reason: isDuplicate
        ? '5分钟内已排过相同问题，请稍后再试'
        : quotaStatus.reason,
      isDuplicate,
      quotaRemaining: quotaStatus.quotaRemaining,
    };

    return c.json(successResponse(result));
  } catch (error: any) {
    console.error('[DIVINATION CHECK_QUOTA ERROR]', error);
    return c.json(
      errorResponse('检查失败，请稍后重试'),
      500
    );
  }
});

/**
 * POST /api/divination/divine
 * 执行排卦逻辑（消耗配额）
 * 请求体：{ subject, category?, inputData? }
 * 返回：排卦结果 + 配额扣减信息
 */
divinationRouter.post('/divine', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(
      errorResponse('未授权：请先登录'),
      401
    );
  }

  const body = await c.req.json().catch(() => null);
  if (!body || !body.subject) {
    return c.json(
      errorResponse('缺少必要参数：subject'),
      400
    );
  }

  const { subject, category = 'default', inputData } = body;
  const userId = payload.id;

  try {
    // 计算排卦哈希
    const subjectHash = await calculateDivinationHash(userId, subject, category);

    // 检查是否在 5 分钟内重复排卦
    const isDuplicate = await checkDuplicateDivination(db, subjectHash);

    if (isDuplicate) {
      return c.json(
        errorResponse('5分钟内已排过相同问题，请稍后再试'),
        400
      );
    }

    // 尝试扣减配额
    const deductResult = await deductQuota(db, userId);

    if (!deductResult.success) {
      return c.json(
        errorResponse(deductResult.reason),
        400
      );
    }

    // 记录排卦记录（用于5分钟去重检查）
    const now = Date.now();
    await db.insert(divinationRecords).values({
      userId,
      subjectHash,
      inputData: inputData ? JSON.stringify(inputData) : null,
      lastUsedAt: now,
      createdAt: now,
    });

    return c.json(
      successResponse(
        {
          success: true,
          quotaDeducted: {
            source: deductResult.source, // 'membership' | 'daily_free' | 'bonus_quota' | 'lingshi_free' | 'lingshi_bonus'
            reason: deductResult.reason,
            lingshiDeducted: deductResult.lingshiDeducted, // 仅当灵石扣减时显示
          },
          // 实际的排卦结果由其他模块生成，这里只返回配额信息
          guaData: {
            status: 'pending',
            message: '排卦中...',
          },
        },
        '排卦成功，配额已扣减'
      )
    );
  } catch (error: any) {
    console.error('[DIVINATION DIVINE ERROR]', error);
    return c.json(
      errorResponse('排卦失败，请稍后重试'),
      500
    );
  }
});

/**
 * GET /api/divination/history
 * 查询当前用户的排卦历史（可选：按日期范围过滤）
 * 查询参数：limit? (默认10), offset? (默认0)
 */
divinationRouter.get('/history', async (c) => {
  const db = drizzle(c.env.lingshu_db);
  const payload = c.get('jwtPayload') as JwtPayload | undefined;

  if (!payload || !payload.id) {
    return c.json(
      errorResponse('未授权：请先登录'),
      401
    );
  }

  try {
    const limit = Number(c.req.query('limit') || 10);
    const offset = Number(c.req.query('offset') || 0);

    const records = await db
      .select()
      .from(divinationRecords)
      .where(eq(divinationRecords.userId, payload.id))
      .orderBy(divinationRecords.createdAt)
      .limit(limit)
      .offset(offset)
      .all();

    return c.json(
      successResponse({
        count: records.length,
        limit,
        offset,
        records,
      })
    );
  } catch (error: any) {
    console.error('[DIVINATION HISTORY ERROR]', error);
    return c.json(
      errorResponse('查询失败，请稍后重试'),
      500
    );
  }
});
