import type { BaseEntity, PageQuery } from '#/api/common';

export interface LibraryItemVersionVO {
  /**
   *
   */
  id: number | string;

  /**
   * 部门id
   */
  deptId: number | string;

  /**
   * 用户id
   */
  userId: number | string;

  /**
   * 排序号
   */
  orderNum: number;

  /**
   *
   */
  libraryItemId: number | string;

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
   *
   */
  definitionJson: string;

  /**
   *
   */
  definitionHash: string;

  /**
   *
   */
  sourceGuideline: number | string;

  /**
   *
   */
  sourceVersion: string;

  /**
   *
   */
  effectiveFrom: string;

  /**
   *
   */
  effectiveTo: string;

  /**
   *
   */
  changeReason: string;

  /**
   *
   */
  reviewedBy: number;

  /**
   *
   */
  reviewedAt: string;
}

export interface LibraryItemVersionForm extends BaseEntity {
  /**
   *
   */
  id?: number | string;

  /**
   * 部门id
   */
  deptId?: number | string;

  /**
   * 用户id
   */
  userId?: number | string;

  /**
   * 排序号
   */
  orderNum?: number;

  /**
   *
   */
  libraryItemId?: number | string;

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
   *
   */
  definitionJson?: string;

  /**
   *
   */
  definitionHash?: string;

  /**
   *
   */
  sourceGuideline?: number | string;

  /**
   *
   */
  sourceVersion?: string;

  /**
   *
   */
  effectiveFrom?: string;

  /**
   *
   */
  effectiveTo?: string;

  /**
   *
   */
  changeReason?: string;

  /**
   *
   */
  reviewedBy?: number;

  /**
   *
   */
  reviewedAt?: string;

  caseType?: string;
}

export interface LibraryItemVersionQuery extends PageQuery {
  /**
   * 部门id
   */
  deptId?: number | string;

  /**
   * 用户id
   */
  userId?: number | string;

  /**
   * 排序号
   */
  orderNum?: number;

  /**
   *
   */
  libraryItemId?: number | string;

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
   *
   */
  definitionJson?: string;

  /**
   *
   */
  definitionHash?: string;

  /**
   *
   */
  sourceGuideline?: number | string;

  /**
   *
   */
  sourceVersion?: string;

  /**
   *
   */
  effectiveFrom?: string;

  /**
   *
   */
  effectiveTo?: string;

  /**
   *
   */
  changeReason?: string;

  /**
   *
   */
  reviewedBy?: number;

  /**
   *
   */
  reviewedAt?: string;

  /**
   * 日期范围参数
   */
  params?: any;
}
