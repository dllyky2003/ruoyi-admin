import type { SessionStateSnapshotVO, SessionStateSnapshotForm, SessionStateSnapshotQuery } from './model';

import type { ID, IDS } from '#/api/common';
import type { PageResult } from '#/api/common';

import { commonExport } from '#/api/helper';
import { requestClient } from '#/api/request';

/**
* 查询会话状态快照（追加式）列表
* @param params
* @returns 会话状态快照（追加式）列表
*/
export function sessionStateSnapshotList(params?: SessionStateSnapshotQuery) {
  return requestClient.get<PageResult<SessionStateSnapshotVO>>('/emergency/sessionStateSnapshot/list', { params });
}

/**
 * 导出会话状态快照（追加式）列表
 * @param params
 * @returns 会话状态快照（追加式）列表
 */
export function sessionStateSnapshotExport(params?: SessionStateSnapshotQuery) {
  return commonExport('/emergency/sessionStateSnapshot/export', params ?? {});
}

/**
 * 查询会话状态快照（追加式）详情
 * @param id id
 * @returns 会话状态快照（追加式）详情
 */
export function sessionStateSnapshotInfo(id: ID) {
  return requestClient.get<SessionStateSnapshotVO>(`/emergency/sessionStateSnapshot/${id}`);
}

/**
 * 新增会话状态快照（追加式）
 * @param data
 * @returns void
 */
export function sessionStateSnapshotAdd(data: SessionStateSnapshotForm) {
  return requestClient.postWithMsg<void>('/emergency/sessionStateSnapshot', data);
}

/**
 * 更新会话状态快照（追加式）
 * @param data
 * @returns void
 */
export function sessionStateSnapshotUpdate(data: SessionStateSnapshotForm) {
  return requestClient.putWithMsg<void>('/emergency/sessionStateSnapshot', data);
}

/**
 * 删除会话状态快照（追加式）
 * @param id id
 * @returns void
 */
export function sessionStateSnapshotRemove(id: ID | IDS) {
  return requestClient.deleteWithMsg<void>(`/emergency/sessionStateSnapshot/${id}`);
}
