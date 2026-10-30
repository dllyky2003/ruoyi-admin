import { request } from '../../utils/request';

export interface EvaluationResult {
  id: string;
  sessionId: string;
  totalScore: number;
  isPass: boolean;
  dimensionScores: Record<string, number>;
  criticalErrors: string[];
  warnings: string[];
  reportText: string;
  agentFusionScore?: number;
}

export const evaluationApi = {
  /**
   * 触发最终评估
   */
  trigger(sessionId: string) {
    return request.post<EvaluationResult>(
      `/api/ems/evaluation/trigger/${sessionId}`,
    );
  },

  /**
   * 获取评估结果
   */
  getResult(sessionId: string) {
    return request.get<EvaluationResult>(`/api/ems/evaluation/${sessionId}`);
  },

  /**
   * 获取多智能体诊断轨迹（教官专用）
   */
  getAgentTrace(sessionId: string) {
    return request.get(`/api/ems/evaluation/${sessionId}/agent-trace`);
  },
};
