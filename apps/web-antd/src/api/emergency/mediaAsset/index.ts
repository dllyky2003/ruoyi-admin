import type { MediaAssetVO, MediaAssetForm, MediaAssetQuery } from './model';

import type { ID, IDS } from '#/api/common';
import type { PageResult } from '#/api/common';

import { commonExport } from '#/api/helper';
import { requestClient } from '#/api/request';

/**
* 查询文件仅存对象存储，数据库保存元数据列表
* @param params
* @returns 文件仅存对象存储，数据库保存元数据列表
*/
export function mediaAssetList(params?: MediaAssetQuery) {
  return requestClient.get<PageResult<MediaAssetVO>>('/emergency/mediaAsset/list', { params });
}

/**
 * 导出文件仅存对象存储，数据库保存元数据列表
 * @param params
 * @returns 文件仅存对象存储，数据库保存元数据列表
 */
export function mediaAssetExport(params?: MediaAssetQuery) {
  return commonExport('/emergency/mediaAsset/export', params ?? {});
}

/**
 * 查询文件仅存对象存储，数据库保存元数据详情
 * @param id id
 * @returns 文件仅存对象存储，数据库保存元数据详情
 */
export function mediaAssetInfo(id: ID) {
  return requestClient.get<MediaAssetVO>(`/emergency/mediaAsset/${id}`);
}

/**
 * 新增文件仅存对象存储，数据库保存元数据
 * @param data
 * @returns void
 */
export function mediaAssetAdd(data: MediaAssetForm) {
  return requestClient.postWithMsg<void>('/emergency/mediaAsset', data);
}

/**
 * 更新文件仅存对象存储，数据库保存元数据
 * @param data
 * @returns void
 */
export function mediaAssetUpdate(data: MediaAssetForm) {
  return requestClient.putWithMsg<void>('/emergency/mediaAsset', data);
}

/**
 * 删除文件仅存对象存储，数据库保存元数据
 * @param id id
 * @returns void
 */
export function mediaAssetRemove(id: ID | IDS) {
  return requestClient.deleteWithMsg<void>(`/emergency/mediaAsset/${id}`);
}
