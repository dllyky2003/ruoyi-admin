import type { TeachingCaseVO, TeachingCaseForm, TeachingCaseQuery } from './model';

import type { ID, IDS } from '#/api/common';
import type { PageResult } from '#/api/common';

import { commonExport } from '#/api/helper';
import { requestClient } from '#/api/request';

/**
* 查询病例身份；不保存具体教学定义列表
* @param params
* @returns 病例身份；不保存具体教学定义列表
*/
export function teachingCaseList(params?: TeachingCaseQuery) {
  return requestClient.get<PageResult<TeachingCaseVO>>('/emergency/teachingCase/list', { params });
}

/**
 * 导出病例身份；不保存具体教学定义列表
 * @param params
 * @returns 病例身份；不保存具体教学定义列表
 */
export function teachingCaseExport(params?: TeachingCaseQuery) {
  return commonExport('/emergency/teachingCase/export', params ?? {});
}

/**
 * 查询病例身份；不保存具体教学定义详情
 * @param id id
 * @returns 病例身份；不保存具体教学定义详情
 */
export function teachingCaseInfo(id: ID) {
  return requestClient.get<TeachingCaseVO>(`/emergency/teachingCase/${id}`);
}

/**
 * 新增病例身份；不保存具体教学定义
 * @param data
 * @returns void
 */
export function teachingCaseAdd(data: TeachingCaseForm) {
  return requestClient.postWithMsg<void>('/emergency/teachingCase', data);
}

/**
 * 更新病例身份；不保存具体教学定义
 * @param data
 * @returns void
 */
export function teachingCaseUpdate(data: TeachingCaseForm) {
  return requestClient.putWithMsg<void>('/emergency/teachingCase', data);
}

/**
 * 删除病例身份；不保存具体教学定义
 * @param id id
 * @returns void
 */
export function teachingCaseRemove(id: ID | IDS) {
  return requestClient.deleteWithMsg<void>(`/emergency/teachingCase/${id}`);
}
