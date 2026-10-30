import type { PageQuery, BaseEntity } from '#/api/common';

export interface TrainingSessionVO {
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
  sessionCode: string;

  /**
   * 机构/单位隔离维度
   */
  organizationId: string | number;

  /**
   * 
   */
  caseVersionId: string | number;

  /**
   * 
   */
  caseDefinitionHash: string;

  /**
   * created/running/paused/completed/aborted
   */
  status: string;

  /**
   * 
   */
  startedAt: string;

  /**
   * 
   */
  endedAt: string;

}

export interface TrainingSessionForm extends BaseEntity {
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
  sessionCode?: string;

  /**
   * 机构/单位隔离维度
   */
  organizationId?: string | number;

  /**
   * 
   */
  caseVersionId?: string | number;

  /**
   * 
   */
  caseDefinitionHash?: string;

  /**
   * created/running/paused/completed/aborted
   */
  status?: string;

  /**
   * 
   */
  startedAt?: string;

  /**
   * 
   */
  endedAt?: string;

}

export interface TrainingSessionQuery extends PageQuery {
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
  sessionCode?: string;

  /**
   * 机构/单位隔离维度
   */
  organizationId?: string | number;

  /**
   * 
   */
  caseVersionId?: string | number;

  /**
   * 
   */
  caseDefinitionHash?: string;

  /**
   * created/running/paused/completed/aborted
   */
  status?: string;

  /**
   * 
   */
  startedAt?: string;

  /**
   * 
   */
  endedAt?: string;

  /**
    * 日期范围参数
    */
  params?: any;
}
