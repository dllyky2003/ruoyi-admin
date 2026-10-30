import type { PageQuery, BaseEntity } from '#/api/common';

export interface CaseVersionResourceRefVO {
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
   * 
   */
  caseVersionId: string | number;

  /**
   * 
   */
  resourceConfigId: string | number;

  /**
   * 
   */
  libraryItemId: string | number;

  /**
   * 
   */
  libraryVersionId: string | number;

  /**
   * 
   */
  resourceType: string;

  /**
   * 
   */
  enabled: number;

}

export interface CaseVersionResourceRefForm extends BaseEntity {
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
   * 
   */
  caseVersionId?: string | number;

  /**
   * 
   */
  resourceConfigId?: string | number;

  /**
   * 
   */
  libraryItemId?: string | number;

  /**
   * 
   */
  libraryVersionId?: string | number;

  /**
   * 
   */
  resourceType?: string;

  /**
   * 
   */
  enabled?: number;

}

export interface CaseVersionResourceRefQuery extends PageQuery {
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
   * 
   */
  libraryItemId?: string | number;

  /**
   * 
   */
  libraryVersionId?: string | number;

  /**
   * 
   */
  resourceType?: string;

  /**
   * 
   */
  enabled?: number;

  /**
    * 日期范围参数
    */
  params?: any;
}
