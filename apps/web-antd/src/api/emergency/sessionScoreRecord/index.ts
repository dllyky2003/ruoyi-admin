import type { SessionScoreRecordVO, SessionScoreRecordForm, SessionScoreRecordQuery } from './model';

import type { ID, IDS } from '#/api/common';
import type { PageResult } from '#/api/common';

import { commonExport } from '#/api/helper';
import { requestClient } from '#/api/request';

/**
* 查询会话评分记录（追加式）列表
* @param params
* @returns 会话评分记录（追加式）列表
*/
export function sessionScoreRecordList(params?: SessionScoreRecordQuery) {
  return requestClient.get<PageResult<SessionScoreRecordVO>>('/emergency/sessionScoreRecord/list', { params });
}

/**
 * 导出会话评分记录（追加式）列表
 * @param params
 * @returns 会话评分记录（追加式）列表
 */
export function sessionScoreRecordExport(params?: SessionScoreRecordQuery) {
  return commonExport('/emergency/sessionScoreRecord/export', params ?? {});
}

/**
 * 查询会话评分记录（追加式）详情
 * @param id id
 * @returns 会话评分记录（追加式）详情
 */
export function sessionScoreRecordInfo(id: ID) {
  return requestClient.get<SessionScoreRecordVO>(`/emergency/sessionScoreRecord/${id}`);
}

/**
 * 新增会话评分记录（追加式）
 * @param data
 * @returns void
 */
export function sessionScoreRecordAdd(data: SessionScoreRecordForm) {
  return requestClient.postWithMsg<void>('/emergency/sessionScoreRecord', data);
}

/**
 * 更新会话评分记录（追加式）
 * @param data
 * @returns void
 */
export function sessionScoreRecordUpdate(data: SessionScoreRecordForm) {
  return requestClient.putWithMsg<void>('/emergency/sessionScoreRecord', data);
}

/**
 * 删除会话评分记录（追加式）
 * @param id id
 * @returns void
 */
export function sessionScoreRecordRemove(id: ID | IDS) {
  return requestClient.deleteWithMsg<void>(`/emergency/sessionScoreRecord/${id}`);
}
