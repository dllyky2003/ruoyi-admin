import type { CaseVersionRuleIndexVO, CaseVersionRuleIndexForm, CaseVersionRuleIndexQuery } from './model';

import type { ID, IDS } from '#/api/common';
import type { PageResult } from '#/api/common';

import { commonExport } from '#/api/helper';
import { requestClient } from '#/api/request';

/**
* 查询病例版本的规则索引列表
* @param params
* @returns 病例版本的规则索引列表
*/
export function caseVersionRuleIndexList(params?: CaseVersionRuleIndexQuery) {
  return requestClient.get<PageResult<CaseVersionRuleIndexVO>>('/emergency/caseVersionRuleIndex/list', { params });
}

/**
 * 导出病例版本的规则索引列表
 * @param params
 * @returns 病例版本的规则索引列表
 */
export function caseVersionRuleIndexExport(params?: CaseVersionRuleIndexQuery) {
  return commonExport('/emergency/caseVersionRuleIndex/export', params ?? {});
}

/**
 * 查询病例版本的规则索引详情
 * @param caseVersionId id
 * @returns 病例版本的规则索引详情
 */
export function caseVersionRuleIndexInfo(caseVersionId: ID) {
  return requestClient.get<CaseVersionRuleIndexVO>(`/emergency/caseVersionRuleIndex/${caseVersionId}`);
}

/**
 * 新增病例版本的规则索引
 * @param data
 * @returns void
 */
export function caseVersionRuleIndexAdd(data: CaseVersionRuleIndexForm) {
  return requestClient.postWithMsg<void>('/emergency/caseVersionRuleIndex', data);
}

/**
 * 更新病例版本的规则索引
 * @param data
 * @returns void
 */
export function caseVersionRuleIndexUpdate(data: CaseVersionRuleIndexForm) {
  return requestClient.putWithMsg<void>('/emergency/caseVersionRuleIndex', data);
}

/**
 * 删除病例版本的规则索引
 * @param caseVersionId id
 * @returns void
 */
export function caseVersionRuleIndexRemove(caseVersionId: ID | IDS) {
  return requestClient.deleteWithMsg<void>(`/emergency/caseVersionRuleIndex/${caseVersionId}`);
}
