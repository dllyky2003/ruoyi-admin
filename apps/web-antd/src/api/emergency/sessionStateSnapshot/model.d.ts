import type { PageQuery, BaseEntity } from '#/api/common';

export interface SessionStateSnapshotVO {
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
  sequenceNo: number;

  /**
   * 
   */
  occurredAt: string;

  /**
   * 
   */
  stateJson: string;

  /**
   * 
   */
  stateHash: string;

}

export interface SessionStateSnapshotForm extends BaseEntity {
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
  sequenceNo?: number;

  /**
   * 
   */
  occurredAt?: string;

  /**
   * 
   */
  stateJson?: string;

  /**
   * 
   */
  stateHash?: string;

}

export interface SessionStateSnapshotQuery extends PageQuery {
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
  sequenceNo?: number;

  /**
   * 
   */
  occurredAt?: string;

  /**
   * 
   */
  stateJson?: string;

  /**
   * 
   */
  stateHash?: string;

  /**
    * 日期范围参数
    */
  params?: any;
}
