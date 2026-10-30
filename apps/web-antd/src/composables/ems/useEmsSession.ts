/**
 * EMS 会话管理组合式函数
 *
 * 职责：
 * 1. 封装考核会话的完整生命周期（创建、运行、结束）
 * 2. 管理会话状态（进行中、已完成等）
 * 3. 与 Pinia Store 交互，实现状态持久化
 * 4. 整合 WebSocket 和音频采集能力
 * 5. 提供会话恢复能力（页面刷新后恢复）
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useEmsSession } from '@/composables/ems/useEmsSession';
 *
 * const {
 *   session,
 *   evaluation,
 *   isRunning,
 *   isCompleted,
 *   loading,
 *   createSession,
 *   startRecording,
 *   stopRecording,
 *   submitEvaluation,
 *   reset
 * } = useEmsSession();
 *
 * // 创建会话
 * await createSession('SCE-2025-001', '张三');
 *
 * // 开始录音
 * await startRecording();
 *
 * // 提交评估
 * await submitEvaluation();
 * </script>
 * ```
 */

import type { ComputedRef, Readonly, Ref } from 'vue';

import type { EvaluationResult, Session } from '../../api/ems/types';

import { computed, onUnmounted, readonly, ref } from 'vue';

import { sessionApi } from '../../api/ems';
import { useWebSocket } from '../../composables/ems/useWebSocket';
import { useEmsStore } from '../../store/modules/ems';
import { useAudioCapture } from './useAudioCapture';

// ==================== 类型定义 ====================

/** 会话模式 */
export type SessionMode = 'EXAM' | 'TEACH';

/** 创建会话参数 */
export interface CreateSessionParams {
  /** 场景ID */
  scenarioId: string;
  /** 学员姓名 */
  traineeName?: string;
  /** 模式：考核/教学 */
  mode?: SessionMode;
}

/** useEmsSession 返回值 */
export interface UseEmsSessionReturn {
  // ===== 状态 =====
  /** 当前会话（只读） */
  session: Readonly<Ref<null | Session>>;
  /** 评估结果（只读） */
  evaluation: Readonly<Ref<EvaluationResult | null>>;
  /** 是否正在运行（只读） */
  isRunning: ComputedRef<boolean>;
  /** 是否已完成（只读） */
  isCompleted: ComputedRef<boolean>;
  /** 是否正在加载（只读） */
  loading: Readonly<Ref<boolean>>;
  /** 会话ID（只读） */
  sessionId: ComputedRef<string | undefined>;

  // ===== 音频状态 =====
  /** 是否正在录音（只读） */
  isRecording: Readonly<Ref<boolean>>;
  /** 是否暂停（只读） */
  isPaused: Readonly<Ref<boolean>>;
  /** 当前音量（只读） */
  volume: Readonly<Ref<number>>;

  // ===== WebSocket 状态 =====
  /** WebSocket 是否已连接（只读） */
  wsConnected: Readonly<Ref<boolean>>;

  // ===== 手动转写状态 =====
  /** 是否正在发送转写文本（只读） */
  sendingTranscript: Readonly<Ref<boolean>>;

  // ===== 操作方法 =====
  /** 创建会话 */
  createSession: (params: CreateSessionParams) => Promise<Session>;
  /** 开始录音（自动连接 WebSocket） */
  startRecording: () => Promise<void>;
  /** 停止录音 */
  stopRecording: () => void;
  /** 暂停/恢复切换 */
  togglePause: () => void;
  /** 提交评估 */
  submitEvaluation: () => Promise<EvaluationResult>;
  /** 刷新评估结果 */
  refreshEvaluation: () => Promise<EvaluationResult | null>;
  /** 结束会话 */
  endSession: () => Promise<void>;
  /** 重置所有状态 */
  reset: () => void;
  /** 发送手动输入的转写文本 */
  sendTranscript: (sessionId: string, text: string) => Promise<void>;

  // ===== 消息监听 =====
  /** 注册 WebSocket 消息处理器 */
  onWsMessage: <T>(handler: (message: T) => void, type?: string) => () => void;

  /** 获取转写文本 */
  getTranscript: () => string;
}

// ==================== 组合式函数 ====================

export function useEmsSession(): UseEmsSessionReturn {
  // ===== Store =====
  const store = useEmsStore();

  // ===== WebSocket =====
  const {
    isConnected: wsConnected,
    connect: wsConnect,
    disconnect: wsDisconnect,
    sendControl: wsSendControl,
    onMessage: wsOnMessage,
    requestHint: wsRequestHint,
  } = useWebSocket();

  // ===== 音频采集 =====
  const {
    isRecording,
    isPaused,
    volume,
    start: startAudioCapture,
    stop: stopAudioCapture,
    togglePause: toggleAudioPause,
    reset: resetAudio,
  } = useAudioCapture({
    targetSampleRate: 16_000,
    chunkDuration: 0.5,
  });

  // ===== 本地状态 =====
  const loading = ref(false);
  // ★ 新增：手动转写发送状态 ★
  const sendingTranscript = ref(false);
  let isUnmounted = false;

  // ===== 计算属性 =====
  const isRunning = computed(() => store.session?.status === 'RUNNING');
  const isCompleted = computed(() => store.session?.status === 'COMPLETED');
  const sessionId = computed(() => store.session?.id);

  // ===== 私有方法 =====

  /**
   * 检查会话是否有效
   */
  const checkSession = (): boolean => {
    if (!store.session) {
      console.warn('请先创建考核会话');
      return false;
    }
    return true;
  };

  /**
   * 检查会话是否正在运行
   */
  const checkRunning = (): boolean => {
    if (!checkSession()) return false;
    if (store.session?.status !== 'RUNNING') {
      console.warn('会话未处于运行状态');
      return false;
    }
    return true;
  };

  // ===== 公共方法 =====

  /**
   * 创建会话
   */
  const createSession = async (
    params: CreateSessionParams,
  ): Promise<Session> => {
    loading.value = true;
    try {
      const { scenarioId, traineeName = '学员', mode = 'EXAM' } = params;

      // 如果已有会话且正在运行，先结束
      if (store.session && store.session.status === 'RUNNING') {
        await endSession();
      }

      // 调用 API 创建会话
      const session = await store.createSession(scenarioId, traineeName, mode);
      console.log('[useEmsSession] 会话创建成功:', session);

      return session;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '创建会话失败';

      console.error('[useEmsSession] createSession error:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 发送手动输入的转写文本（模拟语音识别结果）
   */
  async function sendTranscript(
    sessionId: string,
    text: string,
  ): Promise<Response> {
    // 假设后端有对应的 HTTP 接口（如 POST /api/ems/session/:sessionId/transcript）
    // 如果接口返回的是 Response，则直接返回
    // 若接口返回的是 JSON 数据，可改为返回 Promise<void>
    const response = await fetch(`/api/ems/session/${sessionId}/transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    // 可选：将返回的转写追加到 store 中
    // 如果后端返回转写内容，可调用 appendTranscript
    return response;
  }

  /**
   * 开始录音
   * 自动建立 WebSocket 连接并开始采集音频
   */
  const startRecording = async (): Promise<void> => {
    const sid = sessionId.value;
    if (!sid) {
      console.warn('[useEmsSession] 会话ID不存在');
      return;
    }

    try {
      loading.value = true;
      console.warn('[sessionId.value;]', store.session?.status);
      // 如果状态不是 RUNNING，先调用开始接口
      if (store.session?.status != 'RUNNING') {
        await sessionApi.start(sid);
        // 更新 store 中的状态（若 store 中有更新方法）
        // 若 store 未提供，可直接修改 store.session.status
        if (store.session) {
          store.session.status = 'RUNNING';
        }
        console.log('[useEmsSession] 会话已开始');
      }

      // 连接 WebSocket
      if (!wsConnected.value) {
        await wsConnect(sid);
      }

      // 启动音频采集（取消注释）
      await startAudioCapture(sid);
    } catch {
      // ... 错误处理
    } finally {
      loading.value = false;
    }
  };

  /**
   * 停止录音
   */
  const stopRecording = (): void => {
    if (!checkRunning()) return;

    stopAudioCapture();
    // 不断开 WebSocket，保持连接用于后续操作
    console.info('⏹ 录音已停止');
  };

  /**
   * 暂停/恢复切换
   */
  const togglePause = (): void => {
    if (!checkRunning()) return;

    toggleAudioPause();
    wsSendControl(isPaused.value ? 'pause' : 'resume');
    console.info(isPaused.value ? '⏸ 已暂停' : '▶ 已恢复');
  };

  /**
   * 提交评估
   */
  const submitEvaluation = async (): Promise<EvaluationResult> => {
    if (!checkRunning()) throw new Error('会话未运行');

    const sid = sessionId.value;
    if (!sid) {
      console.warn('会话ID不存在');
      throw new Error('会话ID不存在');
    }

    try {
      loading.value = true;

      // 停止录音（如果正在录音）
      if (isRecording.value) {
        stopRecording();
      }

      // 结束会话
      await sessionApi.end(sid);
      await store.endSession();

      // 触发评估
      const result = await store.triggerEvaluation();

      console.log(`📊 评估完成，得分：${result.totalScore} 分`);
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '提交评估失败';
      console.error(`❌ ${msg}`);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 刷新评估结果
   */
  const refreshEvaluation = async (): Promise<EvaluationResult | null> => {
    if (!sessionId.value) return null;

    try {
      return await store.fetchEvaluation();
    } catch (error) {
      console.error('[useEmsSession] 刷新评估失败:', error);
      return null;
    }
  };

  /**
   * 结束会话
   */
  const endSession = async (): Promise<void> => {
    if (!store.session) return;

    try {
      loading.value = true;

      // 停止录音
      if (isRecording.value) {
        stopRecording();
      }

      // 断开 WebSocket
      wsDisconnect();

      // 调用 API 结束会话
      await store.endSession();

      console.info('会话已结束');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '结束会话失败';
      console.error(`❌ ${msg}`);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 重置所有状态
   */
  const reset = (): void => {
    stopRecording();
    wsDisconnect();
    resetAudio();
    store.reset();
    console.info('已重置所有状态');
  };

  /**
   * 获取转写文本
   */
  const getTranscript = (): string => {
    return store.transcript || '';
  };

  // ===== 消息监听 =====

  /**
   * 注册 WebSocket 消息处理器
   */
  const onWsMessage = <T>(
    handler: (message: T) => void,
    type?: string,
  ): (() => void) => {
    return wsOnMessage(handler as any, type as any);
  };

  // ===== 生命周期 =====

  onUnmounted(() => {
    isUnmounted = true;
    // 不自动断开，让用户主动结束
  });

  // ===== 返回 =====

  return {
    // 状态
    session: computed(() => store.session) as Readonly<Ref<null | Session>>,
    evaluation: computed(() => store.evaluation) as Readonly<
      Ref<EvaluationResult | null>
    >,
    isRunning,
    isCompleted,
    loading: readonly(loading),
    sessionId,

    // 音频状态
    isRecording: readonly(isRecording),
    isPaused: readonly(isPaused),
    volume: readonly(volume),

    // WebSocket 状态
    wsConnected: readonly(wsConnected),

    // ★ 手动转写状态 ★
    sendingTranscript: readonly(sendingTranscript),

    // 操作方法
    createSession,
    startRecording,
    stopRecording,
    togglePause,
    submitEvaluation,
    refreshEvaluation,
    endSession,
    reset,
    sendTranscript,
    onWsMessage,
    getTranscript,
  };
}

// ==================== 导出默认 ====================
export default useEmsSession;
