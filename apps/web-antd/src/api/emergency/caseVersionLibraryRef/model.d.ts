import type { PageQuery, BaseEntity } from '#/api/common';

export interface CaseVersionLibraryRefVO {
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
  libraryItemId: string | number;

  /**
   * 
   */
  libraryVersionId: string | number;

  /**
   * 
   */
  refType: string;

  /**
   * 
   */
  jsonPath: string;

}

export interface CaseVersionLibraryRefForm extends BaseEntity {
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
  libraryItemId?: string | number;

  /**
   * 
   */
  libraryVersionId?: string | number;

  /**
   * 
   */
  refType?: string;

  /**
   * 
   */
  jsonPath?: string;

}

export interface CaseVersionLibraryRefQuery extends PageQuery {
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
  refType?: string;

  /**
    * 日期范围参数
    */
  params?: any;
}
