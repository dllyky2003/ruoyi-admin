import type { TrainingSessionVO, TrainingSessionForm, TrainingSessionQuery } from './model';

import type { ID, IDS } from '#/api/common';
import type { PageResult } from '#/api/common';

import { commonExport } from '#/api/helper';
import { requestClient } from '#/api/request';

/**
* 查询训练会话列表
* @param params
* @returns 训练会话列表
*/
export function trainingSessionList(params?: TrainingSessionQuery) {
  return requestClient.get<PageResult<TrainingSessionVO>>('/emergency/trainingSession/list', { params });
}

/**
 * 导出训练会话列表
 * @param params
 * @returns 训练会话列表
 */
export function trainingSessionExport(params?: TrainingSessionQuery) {
  return commonExport('/emergency/trainingSession/export', params ?? {});
}

/**
 * 查询训练会话详情
 * @param id id
 * @returns 训练会话详情
 */
export function trainingSessionInfo(id: ID) {
  return requestClient.get<TrainingSessionVO>(`/emergency/trainingSession/${id}`);
}

/**
 * 新增训练会话
 * @param data
 * @returns void
 */
export function trainingSessionAdd(data: TrainingSessionForm) {
  return requestClient.postWithMsg<void>('/emergency/trainingSession', data);
}

/**
 * 更新训练会话
 * @param data
 * @returns void
 */
export function trainingSessionUpdate(data: TrainingSessionForm) {
  return requestClient.putWithMsg<void>('/emergency/trainingSession', data);
}

/**
 * 删除训练会话
 * @param id id
 * @returns void
 */
export function trainingSessionRemove(id: ID | IDS) {
  return requestClient.deleteWithMsg<void>(`/emergency/trainingSession/${id}`);
}
