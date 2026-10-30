import type { PageQuery, BaseEntity } from '#/api/common';

export interface CaseVersionScoreIndexVO {
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
  metricConfigId: string | number;

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
  weight: number;

  /**
   * 
   */
  enabled: number;

}

export interface CaseVersionScoreIndexForm extends BaseEntity {
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
  metricConfigId?: string | number;

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
  weight?: number;

  /**
   * 
   */
  enabled?: number;

}

export interface CaseVersionScoreIndexQuery extends PageQuery {
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
  weight?: number;

  /**
   * 
   */
  enabled?: number;

  /**
    * 日期范围参数
    */
  params?: any;
}
