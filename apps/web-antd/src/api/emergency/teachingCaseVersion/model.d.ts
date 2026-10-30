import type { PageQuery, BaseEntity } from '#/api/common';

export interface TeachingCaseVersionVO {
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
  caseId: string | number;

  /**
   * 
   */
  versionNo: number;

  /**
   * 
   */
  schemaVersion: string;

  /**
   * draft/reviewing/published/archived
   */
  status: string;

  /**
   * 病例方案唯一事实源
   */
  definitionJson: string;

  /**
   * 
   */
  definitionHash: string;

  /**
   * 
   */
  basedOnVersionId: string | number;

  /**
   * 
   */
  changeSummary: string;

  /**
   * 
   */
  reviewedBy: number;

  /**
   * 
   */
  reviewedAt: string;

  /**
   * 
   */
  publishedBy: number;

  /**
   * 
   */
  publishedAt: string;

}

export interface TeachingCaseVersionForm extends BaseEntity {
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
  caseId?: string | number;

  /**
   * 
   */
  versionNo?: number;

  /**
   * 
   */
  schemaVersion?: string;

  /**
   * draft/reviewing/published/archived
   */
  status?: string;

  /**
   * 病例方案唯一事实源
   */
  definitionJson?: string;

  /**
   * 
   */
  definitionHash?: string;

  /**
   * 
   */
  basedOnVersionId?: string | number;

  /**
   * 
   */
  changeSummary?: string;

  /**
   * 
   */
  reviewedBy?: number;

  /**
   * 
   */
  reviewedAt?: string;

  /**
   * 
   */
  publishedBy?: number;

  /**
   * 
   */
  publishedAt?: string;

}

export interface TeachingCaseVersionQuery extends PageQuery {
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
  caseId?: string | number;

  /**
   * 
   */
  versionNo?: number;

  /**
   * 
   */
  schemaVersion?: string;

  /**
   * draft/reviewing/published/archived
   */
  status?: string;

  /**
   * 病例方案唯一事实源
   */
  definitionJson?: string;

  /**
   * 
   */
  definitionHash?: string;

  /**
   * 
   */
  basedOnVersionId?: string | number;

  /**
   * 
   */
  changeSummary?: string;

  /**
   * 
   */
  reviewedBy?: number;

  /**
   * 
   */
  reviewedAt?: string;

  /**
   * 
   */
  publishedBy?: number;

  /**
   * 
   */
  publishedAt?: string;

  /**
    * 日期范围参数
    */
  params?: any;
}
