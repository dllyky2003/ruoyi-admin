import type { LibraryItemVO, LibraryItemForm, LibraryItemQuery } from './model';

import type { ID, IDS } from '#/api/common';
import type { PageResult } from '#/api/common';

import { commonExport } from '#/api/helper';
import { requestClient } from '#/api/request';

/**
* 查询公共库对象身份列表
* @param params
* @returns 公共库对象身份列表
*/
export function libraryItemList(params?: LibraryItemQuery) {
  return requestClient.get<PageResult<LibraryItemVO>>('/emergency/libraryItem/list', { params });
}

/**
 * 导出公共库对象身份列表
 * @param params
 * @returns 公共库对象身份列表
 */
export function libraryItemExport(params?: LibraryItemQuery) {
  return commonExport('/emergency/libraryItem/export', params ?? {});
}

/**
 * 查询公共库对象身份详情
 * @param id id
 * @returns 公共库对象身份详情
 */
export function libraryItemInfo(id: ID) {
  return requestClient.get<LibraryItemVO>(`/emergency/libraryItem/${id}`);
}

/**
 * 新增公共库对象身份
 * @param data
 * @returns void
 */
export function libraryItemAdd(data: LibraryItemForm) {
  return requestClient.postWithMsg<void>('/emergency/libraryItem', data);
}

/**
 * 更新公共库对象身份
 * @param data
 * @returns void
 */
export function libraryItemUpdate(data: LibraryItemForm) {
  return requestClient.putWithMsg<void>('/emergency/libraryItem', data);
}

/**
 * 删除公共库对象身份
 * @param id id
 * @returns void
 */
export function libraryItemRemove(id: ID | IDS) {
  return requestClient.deleteWithMsg<void>(`/emergency/libraryItem/${id}`);
}
