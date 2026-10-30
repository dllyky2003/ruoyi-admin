import type { CaseVersionStageIndexVO, CaseVersionStageIndexForm, CaseVersionStageIndexQuery } from './model';

import type { ID, IDS } from '#/api/common';
import type { PageResult } from '#/api/common';

import { commonExport } from '#/api/helper';
import { requestClient } from '#/api/request';

/**
* 查询病例版本的阶段索引列表
* @param params
* @returns 病例版本的阶段索引列表
*/
export function caseVersionStageIndexList(params?: CaseVersionStageIndexQuery) {
  return requestClient.get<PageResult<CaseVersionStageIndexVO>>('/emergency/caseVersionStageIndex/list', { params });
}

/**
 * 导出病例版本的阶段索引列表
 * @param params
 * @returns 病例版本的阶段索引列表
 */
export function caseVersionStageIndexExport(params?: CaseVersionStageIndexQuery) {
  return commonExport('/emergency/caseVersionStageIndex/export', params ?? {});
}

/**
 * 查询病例版本的阶段索引详情
 * @param caseVersionId id
 * @returns 病例版本的阶段索引详情
 */
export function caseVersionStageIndexInfo(caseVersionId: ID) {
  return requestClient.get<CaseVersionStageIndexVO>(`/emergency/caseVersionStageIndex/${caseVersionId}`);
}

/**
 * 新增病例版本的阶段索引
 * @param data
 * @returns void
 */
export function caseVersionStageIndexAdd(data: CaseVersionStageIndexForm) {
  return requestClient.postWithMsg<void>('/emergency/caseVersionStageIndex', data);
}

/**
 * 更新病例版本的阶段索引
 * @param data
 * @returns void
 */
export function caseVersionStageIndexUpdate(data: CaseVersionStageIndexForm) {
  return requestClient.putWithMsg<void>('/emergency/caseVersionStageIndex', data);
}

/**
 * 删除病例版本的阶段索引
 * @param caseVersionId id
 * @returns void
 */
export function caseVersionStageIndexRemove(caseVersionId: ID | IDS) {
  return requestClient.deleteWithMsg<void>(`/emergency/caseVersionStageIndex/${caseVersionId}`);
}
