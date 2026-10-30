import { request } from '../../utils/request';

/**
 * 会话管理 API
 */
export const sessionApi = {
  /**
   * 创建考核会话
   * 后端使用 @RequestParam，需用表单格式提交
   */
  create(params: {
    mode?: 'EXAM' | 'TEACH';
    scenarioId: string;
    traineeName?: string;
  }) {
    const formData = new URLSearchParams();
    formData.append('scenarioId', params.scenarioId);
    if (params.traineeName) {
      formData.append('traineeName', params.traineeName);
    }
    formData.append('mode', params.mode || 'EXAM');

    return request.post<{ id: string }>('/ems/session/start', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },

  /**
   * 结束会话
   */
  end(sessionId: string) {
    return request.post(`/ems/session/end/${sessionId}`);
  },

  /**
   * 获取会话状态
   */
  getStatus(sessionId: string) {
    return request.get<{ currentState: string; status: string }>(
      `/ems/session/${sessionId}/status`,
    );
  },

  /**
   * 获取完整转写文本
   */
  getTranscript(sessionId: string) {
    return request.get<string>(`/ems/session/${sessionId}/transcript`);
  },
};
