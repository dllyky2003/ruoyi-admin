import type { TeachingCaseVersionVO, TeachingCaseVersionForm, TeachingCaseVersionQuery } from './model';

import type { ID, IDS } from '#/api/common';
import type { PageResult } from '#/api/common';

import { commonExport } from '#/api/helper';
import { requestClient } from '#/api/request';

/**
* 查询病例定义版本；published 后禁止 UPDATE列表
* @param params
* @returns 病例定义版本；published 后禁止 UPDATE列表
*/
export function teachingCaseVersionList(params?: TeachingCaseVersionQuery) {
  return requestClient.get<PageResult<TeachingCaseVersionVO>>('/emergency/teachingCaseVersion/list', { params });
}

/**
 * 导出病例定义版本；published 后禁止 UPDATE列表
 * @param params
 * @returns 病例定义版本；published 后禁止 UPDATE列表
 */
export function teachingCaseVersionExport(params?: TeachingCaseVersionQuery) {
  return commonExport('/emergency/teachingCaseVersion/export', params ?? {});
}

/**
 * 查询病例定义版本；published 后禁止 UPDATE详情
 * @param id id
 * @returns 病例定义版本；published 后禁止 UPDATE详情
 */
export function teachingCaseVersionInfo(id: ID) {
  return requestClient.get<TeachingCaseVersionVO>(`/emergency/teachingCaseVersion/${id}`);
}

/**
 * 新增病例定义版本；published 后禁止 UPDATE
 * @param data
 * @returns void
 */
export function teachingCaseVersionAdd(data: TeachingCaseVersionForm) {
  return requestClient.postWithMsg<void>('/emergency/teachingCaseVersion', data);
}

/**
 * 更新病例定义版本；published 后禁止 UPDATE
 * @param data
 * @returns void
 */
export function teachingCaseVersionUpdate(data: TeachingCaseVersionForm) {
  return requestClient.putWithMsg<void>('/emergency/teachingCaseVersion', data);
}

/**
 * 删除病例定义版本；published 后禁止 UPDATE
 * @param id id
 * @returns void
 */
export function teachingCaseVersionRemove(id: ID | IDS) {
  return requestClient.deleteWithMsg<void>(`/emergency/teachingCaseVersion/${id}`);
}
