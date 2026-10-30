import type { LibraryItemVersionVO, LibraryItemVersionForm, LibraryItemVersionQuery } from './model';

import type { ID, IDS } from '#/api/common';
import type { PageResult } from '#/api/common';

import { commonExport } from '#/api/helper';
import { requestClient } from '#/api/request';

/**
* 查询公共库冻结定义；published 后禁止 UPDATE列表
* @param params
* @returns 公共库冻结定义；published 后禁止 UPDATE列表
*/
export function libraryItemVersionList(params?: LibraryItemVersionQuery) {
  return requestClient.get<PageResult<LibraryItemVersionVO>>('/emergency/libraryItemVersion/list', { params });
}

/**
 * 导出公共库冻结定义；published 后禁止 UPDATE列表
 * @param params
 * @returns 公共库冻结定义；published 后禁止 UPDATE列表
 */
export function libraryItemVersionExport(params?: LibraryItemVersionQuery) {
  return commonExport('/emergency/libraryItemVersion/export', params ?? {});
}

/**
 * 查询公共库冻结定义；published 后禁止 UPDATE详情
 * @param id id
 * @returns 公共库冻结定义；published 后禁止 UPDATE详情
 */
export function libraryItemVersionInfo(id: ID) {
  return requestClient.get<LibraryItemVersionVO>(`/emergency/libraryItemVersion/${id}`);
}

/**
 * 新增公共库冻结定义；published 后禁止 UPDATE
 * @param data
 * @returns void
 */
export function libraryItemVersionAdd(data: LibraryItemVersionForm) {
  return requestClient.postWithMsg<void>('/emergency/libraryItemVersion', data);
}

/**
 * 更新公共库冻结定义；published 后禁止 UPDATE
 * @param data
 * @returns void
 */
export function libraryItemVersionUpdate(data: LibraryItemVersionForm) {
  return requestClient.putWithMsg<void>('/emergency/libraryItemVersion', data);
}

/**
 * 删除公共库冻结定义；published 后禁止 UPDATE
 * @param id id
 * @returns void
 */
export function libraryItemVersionRemove(id: ID | IDS) {
  return requestClient.deleteWithMsg<void>(`/emergency/libraryItemVersion/${id}`);
}
