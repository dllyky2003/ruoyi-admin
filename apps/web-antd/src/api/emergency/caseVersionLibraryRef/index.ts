import type { CaseVersionLibraryRefVO, CaseVersionLibraryRefForm, CaseVersionLibraryRefQuery } from './model';

import type { ID, IDS } from '#/api/common';
import type { PageResult } from '#/api/common';

import { commonExport } from '#/api/helper';
import { requestClient } from '#/api/request';

/**
* 查询病例引用了哪些公共库版本；用于影响分析与发布校验列表
* @param params
* @returns 病例引用了哪些公共库版本；用于影响分析与发布校验列表
*/
export function caseVersionLibraryRefList(params?: CaseVersionLibraryRefQuery) {
  return requestClient.get<PageResult<CaseVersionLibraryRefVO>>('/emergency/caseVersionLibraryRef/list', { params });
}

/**
 * 导出病例引用了哪些公共库版本；用于影响分析与发布校验列表
 * @param params
 * @returns 病例引用了哪些公共库版本；用于影响分析与发布校验列表
 */
export function caseVersionLibraryRefExport(params?: CaseVersionLibraryRefQuery) {
  return commonExport('/emergency/caseVersionLibraryRef/export', params ?? {});
}

/**
 * 查询病例引用了哪些公共库版本；用于影响分析与发布校验详情
 * @param caseVersionId id
 * @returns 病例引用了哪些公共库版本；用于影响分析与发布校验详情
 */
export function caseVersionLibraryRefInfo(caseVersionId: ID) {
  return requestClient.get<CaseVersionLibraryRefVO>(`/emergency/caseVersionLibraryRef/${caseVersionId}`);
}

/**
 * 新增病例引用了哪些公共库版本；用于影响分析与发布校验
 * @param data
 * @returns void
 */
export function caseVersionLibraryRefAdd(data: CaseVersionLibraryRefForm) {
  return requestClient.postWithMsg<void>('/emergency/caseVersionLibraryRef', data);
}

/**
 * 更新病例引用了哪些公共库版本；用于影响分析与发布校验
 * @param data
 * @returns void
 */
export function caseVersionLibraryRefUpdate(data: CaseVersionLibraryRefForm) {
  return requestClient.putWithMsg<void>('/emergency/caseVersionLibraryRef', data);
}

/**
 * 删除病例引用了哪些公共库版本；用于影响分析与发布校验
 * @param caseVersionId id
 * @returns void
 */
export function caseVersionLibraryRefRemove(caseVersionId: ID | IDS) {
  return requestClient.deleteWithMsg<void>(`/emergency/caseVersionLibraryRef/${caseVersionId}`);
}
