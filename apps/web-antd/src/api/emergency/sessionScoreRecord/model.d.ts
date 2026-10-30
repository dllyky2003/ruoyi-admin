import type { PageQuery, BaseEntity } from '#/api/common';

export interface SessionScoreRecordVO {
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
  sessionId: string | number;

  /**
   * 
   */
  metricCode: string;

  /**
   * 
   */
  score: number;

  /**
   * 
   */
  maxScore: number;

  /**
   * 
   */
  result: string;

  /**
   * 
   */
  evidenceJson: string | number;

  /**
   * 
   */
  explanation: string;

  /**
   * 
   */
  determinedAt: string;

}

export interface SessionScoreRecordForm extends BaseEntity {
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
  sessionId?: string | number;

  /**
   * 
   */
  metricCode?: string;

  /**
   * 
   */
  score?: number;

  /**
   * 
   */
  maxScore?: number;

  /**
   * 
   */
  result?: string;

  /**
   * 
   */
  evidenceJson?: string | number;

  /**
   * 
   */
  explanation?: string;

  /**
   * 
   */
  determinedAt?: string;

}

export interface SessionScoreRecordQuery extends PageQuery {
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
  sessionId?: string | number;

  /**
   * 
   */
  metricCode?: string;

  /**
   * 
   */
  score?: number;

  /**
   * 
   */
  maxScore?: number;

  /**
   * 
   */
  result?: string;

  /**
   * 
   */
  evidenceJson?: string | number;

  /**
   * 
   */
  explanation?: string;

  /**
   * 
   */
  determinedAt?: string;

  /**
    * 日期范围参数
    */
  params?: any;
}
