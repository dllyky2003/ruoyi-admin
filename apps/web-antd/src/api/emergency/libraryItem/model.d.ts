import type { PageQuery, BaseEntity } from '#/api/common';

export interface LibraryItemVO {
  /**
   * 
   */
  id: string | number;

  /**
   * 部门id
   */
  deptId: string | number;

  /**
   * 用户id
   */
  userId: string | number;

  /**
   * 排序号
   */
  orderNum: number;

  /**
   * 0=平台标准库(所有用户可见)，非0=机构级公共库
   */
  organizationId: string | number;

  /**
   * 
   */
  libraryType: string;

  /**
   * 
   */
  itemCode: string;

  /**
   * 
   */
  name: string;

  /**
   * 
   */
  status: string;

  /**
   * 
   */
  currentPublishedVersionId: string | number;

}

export interface LibraryItemForm extends BaseEntity {
  /**
   * 
   */
  id?: string | number;

  /**
   * 部门id
   */
  deptId?: string | number;

  /**
   * 用户id
   */
  userId?: string | number;

  /**
   * 排序号
   */
  orderNum?: number;

  /**
   * 0=平台标准库(所有用户可见)，非0=机构级公共库
   */
  organizationId?: string | number;

  /**
   * 
   */
  libraryType?: string;

  /**
   * 
   */
  itemCode?: string;

  /**
   * 
   */
  name?: string;

  /**
   * 
   */
  status?: string;

  /**
   * 
   */
  currentPublishedVersionId?: string | number;

}

export interface LibraryItemQuery extends PageQuery {
  /**
   * 部门id
   */
  deptId?: string | number;

  /**
   * 用户id
   */
  userId?: string | number;

  /**
   * 排序号
   */
  orderNum?: number;

  /**
   * 0=平台标准库(所有用户可见)，非0=机构级公共库
   */
  organizationId?: string | number;

  /**
   * 
   */
  libraryType?: string;

  /**
   * 
   */
  itemCode?: string;

  /**
   * 
   */
  name?: string;

  /**
   * 
   */
  status?: string;

  /**
   * 
   */
  currentPublishedVersionId?: string | number;

  /**
    * 日期范围参数
    */
  params?: any;
}
