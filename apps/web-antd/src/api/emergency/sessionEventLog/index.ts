import type { SessionEventLogVO, SessionEventLogForm, SessionEventLogQuery } from './model';

import type { ID, IDS } from '#/api/common';
import type { PageResult } from '#/api/common';

import { commonExport } from '#/api/helper';
import { requestClient } from '#/api/request';

/**
* 查询会话事件日志（追加式/可审计）列表
* @param params
* @returns 会话事件日志（追加式/可审计）列表
*/
export function sessionEventLogList(params?: SessionEventLogQuery) {
  return requestClient.get<PageResult<SessionEventLogVO>>('/emergency/sessionEventLog/list', { params });
}

/**
 * 导出会话事件日志（追加式/可审计）列表
 * @param params
 * @returns 会话事件日志（追加式/可审计）列表
 */
export function sessionEventLogExport(params?: SessionEventLogQuery) {
  return commonExport('/emergency/sessionEventLog/export', params ?? {});
}

/**
 * 查询会话事件日志（追加式/可审计）详情
 * @param id id
 * @returns 会话事件日志（追加式/可审计）详情
 */
export function sessionEventLogInfo(id: ID) {
  return requestClient.get<SessionEventLogVO>(`/emergency/sessionEventLog/${id}`);
}

/**
 * 新增会话事件日志（追加式/可审计）
 * @param data
 * @returns void
 */
export function sessionEventLogAdd(data: SessionEventLogForm) {
  return requestClient.postWithMsg<void>('/emergency/sessionEventLog', data);
}

/**
 * 更新会话事件日志（追加式/可审计）
 * @param data
 * @returns void
 */
export function sessionEventLogUpdate(data: SessionEventLogForm) {
  return requestClient.putWithMsg<void>('/emergency/sessionEventLog', data);
}

/**
 * 删除会话事件日志（追加式/可审计）
 * @param id id
 * @returns void
 */
export function sessionEventLogRemove(id: ID | IDS) {
  return requestClient.deleteWithMsg<void>(`/emergency/sessionEventLog/${id}`);
}
