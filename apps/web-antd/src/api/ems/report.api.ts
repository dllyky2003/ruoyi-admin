/**
 * 报告 API
 *
 * 职责：
 * 1. 获取考核报告详情
 * 2. 多学员成绩对比
 * 3. 导出 Markdown / TXT 格式报告
 *
 * 对应后端：ReportController
 */

import type { EvaluationResult } from './types';

import { request } from '../../utils/request';

// ==================== 类型定义 ====================

/**
 * 报告详情响应（包装 EvaluationResult + 额外报告文本）
 */
export interface ReportDetail {
  /** 评估结果 */
  evaluation: EvaluationResult;
  /** 格式化报告文本 */
  reportText: string;
}

/**
 * 对比报告响应
 */
export interface ComparisonReport {
  /** 对比标题 */
  title: string;
  /** 各学员成绩摘要 */
  items: Array<{
    criticalErrors: string[];
    isPass: boolean;
    sessionId: string;
    totalScore: number;
    traineeName: string;
  }>;
  /** 综合评语 */
  summary: string;
}

// ==================== API 服务 ====================

export const reportApi = {
  /**
   * 获取详细报告（文本格式）
   * GET /api/ems/report/{sessionId}
   */
  getDetail(sessionId: string) {
    return request.get<string>(`/api/ems/report/${sessionId}`);
  },

  /**
   * 获取结构化报告（含评估数据 + 报告文本）
   * GET /api/ems/report/{sessionId}/structured
   *
   * 注意：若后端尚未提供此接口，可使用 evaluationApi.getResult() + reportApi.getDetail() 组合调用
   */
  getStructuredReport(sessionId: string) {
    return request.get<ReportDetail>(`/api/ems/report/${sessionId}/structured`);
  },

  /**
   * 多学员成绩对比
   * GET /api/ems/report/compare?sessionIds=xxx&sessionIds=yyy
   */
  getComparison(sessionIds: string[]) {
    return request.get<ComparisonReport>('/api/ems/report/compare', {
      params: {
        sessionIds, // Axios 自动序列化为 sessionIds=xxx&sessionIds=yyy
      },
    });
  },

  /**
   * 导出 Markdown 格式报告
   * GET /api/ems/report/{sessionId}/export/markdown
   *
   * 返回 Blob，可直接触发浏览器下载
   */
  exportMarkdown(sessionId: string, filename?: string) {
    return request.get<Blob>(`/api/ems/report/${sessionId}/export/markdown`, {
      responseType: 'blob',
      params: {
        filename: filename || `report_${sessionId}.md`,
      },
    });
  },

  /**
   * 导出 TXT 格式报告
   * GET /api/ems/report/{sessionId}/export/txt
   */
  exportTxt(sessionId: string, filename?: string) {
    return request.get<Blob>(`/api/ems/report/${sessionId}/export/txt`, {
      responseType: 'blob',
      params: {
        filename: filename || `report_${sessionId}.txt`,
      },
    });
  },

  /**
   * 导出 PDF 格式报告（预留，需后端支持）
   * GET /api/ems/report/{sessionId}/export/pdf
   */
  exportPdf(sessionId: string) {
    return request.get<Blob>(`/api/ems/report/${sessionId}/export/pdf`, {
      responseType: 'blob',
    });
  },
};

// ==================== 工具函数：处理 Blob 下载 ====================

/**
 * 触发浏览器下载 Blob 文件
 *
 * @param blob Blob 数据
 * @param filename 文件名
 *
 * @example
 * ```ts
 * const blob = await reportApi.exportMarkdown(sessionId);
 * downloadBlob(blob, `report_${sessionId}.md`);
 * ```
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * 获取报告文件名（根据会话ID和格式生成）
 */
export function getReportFilename(
  sessionId: string,
  format: 'md' | 'pdf' | 'txt' = 'md',
) {
  const date = new Date().toISOString().slice(0, 10);
  return `ACLS_考核报告_${sessionId.slice(0, 8)}_${date}.${format}`;
}
