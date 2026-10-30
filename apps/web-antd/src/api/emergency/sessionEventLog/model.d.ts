import type { PageQuery, BaseEntity } from '#/api/common';

export interface SessionEventLogVO {
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
  eventType: string;

  /**
   * device/user/asr/instructor/rule_engine/system
   */
  sourceType: string;

  /**
   * 
   */
  sourceId: string | number;

  /**
   * 
   */
  payloadJson: string;

  /**
   * 
   */
  decisionJson: string;

  /**
   * 
   */
  createdAt: string;

}

export interface SessionEventLogForm extends BaseEntity {
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
  eventType?: string;

  /**
   * device/user/asr/instructor/rule_engine/system
   */
  sourceType?: string;

  /**
   * 
   */
  sourceId?: string | number;

  /**
   * 
   */
  payloadJson?: string;

  /**
   * 
   */
  decisionJson?: string;

  /**
   * 
   */
  createdAt?: string;

}

export interface SessionEventLogQuery extends PageQuery {
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
  eventType?: string;

  /**
   * device/user/asr/instructor/rule_engine/system
   */
  sourceType?: string;

  /**
   * 
   */
  sourceId?: string | number;

  /**
   * 
   */
  payloadJson?: string;

  /**
   * 
   */
  decisionJson?: string;

  /**
   * 
   */
  createdAt?: string;

  /**
    * 日期范围参数
    */
  params?: any;
}
