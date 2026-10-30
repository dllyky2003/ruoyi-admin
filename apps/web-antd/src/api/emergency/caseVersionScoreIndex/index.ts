import type { CaseVersionScoreIndexVO, CaseVersionScoreIndexForm, CaseVersionScoreIndexQuery } from './model';

import type { ID, IDS } from '#/api/common';
import type { PageResult } from '#/api/common';

import { commonExport } from '#/api/helper';
import { requestClient } from '#/api/request';

/**
* 查询病例版本评分项索引列表
* @param params
* @returns 病例版本评分项索引列表
*/
export function caseVersionScoreIndexList(params?: CaseVersionScoreIndexQuery) {
  return requestClient.get<PageResult<CaseVersionScoreIndexVO>>('/emergency/caseVersionScoreIndex/list', { params });
}

/**
 * 导出病例版本评分项索引列表
 * @param params
 * @returns 病例版本评分项索引列表
 */
export function caseVersionScoreIndexExport(params?: CaseVersionScoreIndexQuery) {
  return commonExport('/emergency/caseVersionScoreIndex/export', params ?? {});
}

/**
 * 查询病例版本评分项索引详情
 * @param caseVersionId id
 * @returns 病例版本评分项索引详情
 */
export function caseVersionScoreIndexInfo(caseVersionId: ID) {
  return requestClient.get<CaseVersionScoreIndexVO>(`/emergency/caseVersionScoreIndex/${caseVersionId}`);
}

/**
 * 新增病例版本评分项索引
 * @param data
 * @returns void
 */
export function caseVersionScoreIndexAdd(data: CaseVersionScoreIndexForm) {
  return requestClient.postWithMsg<void>('/emergency/caseVersionScoreIndex', data);
}

/**
 * 更新病例版本评分项索引
 * @param data
 * @returns void
 */
export function caseVersionScoreIndexUpdate(data: CaseVersionScoreIndexForm) {
  return requestClient.putWithMsg<void>('/emergency/caseVersionScoreIndex', data);
}

/**
 * 删除病例版本评分项索引
 * @param caseVersionId id
 * @returns void
 */
export function caseVersionScoreIndexRemove(caseVersionId: ID | IDS) {
  return requestClient.deleteWithMsg<void>(`/emergency/caseVersionScoreIndex/${caseVersionId}`);
}
