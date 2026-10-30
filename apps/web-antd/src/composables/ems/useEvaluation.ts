/**
 * 评估逻辑组合式函数
 *
 * 职责：
 * 1. 封装评估的完整流程（触发、轮询、获取结果）
 * 2. 管理评估状态（加载中、已完成、错误等）
 * 3. 支持多智能体诊断轨迹查看（教官专用）
 * 4. 支持评估结果缓存
 * 5. 支持 SSE 流式接收评估进度（如后端支持）
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useEvaluation } from '@/composables/ems/useEvaluation';
 *
 * const {
 *   evaluation,
 *   isLoading,
 *   progress,
 *   triggerEvaluation,
 *   getResult,
 *   getAgentTrace,
 *   reset,
 *   isCompleted,
 * } = useEvaluation();
 *
 * // 触发评估
 * await triggerEvaluation(sessionId);
 *
 * // 监听进度
 * watch(progress, (val) => {
 *   console.log('评估进度:', val);
 * });
 * </script>
 * ```
 */

import type { ComputedRef, Ref } from 'vue';

import type { AgentOutput, EvaluationResult } from '../../api/ems/types';

import { computed, onUnmounted, readonly, ref } from 'vue';

import { evaluationApi } from '../../api/ems';

// ==================== 类型定义 ====================

/** 评估进度阶段 */
export type EvaluationStage =
  | 'assessing' // 评估智能体分析中
  | 'completed' // 完成
  | 'deciding' // 决策智能体分析中
  | 'failed' // 失败
  | 'feedback' // 反馈智能体生成中
  | 'fusing' // 结果融合中
  | 'idle' // 空闲
  | 'safety' // 安全智能体分析中
  | 'triggering'; // 触发中

/** 评估进度信息 */
export interface EvaluationProgress {
  stage: EvaluationStage;
  message: string;
  percentage: number;
  details?: Record<string, any>;
}

/** useEvaluation 返回值 */
export interface UseEvaluationReturn {
  // ===== 状态 =====
  /** 评估结果（只读） */
  evaluation: Readonly<Ref<EvaluationResult | null>>;
  /** 是否正在加载（只读） */
  isLoading: Readonly<Ref<boolean>>;
  /** 是否已完成（只读） */
  isCompleted: ComputedRef<boolean>;
  /** 是否失败（只读） */
  isFailed: ComputedRef<boolean>;
  /** 评估进度（只读） */
  progress: Readonly<Ref<EvaluationProgress>>;
  /** 错误信息（只读） */
  error: Readonly<Ref<null | string>>;
  /** 智能体诊断轨迹（只读） */
  agentTrace: Readonly<Ref<null | Record<string, AgentOutput>>>;

  // ===== 操作方法 =====
  /** 触发评估（自动轮询结果） */
  triggerEvaluation: (sessionId: string) => Promise<EvaluationResult>;
  /** 获取评估结果（直接查询） */
  getResult: (sessionId: string) => Promise<EvaluationResult | null>;
  /** 获取智能体诊断轨迹（教官专用） */
  getAgentTrace: (
    sessionId: string,
  ) => Promise<null | Record<string, AgentOutput>>;
  /** 重置状态 */
  reset: () => void;
  /** 取消正在进行的评估 */
  cancel: () => void;

  // ===== 工具方法 =====
  /** 格式化评分显示 */
  formatScore: (score: number) => string;
  /** 获取评分等级 */
  getScoreLevel: (
    score: number,
  ) => 'average' | 'excellent' | 'fail' | 'good' | 'poor';
  /** 获取状态标签类型 */
  getStatusTagType: (isPass: boolean) => 'danger' | 'success' | 'warning';
}

// ==================== 组合式函数 ====================

export function useEvaluation(): UseEvaluationReturn {
  // ===== 状态 =====
  const evaluation = ref<EvaluationResult | null>(null);
  const isLoading = ref(false);
  const error = ref<null | string>(null);
  const agentTrace = ref<null | Record<string, AgentOutput>>(null);

  // ===== 进度状态 =====
  const progress = ref<EvaluationProgress>({
    stage: 'idle',
    message: '等待评估',
    percentage: 0,
  });

  // ===== 内部状态 =====
  let pollTimer: null | ReturnType<typeof setInterval> = null;
  let isCanceled = false;
  let isUnmounted = false;

  // ===== 计算属性 =====
  const isCompleted = computed(() => {
    return evaluation.value !== null && evaluation.value.isPass !== undefined;
  });

  const isFailed = computed(() => {
    return progress.value.stage === 'failed' || error.value !== null;
  });

  // ===== 私有方法 =====

  /**
   * 更新进度
   */
  const updateProgress = (
    stage: EvaluationStage,
    message: string,
    percentage: number,
    details?: Record<string, any>,
  ) => {
    if (isUnmounted || isCanceled) return;
    progress.value = { stage, message, percentage, details };
  };

  /**
   * 轮询获取评估结果
   */
  const pollEvaluationResult = (
    sessionId: string,
  ): Promise<EvaluationResult> => {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 30; // 最多轮询 30 次
      const interval = 2000; // 每 2 秒轮询一次

      updateProgress('assessing', '等待评估完成...', 30);

      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }

      pollTimer = setInterval(async () => {
        attempts++;

        // 检查是否取消
        if (isCanceled || isUnmounted) {
          clearInterval(pollTimer!);
          pollTimer = null;
          reject(new Error('评估已取消'));
          return;
        }

        try {
          const result = await evaluationApi.getResult(sessionId);

          if (result && result.data) {
            const data = result.data;
            // 检查是否已完成（有总分和通过状态）
            if (data.totalScore !== undefined && data.isPass !== undefined) {
              clearInterval(pollTimer!);
              pollTimer = null;
              evaluation.value = data;
              updateProgress('completed', '评估完成！', 100, {
                score: data.totalScore,
              });
              resolve(data);
              return;
            }
          }

          // 更新进度
          const pct = Math.min(30 + (attempts / maxAttempts) * 60, 90);
          updateProgress(
            'assessing',
            `分析中... (${attempts}/${maxAttempts})`,
            pct,
          );

          // 超时处理
          if (attempts >= maxAttempts) {
            clearInterval(pollTimer!);
            pollTimer = null;
            updateProgress('failed', '评估超时，请稍后重试', 100);
            reject(new Error('评估超时'));
          }
        } catch (error_) {
          // 如果是 404（评估未完成），继续轮询
          if ((error_ as any)?.response?.status === 404) {
            // 正常情况，继续轮询
            return;
          }
          // 其他错误
          clearInterval(pollTimer!);
          pollTimer = null;
          const msg =
            error_ instanceof Error ? error_.message : '获取评估结果失败';
          error.value = msg;
          updateProgress('failed', msg, 100);
          reject(error_);
        }
      }, interval);
    });
  };

  // ===== 公共方法 =====

  /**
   * 触发评估
   * 1. 调用后端触发评估接口
   * 2. 轮询获取评估结果
   */
  const triggerEvaluation = async (
    sessionId: string,
  ): Promise<EvaluationResult> => {
    if (!sessionId) {
      throw new Error('sessionId 不能为空');
    }

    // 重置状态
    reset();

    isLoading.value = true;
    error.value = null;
    isCanceled = false;

    try {
      // 1. 触发评估
      updateProgress('triggering', '正在触发评估...', 10);
      await evaluationApi.trigger(sessionId);
      updateProgress('assessing', '评估已触发，等待结果...', 20);

      // 2. 轮询获取结果
      const result = await pollEvaluationResult(sessionId);
      evaluation.value = result;

      // 3. 获取智能体轨迹（如果有）
      try {
        const trace = await evaluationApi.getAgentTrace(sessionId);
        if (trace && trace.data) {
          agentTrace.value = trace.data;
        }
      } catch (error_) {
        // 智能体轨迹获取失败不影响主流程
        console.warn('[useEvaluation] 获取智能体轨迹失败:', error_);
      }

      isLoading.value = false;
      return result;
    } catch (error_) {
      isLoading.value = false;
      const msg = error_ instanceof Error ? error_.message : '评估失败';
      error.value = msg;
      updateProgress('failed', msg, 100);
      throw error_;
    }
  };

  /**
   * 直接获取评估结果（不触发新评估）
   */
  const getResult = async (
    sessionId: string,
  ): Promise<EvaluationResult | null> => {
    if (!sessionId) return null;

    try {
      const result = await evaluationApi.getResult(sessionId);
      if (result && result.data) {
        evaluation.value = result.data;
        return result.data;
      }
      return null;
    } catch (error_) {
      const msg = error_ instanceof Error ? error_.message : '获取评估结果失败';
      error.value = msg;
      return null;
    }
  };

  /**
   * 获取智能体诊断轨迹（教官专用）
   */
  const getAgentTrace = async (
    sessionId: string,
  ): Promise<null | Record<string, AgentOutput>> => {
    if (!sessionId) return null;

    try {
      const result = await evaluationApi.getAgentTrace(sessionId);
      if (result && result.data) {
        agentTrace.value = result.data;
        return result.data;
      }
      return null;
    } catch (error_) {
      const msg =
        error_ instanceof Error ? error_.message : '获取智能体轨迹失败';
      console.warn('[useEvaluation]', msg);
      return null;
    }
  };

  /**
   * 重置状态
   */
  const reset = (): void => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    isCanceled = false;
    isLoading.value = false;
    error.value = null;
    evaluation.value = null;
    agentTrace.value = null;
    progress.value = {
      stage: 'idle',
      message: '等待评估',
      percentage: 0,
    };
  };

  /**
   * 取消评估
   */
  const cancel = (): void => {
    isCanceled = true;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    isLoading.value = false;
    progress.value = {
      stage: 'idle',
      message: '已取消',
      percentage: 0,
    };
  };

  // ===== 工具方法 =====

  /**
   * 格式化评分显示
   */
  const formatScore = (score: number): string => {
    return `${Math.round(score)}分`;
  };

  /**
   * 获取评分等级
   */
  const getScoreLevel = (
    score: number,
  ): 'average' | 'excellent' | 'fail' | 'good' | 'poor' => {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'average';
    if (score >= 60) return 'poor';
    return 'fail';
  };

  /**
   * 获取状态标签类型
   */
  const getStatusTagType = (
    isPass: boolean,
  ): 'danger' | 'success' | 'warning' => {
    return isPass ? 'success' : 'danger';
  };

  // ===== 生命周期 =====

  onUnmounted(() => {
    isUnmounted = true;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });

  // ===== 返回 =====

  return {
    // 状态
    evaluation: readonly(evaluation),
    isLoading: readonly(isLoading),
    isCompleted,
    isFailed,
    progress: readonly(progress),
    error: readonly(error),
    agentTrace: readonly(agentTrace),

    // 操作方法
    triggerEvaluation,
    getResult,
    getAgentTrace,
    reset,
    cancel,

    // 工具方法
    formatScore,
    getScoreLevel,
    getStatusTagType,
  };
}

// ==================== 导出默认 ====================
export default useEvaluation;
