import type { CaseVersionResourceRefVO, CaseVersionResourceRefForm, CaseVersionResourceRefQuery } from './model';

import type { ID, IDS } from '#/api/common';
import type { PageResult } from '#/api/common';

import { commonExport } from '#/api/helper';
import { requestClient } from '#/api/request';

/**
* 查询病例版本引用的资源配置与公共库版本映射列表
* @param params
* @returns 病例版本引用的资源配置与公共库版本映射列表
*/
export function caseVersionResourceRefList(params?: CaseVersionResourceRefQuery) {
  return requestClient.get<PageResult<CaseVersionResourceRefVO>>('/emergency/caseVersionResourceRef/list', { params });
}

/**
 * 导出病例版本引用的资源配置与公共库版本映射列表
 * @param params
 * @returns 病例版本引用的资源配置与公共库版本映射列表
 */
export function caseVersionResourceRefExport(params?: CaseVersionResourceRefQuery) {
  return commonExport('/emergency/caseVersionResourceRef/export', params ?? {});
}

/**
 * 查询病例版本引用的资源配置与公共库版本映射详情
 * @param caseVersionId id
 * @returns 病例版本引用的资源配置与公共库版本映射详情
 */
export function caseVersionResourceRefInfo(caseVersionId: ID) {
  return requestClient.get<CaseVersionResourceRefVO>(`/emergency/caseVersionResourceRef/${caseVersionId}`);
}

/**
 * 新增病例版本引用的资源配置与公共库版本映射
 * @param data
 * @returns void
 */
export function caseVersionResourceRefAdd(data: CaseVersionResourceRefForm) {
  return requestClient.postWithMsg<void>('/emergency/caseVersionResourceRef', data);
}

/**
 * 更新病例版本引用的资源配置与公共库版本映射
 * @param data
 * @returns void
 */
export function caseVersionResourceRefUpdate(data: CaseVersionResourceRefForm) {
  return requestClient.putWithMsg<void>('/emergency/caseVersionResourceRef', data);
}

/**
 * 删除病例版本引用的资源配置与公共库版本映射
 * @param caseVersionId id
 * @returns void
 */
export function caseVersionResourceRefRemove(caseVersionId: ID | IDS) {
  return requestClient.deleteWithMsg<void>(`/emergency/caseVersionResourceRef/${caseVersionId}`);
}
