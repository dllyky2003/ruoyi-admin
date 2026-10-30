import type { PageQuery, BaseEntity } from '#/api/common';

export interface CaseVersionStageIndexVO {
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
  stageId: string | number;

  /**
   * 
   */
  stageName: string;

  /**
   * 
   */
  sequenceNo: number;

  /**
   * 
   */
  maxDurationSec: number;

}

export interface CaseVersionStageIndexForm extends BaseEntity {
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
  stageId?: string | number;

  /**
   * 
   */
  stageName?: string;

  /**
   * 
   */
  sequenceNo?: number;

  /**
   * 
   */
  maxDurationSec?: number;

}

export interface CaseVersionStageIndexQuery extends PageQuery {
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
  stageName?: string;

  /**
   * 
   */
  sequenceNo?: number;

  /**
   * 
   */
  maxDurationSec?: number;

  /**
    * 日期范围参数
    */
  params?: any;
}
