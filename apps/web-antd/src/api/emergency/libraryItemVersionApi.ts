import { request } from '../ ../../../utils/request';
// ==================== 急救方案版本管理 API ====================

/**
 * 查询急救方案版本列表（分页）
 * @param params 分页及查询条件，例如 { pageNum, pageSize, name, status }
 */
export function libraryItemVersionList(params: Record<string, any>) {
  return request.get('/emergency/libraryItemVersion/list', { params });
}

/**
 * 获取急救方案版本详细信息
 * @param id 版本主键
 */
export function libraryItemVersionInfo(id: number) {
  return request.get(`/emergency/libraryItemVersion/${id}`);
}

/**
 * 新增急救方案版本
 * @param data 版本数据
 */
export function addLibraryItemVersion(data: Record<string, any>) {
  return request.post('/emergency/libraryItemVersion', data);
}

/**
 * 修改急救方案版本
 * @param data 版本数据
 */
export function updateLibraryItemVersion(data: Record<string, any>) {
  return request.put('/emergency/libraryItemVersion', data);
}

/**
 * 删除急救方案版本
 * @param ids 主键数组
 */
export function delLibraryItemVersion(ids: number[]) {
  return request.delete(`/emergency/libraryItemVersion/${ids.join(',')}`);
}

// ==================== 配置页面相关 API ====================

/**
 * 获取方案配置详情（用于配置页面加载完整数据）
 * @param id 版本ID
 */
export function getConfigureInfo(id: number) {
  return request.get('/emergency/libraryItemVersion/configure', {
    params: { id },
  });
}

/**
 * 保存方案配置草稿（支持新增和修改）
 * @param data 配置数据
 */
export function saveConfigure(data: Record<string, any>) {
  return request.post('/emergency/libraryItemVersion/configure/save', data);
}

/**
 * 发布方案版本
 * @param id 版本ID
 */
export function publishLibraryItemVersion(id: number) {
  return request.post('/emergency/libraryItemVersion/configure/publish', null, {
    params: { id },
  });
}

/**
 * 获取方案流程图 Mermaid 代码
 * @param id 版本ID
 */
export function getLibraryItemVersionMermaid(caseId: number | string) {
  return request.get('/ems/session/mermaid', {
    params: { caseId },
  });
}
