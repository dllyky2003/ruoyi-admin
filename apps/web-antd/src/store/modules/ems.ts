/**
 * EMS (Emergency Medical Services) Pinia 状态管理
 *
 * 职责：
 * 1. 管理 EMS 模块的全局状态（会话、评估、转写等）
 * 2. 提供状态变更的 actions
 * 3. 支持跨组件状态共享
 * 4. 支持持久化（通过 pinia-plugin-persistedstate）
 *
 * @example
 * ```ts
 * import { useEmsStore } from '@/store/modules/ems';
 *
 * const store = useEmsStore();
 *
 * // 创建会话
 * await store.createSession('SCE-2025-001', '张三');
 *
 * // 获取会话ID
 * console.log(store.sessionId);
 *
 * // 追加转写文本
 * store.appendTranscript('心率160，有脉搏');
 * ```
 */

import type {
  EvaluationResult,
  Scenario,
  Session,
  SubDomain,
} from '../../api/ems/types';

import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import { evaluationApi, intentApi, sessionApi } from '../../api/ems';

// ==================== 类型定义 ====================

/** EMS Store 状态 */
export interface EmsState {
  /** 当前会话 */
  session: null | Session;
  /** 评估结果 */
  evaluation: EvaluationResult | null;
  /** 转写文本（累积） */
  transcript: string;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: null | string;
  /** 场景列表 */
  scenarios: Scenario[];
  /** 历史会话列表 */
  history: Session[];
  /** 意图定义列表 */
  intentDefinitions: SubDomain[];
  /** 加载意图状态 */
  loadingIntents: boolean;
}

// ==================== Store 定义 ====================

export const useEmsStore = defineStore('ems', () => {
  // ============================================
  // State
  // ============================================

  /** 当前会话 */
  const session = ref<null | Session>(null);
  /** 评估结果 */
  const evaluation = ref<EvaluationResult | null>(null);
  /** 累积转写文本 */
  const transcript = ref<string>('');
  /** 加载状态 */
  const loading = ref(false);
  /** 错误信息 */
  const error = ref<null | string>(null);
  /** 场景列表 */
  const scenarios = ref<Scenario[]>([]);
  /** 历史会话列表 */
  const history = ref<Session[]>([]);
  /** 意图定义列表（子域 + 意图） */
  const intentDefinitions = ref<SubDomain[]>([]);
  /** 加载意图状态 */
  const loadingIntents = ref(false);

  // ============================================
  // Getters (computed)
  // ============================================

  /** 会话ID */
  const sessionId = computed<string | undefined>(() => session.value?.id);

  /** 是否正在运行 */
  const isRunning = computed<boolean>(
    () => session.value?.status === 'RUNNING',
  );

  /** 是否已完成 */
  const isCompleted = computed<boolean>(
    () => session.value?.status === 'COMPLETED',
  );

  /** 是否通过考核 */
  const isPassed = computed<boolean>(() => evaluation.value?.isPass ?? false);

  /** 总分 */
  const totalScore = computed<number | undefined>(
    () => evaluation.value?.totalScore,
  );

  /** 是否有致命错误 */
  const hasCriticalErrors = computed<boolean>(() => {
    const errors = evaluation.value?.criticalErrors;
    return errors !== undefined && errors.length > 0;
  });

  /** 格式化评分等级 */
  const scoreLevel = computed<
    'average' | 'excellent' | 'fail' | 'good' | 'poor'
  >(() => {
    const score = totalScore.value;
    if (score === undefined) return 'average';
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'average';
    if (score >= 60) return 'poor';
    return 'fail';
  });

  /** 是否有进行中的会话（未结束） */
  const hasActiveSession = computed<boolean>(() => {
    return session.value !== null && session.value.status !== 'COMPLETED';
  });

  /** 转写长度（字符数） */
  const transcriptLength = computed<number>(() => transcript.value.length);

  /** 转写词数（按空格分割） */
  const transcriptWordCount = computed<number>(() => {
    if (!transcript.value) return 0;
    return transcript.value.trim().split(/\s+/).length;
  });

  // ============================================
  // Actions
  // ============================================

  /**
   * 创建会话
   */
  async function createSession(
    scenarioId: string,
    traineeName: string = '学员',
    mode: 'EXAM' | 'TEACH' = 'EXAM',
  ): Promise<Session> {
    loading.value = true;
    error.value = null;

    try {
      const result = await sessionApi.create({ scenarioId, traineeName, mode });
      session.value = result.data;
      // 重置转写文本
      transcript.value = '';
      return result.data;
    } catch (error_) {
      const msg = error_ instanceof Error ? error_.message : '创建会话失败';
      error.value = msg;
      throw error_;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 结束会话
   */
  async function endSession(): Promise<void> {
    if (!session.value) {
      console.warn('[EmsStore] 没有活跃会话');
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      await sessionApi.end(session.value.id);
      if (session.value) {
        session.value.status = 'COMPLETED';
        session.value.endTime = new Date().toISOString();
      }
    } catch (error_) {
      const msg = error_ instanceof Error ? error_.message : '结束会话失败';
      error.value = msg;
      throw error_;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取会话状态
   */
  async function fetchSessionStatus(
    sessionId: string,
  ): Promise<null | { currentState: string; status: string }> {
    try {
      const result = await sessionApi.getStatus(sessionId);
      return result.data;
    } catch (error_) {
      console.error('[EmsStore] 获取会话状态失败:', error_);
      return null;
    }
  }

  /**
   * 获取转写文本
   */
  async function receiveTranscript(
    sessionId: string,
    text: string,
  ): Promise<string> {
    try {
      const result = await sessionApi.receiveTranscript(sessionId, text);
      if (result.data) {
        transcript.value = result.data;
        return result.data;
      }
      return '';
    } catch (error_) {
      console.error('[EmsStore] 获取转写文本失败:', error_);
      return transcript.value;
    }
  }

  /**
   * 追加转写文本（由 WebSocket 消息触发）
   */
  function appendTranscript(text: string): void {
    transcript.value += `${text} `;
  }

  /**
   * 设置转写文本（覆盖）
   */
  function setTranscript(text: string): void {
    transcript.value = text;
  }

  /**
   * 清空转写文本
   */
  function clearTranscript(): void {
    transcript.value = '';
  }

  /**
   * 触发评估
   */
  async function triggerEvaluation(): Promise<EvaluationResult> {
    if (!session.value) {
      throw new Error('没有活跃会话');
    }

    loading.value = true;
    error.value = null;

    try {
      const result = await evaluationApi.trigger(session.value.id);
      evaluation.value = result.data;
      return result.data;
    } catch (error_) {
      const msg = error_ instanceof Error ? error_.message : '触发评估失败';
      error.value = msg;
      throw error_;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取评估结果（直接查询）
   */
  async function fetchEvaluation(
    sessionId?: string,
  ): Promise<EvaluationResult | null> {
    const targetSessionId = sessionId || session.value?.id;
    if (!targetSessionId) {
      console.warn('[EmsStore] 没有可用的会话ID');
      return null;
    }

    try {
      const result = await evaluationApi.getResult(targetSessionId);
      if (result.data) {
        evaluation.value = result.data;
        return result.data;
      }
      return null;
    } catch (error_) {
      // 404 表示评估尚未完成，不视为错误
      if ((error_ as any)?.response?.status === 404) {
        return null;
      }
      console.error('[EmsStore] 获取评估结果失败:', error_);
      return null;
    }
  }

  /**
   * 获取智能体诊断轨迹
   */
  async function fetchAgentTrace(
    sessionId?: string,
  ): Promise<null | Record<string, any>> {
    const targetSessionId = sessionId || session.value?.id;
    if (!targetSessionId) {
      return null;
    }

    try {
      const result = await evaluationApi.getAgentTrace(targetSessionId);
      return result.data;
    } catch (error_) {
      console.warn('[EmsStore] 获取智能体轨迹失败:', error_);
      return null;
    }
  }

  /**
   * 加载场景列表
   */
  async function loadScenarios(): Promise<Scenario[]> {
    try {
      // 调用场景 API（如果已实现）
      // const result = await scenarioApi.list();
      // scenarios.value = result.data;
      // return result.data;

      // 临时模拟数据
      const mockScenarios: Scenario[] = [
        {
          id: 'unstable_narrow_svt',
          name: '稳定窄QRS心动过速',
          difficulty: 'BASIC',
          guideVersion: 'AHA-2025',
          description: '患者心率>150bpm，有脉搏，血流动力学稳定，窄QRS心动过速',
        },
        {
          id: 'SCE-2025-002',
          name: '不稳定心动过速（低血压）',
          difficulty: 'INTERMEDIATE',
          guideVersion: 'AHA-2025',
          description: '患者心率>150bpm，有脉搏，低血压，需同步电复律',
        },
        {
          id: 'SCE-2025-003',
          name: '宽QRS不规则心动过速',
          difficulty: 'ADVANCED',
          guideVersion: 'AHA-2025',
          description: '宽QRS不规则心动过速，可能为多形性VT/TdP',
        },
      ];
      scenarios.value = mockScenarios;
      return mockScenarios;
    } catch (error_) {
      console.error('[EmsStore] 加载场景列表失败:', error_);
      return [];
    }
  }

  /**
   * 加载历史会话
   */
  async function loadHistory(): Promise<Session[]> {
    try {
      // 调用历史 API（如果已实现）
      // const result = await historyApi.list();
      // history.value = result.data;
      // return result.data;

      // 临时返回空数组
      history.value = [];
      return [];
    } catch (error_) {
      console.error('[EmsStore] 加载历史会话失败:', error_);
      return [];
    }
  }

  /**
   * 加载意图定义
   * @param caseId 可选，按案例过滤
   */
  async function loadIntentDefinitions(caseId?: string): Promise<SubDomain[]> {
    loadingIntents.value = true;
    try {
      const result = await intentApi.getDefinitions(caseId);
      // console.log('[EmsStore] 原始响应:', result); // ← 添加日志
      // 兼容多种响应结构
      let data: SubDomain[] = [];
      if (result && typeof result === 'object') {
        if (Array.isArray(result)) {
          data = result;
        } else if (Array.isArray(result.data)) {
          data = result.data;
        } else if (Array.isArray(result.list)) {
          data = result.list;
        }
      }

      intentDefinitions.value = data;
      return data;
    } catch (error) {
      console.error('[EmsStore] 加载意图定义失败:', error);
      intentDefinitions.value = [];
      return [];
    } finally {
      loadingIntents.value = false;
    }
  }

  /**
   * 重置所有状态
   */
  function reset(): void {
    session.value = null;
    evaluation.value = null;
    transcript.value = '';
    loading.value = false;
    error.value = null;
    intentDefinitions.value = [];
    loadingIntents.value = false;
  }

  /**
   * 重置评估相关状态（保留会话）
   */
  function resetEvaluation(): void {
    evaluation.value = null;
  }

  /**
   * 设置错误信息
   */
  function setError(message: string): void {
    error.value = message;
  }

  /**
   * 清除错误信息
   */
  function clearError(): void {
    error.value = null;
  }

  // ============================================
  // 返回
  // ============================================

  return {
    // State
    session,
    evaluation,
    transcript,
    loading,
    error,
    scenarios,
    history,
    intentDefinitions,
    loadingIntents,

    // Getters
    sessionId,
    isRunning,
    isCompleted,
    isPassed,
    totalScore,
    hasCriticalErrors,
    scoreLevel,
    hasActiveSession,
    transcriptLength,
    transcriptWordCount,

    // Actions
    createSession,
    endSession,
    fetchSessionStatus,
    receiveTranscript,
    appendTranscript,
    setTranscript,
    clearTranscript,
    triggerEvaluation,
    fetchEvaluation,
    fetchAgentTrace,
    loadScenarios,
    loadHistory,
    loadIntentDefinitions,
    reset,
    resetEvaluation,
    setError,
    clearError,
  };
});

// ==================== 导出 ====================

export default useEmsStore;
