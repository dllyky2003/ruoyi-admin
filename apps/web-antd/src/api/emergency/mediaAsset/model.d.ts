import type { PageQuery, BaseEntity } from '#/api/common';

export interface MediaAssetVO {
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
  organizationId: string | number;

  /**
   * image/audio/video/ecg/pdf/waveform
   */
  assetType: string;

  /**
   * 
   */
  storageKey: string;

  /**
   * 
   */
  originalFilename: string;

  /**
   * 
   */
  mimeType: string;

  /**
   * 
   */
  byteSize: number;

  /**
   * 
   */
  sha256: string;

  /**
   * 
   */
  metadataJson: string;

}

export interface MediaAssetForm extends BaseEntity {
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
  organizationId?: string | number;

  /**
   * image/audio/video/ecg/pdf/waveform
   */
  assetType?: string;

  /**
   * 
   */
  storageKey?: string;

  /**
   * 
   */
  originalFilename?: string;

  /**
   * 
   */
  mimeType?: string;

  /**
   * 
   */
  byteSize?: number;

  /**
   * 
   */
  sha256?: string;

  /**
   * 
   */
  metadataJson?: string;

}

export interface MediaAssetQuery extends PageQuery {
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
  organizationId?: string | number;

  /**
   * image/audio/video/ecg/pdf/waveform
   */
  assetType?: string;

  /**
   * 
   */
  storageKey?: string;

  /**
   * 
   */
  originalFilename?: string;

  /**
   * 
   */
  mimeType?: string;

  /**
   * 
   */
  byteSize?: number;

  /**
   * 
   */
  sha256?: string;

  /**
   * 
   */
  metadataJson?: string;

  /**
    * 日期范围参数
    */
  params?: any;
}
