import type { PageQuery, BaseEntity } from '#/api/common';

export interface TeachingCaseVO {
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
   * 
   */
  caseCode: string;

  /**
   * 机构/单位隔离维度
   */
  organizationId: string | number;

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

export interface TeachingCaseForm extends BaseEntity {
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
   * 
   */
  caseCode?: string;

  /**
   * 机构/单位隔离维度
   */
  organizationId?: string | number;

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

export interface TeachingCaseQuery extends PageQuery {
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
  caseCode?: string;

  /**
   * 机构/单位隔离维度
   */
  organizationId?: string | number;

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
