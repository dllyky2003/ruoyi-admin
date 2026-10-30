/**
 * WebSocket 连接管理组合式函数
 *
 * 职责：
 * 1. 封装 WebSocket 连接的生命周期管理
 * 2. 提供响应式的连接状态
 * 3. 提供消息订阅/取消订阅能力
 * 4. 自动处理组件卸载时的资源清理
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useWebSocket } from '@/composables/ems/useWebSocket';
 *
 * const {
 *   isConnected,
 *   connectionState,
 *   connect,
 *   disconnect,
 *   sendControl,
 *   onMessage,
 * } = useWebSocket();
 *
 * // 连接
 * await connect(sessionId);
 *
 * // 监听转写消息
 * onMessage('transcript', (msg) => {
 *   console.log(msg.text);
 * });
 * </script>
 * ```
 */

import type { Ref } from 'vue';

import type { WsMessage } from '../../api/ems/types';

import { onUnmounted, readonly, ref } from 'vue';

import {
  ConnectionState,
  wsService,
} from '../../services/ems/WebSocketService';

// ==================== 类型定义 ====================

/** 消息类型过滤器 */
export type WsMessageType = WsMessage['type'];

/** 消息处理器函数类型 */
export type MessageHandler<T extends WsMessage = WsMessage> = (
  message: T,
) => void;

/** useWebSocket 返回值 */
export interface UseWebSocketReturn {
  /** 是否已连接（只读） */
  isConnected: Readonly<Ref<boolean>>;
  /** 连接状态（只读） */
  connectionState: Readonly<Ref<ConnectionState>>;
  /** 当前会话ID（只读） */
  sessionId: Readonly<Ref<null | string>>;
  /** 最后收到的消息（只读） */
  lastMessage: Readonly<Ref<null | WsMessage>>;
  /** 错误信息（只读） */
  error: Readonly<Ref<null | string>>;

  /** 建立连接 */
  connect: (sessionId: string) => Promise<void>;
  /** 断开连接 */
  disconnect: () => void;
  /** 重置连接 */
  reset: () => void;

  /** 发送控制指令 */
  sendControl: (action: 'pause' | 'reset' | 'resume') => void;
  /** 请求教学提示 */
  requestHint: (state: string) => void;

  /** 注册消息处理器（支持按类型过滤） */
  onMessage: <T extends WsMessage = WsMessage>(
    handler: MessageHandler<T>,
    type?: WsMessageType,
  ) => () => void;

  /** 注册一次性消息处理器 */
  once: <T extends WsMessage = WsMessage>(
    handler: MessageHandler<T>,
    type?: WsMessageType,
  ) => void;

  /** 获取连接状态 */
  getState: () => ConnectionState;
}

// ==================== 组合式函数 ====================

export function useWebSocket(): UseWebSocketReturn {
  // ===== 响应式状态 =====
  const isConnected = ref(false);
  const connectionState = ref<ConnectionState>(ConnectionState.IDLE);
  const sessionId = ref<null | string>(null);
  const lastMessage = ref<null | WsMessage>(null);
  const error = ref<null | string>(null);

  // ===== 内部状态 =====
  let unregisterAll: (() => void) | null = null;
  let isMounted = true;

  // ===== 更新状态 =====
  const updateState = () => {
    if (!isMounted) return;
    const state = wsService.getConnectionState();
    connectionState.value = state;
    isConnected.value = state === ConnectionState.CONNECTED;
    sessionId.value = wsService.getSessionId();
  };

  // ===== 公共方法 =====

  /**
   * 建立 WebSocket 连接
   */
  const connect = async (id: string): Promise<void> => {
    error.value = null;
    try {
      await wsService.connect(id);
      updateState();
    } catch (error_) {
      const msg = error_ instanceof Error ? error_.message : '连接失败';
      error.value = msg;
      updateState();
      throw error_;
    }
  };

  /**
   * 断开连接
   */
  const disconnect = (): void => {
    wsService.disconnect();
    updateState();
    if (unregisterAll) {
      unregisterAll();
      unregisterAll = null;
    }
  };

  /**
   * 重置连接
   */
  const reset = (): void => {
    wsService.reset();
    updateState();
    if (unregisterAll) {
      unregisterAll();
      unregisterAll = null;
    }
    lastMessage.value = null;
    error.value = null;
  };

  /**
   * 发送控制指令
   */
  const sendControl = (action: 'pause' | 'reset' | 'resume'): void => {
    wsService.sendControl(action);
  };

  /**
   * 请求教学提示
   */
  const requestHint = (state: string): void => {
    wsService.requestHint(state);
  };

  /**
   * 注册消息处理器（支持按类型过滤）
   *
   * @param handler 消息处理函数
   * @param type 可选，指定消息类型，只有匹配的消息才会触发
   * @returns 取消注册函数
   *
   * @example
   * ```ts
   * // 监听所有消息
   * const unsub1 = onMessage((msg) => console.log(msg));
   *
   * // 只监听转写消息
   * const unsub2 = onMessage((msg) => console.log(msg.text), 'transcript');
   * ```
   */
  const onMessage = <T extends WsMessage = WsMessage>(
    handler: MessageHandler<T>,
    type?: WsMessageType,
  ): (() => void) => {
    const wrappedHandler = (msg: WsMessage) => {
      if (type && msg.type !== type) {
        return; // 类型不匹配，跳过
      }
      lastMessage.value = msg;
      handler(msg as T);
    };

    const unregister = wsService.onMessage(wrappedHandler);
    // 记录所有注册的处理器，便于统一清理
    const prevUnregisterAll = unregisterAll;
    unregisterAll = () => {
      unregister();
      if (prevUnregisterAll) {
        prevUnregisterAll();
      }
    };
    return unregister;
  };

  /**
   * 注册一次性消息处理器（触发一次后自动取消）
   *
   * @param handler 消息处理函数
   * @param type 可选，指定消息类型
   *
   * @example
   * ```ts
   * once((msg) => {
   *   console.log('只执行一次:', msg);
   * }, 'connected');
   * ```
   */
  const once = <T extends WsMessage = WsMessage>(
    handler: MessageHandler<T>,
    type?: WsMessageType,
  ): void => {
    let unregister: (() => void) | null = null;
    const wrappedHandler = (msg: WsMessage) => {
      if (type && msg.type !== type) {
        return;
      }
      if (unregister) {
        unregister();
        unregister = null;
      }
      lastMessage.value = msg;
      handler(msg as T);
    };
    unregister = wsService.onMessage(wrappedHandler);
  };

  /**
   * 获取连接状态
   */
  const getState = (): ConnectionState => {
    return wsService.getConnectionState();
  };

  // ===== 状态同步（轮询更新） =====
  // 使用定时器保持状态同步（作为 onopen/onclose 事件的补充）
  let syncTimer: null | ReturnType<typeof setInterval> = null;

  const startSyncTimer = () => {
    if (syncTimer) return;
    syncTimer = setInterval(() => {
      if (isMounted) {
        updateState();
      }
    }, 2000);
  };

  const stopSyncTimer = () => {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
  };

  // ===== 生命周期 =====
  onUnmounted(() => {
    isMounted = false;
    stopSyncTimer();
    if (unregisterAll) {
      unregisterAll();
      unregisterAll = null;
    }
    // 不自动断开连接，让页面切换时连接保持
  });

  // 启动状态同步
  startSyncTimer();

  // ===== 返回 =====
  return {
    // 状态
    isConnected: readonly(isConnected),
    connectionState: readonly(connectionState),
    sessionId: readonly(sessionId),
    lastMessage: readonly(lastMessage),
    error: readonly(error),

    // 方法
    connect,
    disconnect,
    reset,
    sendControl,
    requestHint,
    onMessage,
    once,
    getState,
  };
}

// ==================== 导出默认 ====================
export default useWebSocket;
