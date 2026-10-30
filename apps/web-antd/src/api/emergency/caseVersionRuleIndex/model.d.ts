import type { PageQuery, BaseEntity } from '#/api/common';

export interface CaseVersionRuleIndexVO {
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
  ruleId: string | number;

  /**
   * 
   */
  stageId: string | number;

  /**
   * 
   */
  ruleName: string;

  /**
   * 
   */
  priorityNo: number;

  /**
   * 
   */
  enabled: number;

}

export interface CaseVersionRuleIndexForm extends BaseEntity {
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
  ruleId?: string | number;

  /**
   * 
   */
  stageId?: string | number;

  /**
   * 
   */
  ruleName?: string;

  /**
   * 
   */
  priorityNo?: number;

  /**
   * 
   */
  enabled?: number;

}

export interface CaseVersionRuleIndexQuery extends PageQuery {
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
  stageId?: string | number;

  /**
   * 
   */
  ruleName?: string;

  /**
   * 
   */
  priorityNo?: number;

  /**
   * 
   */
  enabled?: number;

  /**
    * 日期范围参数
    */
  params?: any;
}
