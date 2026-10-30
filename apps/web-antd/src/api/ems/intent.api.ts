/**
 * 意图 API
 *
 * 职责：
 * 1. 获取意图定义列表（子域 + 意图 + 示例）
 *
 * 对应后端：IntentController
 */

import type { SubDomain } from './types';

import { request } from '../../utils/request';

export const intentApi = {
  /**
   * 获取意图定义列表
   * GET /api/intents/definitions
   *
   * @param caseId 可选，按案例过滤（仅返回该案例专属子域 + 通用子域）
   * @returns Promise<SubDomain[]>
   *
   * @example
   * ```ts
   * // 获取全部意图
   * const all = await intentApi.getDefinitions();
   *
   * // 按案例过滤
   * const filtered = await intentApi.getDefinitions('stable_narrow');
   * ```
   */
  getDefinitions(caseId?: string) {
    return request.get<SubDomain[]>('/ems/session/definitions', {
      params: caseId ? { caseId } : {},
    });
  },
};
