/**
 * EMS API 模块统一导出
 */

import * as evaluationApi from './evaluation.api';
import * as intentApi from './intent.api'; // 新增
import * as reportApi from './report.api';
import * as sessionApi from './session.api';

export * from './evaluation.api';
export * from './intent.api'; // 新增
export * from './report.api';
export * from './session.api';
export * from './types';

export default {
  session: sessionApi,
  evaluation: evaluationApi,
  report: reportApi,
  intent: intentApi, // 新增
};
