/**
 * 统一响应格式
 */
export interface ApiResponse<T = any> {
  code: number; // 200=成功, 400=请求错误, 401=未授权, 403=禁止, 500=服务器错误
  message: string;
  data?: T;
}

/**
 * 配额检查结果
 */
export interface QuotaCheckResult {
  canDivine: boolean; // 是否可以排卦
  reason: string; // 原因（如"会员可用"、"免费配额充足"、"配额不足"等）
  isDuplicate: boolean; // 是否是5分钟内重复排卦
  quotaRemaining?: number; // 剩余可用次数（仅当canDivine为true时有意义）
}

/**
 * 用户信息（带隐敏处理）
 */
export interface UserInfo {
  id: number;
  username: string;
  phone: string; // 隐敏处理：189****1234
  nickname?: string;
  gender?: string;
  birthday?: string;
  memberPurchasedAt?: number;
  profileCompletedAt?: number;
  memberLevel: number;
  memberExpireAt: number;
  dailyFreeQuota: number;
  bonusQuota: number;
  lingshi: number;
  createdAt: number;
}

/**
 * JWT Payload 结构
 */
export interface JwtPayload {
  id: number;
  username: string;
  memberLevel: number;
  iat?: number;
  exp?: number;
  [key: string]: any; // 添加索引签名以兼容 Hono JWT
}
