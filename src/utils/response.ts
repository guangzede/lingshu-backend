/**
 * 响应工具函数
 */
import { ApiResponse } from './types';

/**
 * 生成成功响应
 */
export function successResponse<T>(data?: T, message = '操作成功'): ApiResponse<T> {
  return {
    code: 200,
    message,
    data,
  };
}

/**
 * 生成错误响应
 */
export function errorResponse(message: string, code = 400): ApiResponse {
  return {
    code,
    message,
  };
}

/**
 * 隐敏手机号 (189****1234)
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

/**
 * 获取今天的日期标识 (YYYYMMDD 格式)
 * 使用 UTC+8 时区（北京时间）
 */
export function getTodayDate(): number {
  const now = new Date();
  // 转换为 UTC+8
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = utc8.getUTCFullYear();
  const month = String(utc8.getUTCMonth() + 1).padStart(2, '0');
  const date = String(utc8.getUTCDate()).padStart(2, '0');
  return parseInt(`${year}${month}${date}`);
}

/**
 * 检查是否是新的一天（用于重置每日配额）
 */
export function isNewDay(lastUsedDate: number): boolean {
  return lastUsedDate !== getTodayDate();
}
