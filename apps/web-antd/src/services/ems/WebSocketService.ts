/**
 * WebSocket 服务（单例模式）
 *
 * 职责：
 * 1. 管理与后端的 WebSocket 连接（实时音频流双向通讯）
 * 2. 发送音频数据（二进制）到服务端
 * 3. 接收服务端推送的转写结果、提示、状态变更等消息
 * 4. 支持断线自动重连（指数退避）
 * 5. 支持心跳保活
 *
 * @example
 * ```ts
 * import { wsService } from '@/services/ems/WebSocketService';
 *
 * // 连接
 * await wsService.connect(sessionId);
 *
 * // 发送音频
 * wsService.sendAudio(pcmData);
 *
 * // 发送自定义文本消息
 * wsService.sendMessage({ type: 'manual_transcript', text: '患者心率80' });
 *
 * // 注册消息监听
 * const unregister = wsService.onMessage((msg) => {
 *   if (msg.type === 'transcript') {
 *     console.log(msg.text);
 *   }
 * });
 *
 * // 断开
 * wsService.disconnect();
 * ```
 */

import type { WsMessage } from '@/api/ems/types';

// ==================== 类型定义 ====================

/** 消息处理器类型 */
type MessageHandler = (message: WsMessage) => void;

/** 连接状态枚举 */
export enum ConnectionState {
  CONNECTED = 'connected',
  CONNECTING = 'connecting',
  DISCONNECTED = 'disconnected',
  IDLE = 'idle',
  RECONNECTING = 'reconnecting',
}

/** WebSocket 配置选项 */
export interface WebSocketOptions {
  /** 重连最大尝试次数，默认 5 */
  maxReconnectAttempts?: number;
  /** 基础重连延迟（ms），默认 3000 */
  reconnectDelay?: number;
  /** 心跳间隔（ms），默认 30000 */
  heartbeatInterval?: number;
  /** 是否自动重连，默认 true */
  autoReconnect?: boolean;
}

// ==================== 服务类 ====================

export class WebSocketService {
  // 单例实例
  private static instance: null | WebSocketService = null;
  private autoReconnect: boolean;
  private handlers: Set<MessageHandler> = new Set();
  // 心跳相关
  private heartbeatInterval: number;

  private heartbeatTimer: null | ReturnType<typeof setInterval> = null;
  private maxReconnectAttempts: number;
  // 重连相关
  private reconnectAttempts = 0;
  private reconnectDelay: number;
  private reconnectTimer: null | ReturnType<typeof setTimeout> = null;

  private sessionId: null | string = null;
  private state: ConnectionState = ConnectionState.IDLE;

  // ===== 私有属性 =====
  private ws: null | WebSocket = null;

  // ===== 构造函数（私有，实现单例） =====
  private constructor(options: WebSocketOptions = {}) {
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.reconnectDelay = options.reconnectDelay ?? 3000;
    this.autoReconnect = options.autoReconnect ?? true;
    this.heartbeatInterval = options.heartbeatInterval ?? 30_000;
  }

  /**
   * 获取单例实例
   */
  public static getInstance(options?: WebSocketOptions): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService(options);
    }
    return WebSocketService.instance;
  }

  // ===== 公共方法 =====

  /**
   * 建立 WebSocket 连接
   * @param sessionId 会话ID（由后端创建会话时返回）
   * @returns Promise，连接成功时 resolve
   */
  connect(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 如果已连接且是同一个 sessionId，直接返回
      if (
        this.ws?.readyState === WebSocket.OPEN &&
        this.sessionId === sessionId
      ) {
        resolve();
        return;
      }

      // 如果存在旧连接，先关闭
      if (this.ws) {
        this.disconnect();
      }

      this.sessionId = sessionId;
      this.state = ConnectionState.CONNECTING;

      // 构建 WebSocket URL（自动适配协议）
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws/asr/${sessionId}?role=speaker`;

      try {
        this.ws = new WebSocket(url);

        this.ws.addEventListener('open', () => {
          console.log('[WebSocket] 连接成功, sessionId:', sessionId);
          this.state = ConnectionState.CONNECTED;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        });

        this.ws.onmessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data) as WsMessage;
            // 分发消息给所有注册的处理器
            this.handlers.forEach((handler) => {
              try {
                handler(data);
              } catch (error) {
                console.error('[WebSocket] 处理器执行失败:', error);
              }
            });
          } catch (error) {
            console.error('[WebSocket] 消息解析失败:', error);
          }
        };

        this.ws.addEventListener('close', (event: CloseEvent) => {
          console.log(
            '[WebSocket] 连接关闭, code:',
            event.code,
            'reason:',
            event.reason,
          );
          this.state = ConnectionState.DISCONNECTED;
          this.stopHeartbeat();

          // 非正常关闭（code !== 1000）且开启自动重连时尝试重连
          if (event.code !== 1000 && this.autoReconnect) {
            this.scheduleReconnect();
          }
        });

        this.ws.onerror = (error: Event) => {
          console.error('[WebSocket] 连接错误:', error);
          this.state = ConnectionState.DISCONNECTED;
          reject(error);
        };
      } catch (error) {
        this.state = ConnectionState.DISCONNECTED;
        reject(error);
      }
    });
  }

  /**
   * 断开连接（主动关闭，不会触发重连）
   */
  disconnect(): void {
    this.autoReconnect = false; // 主动断开不重连
    this.stopHeartbeat();
    this.clearReconnectTimer();
    if (this.ws) {
      // 使用 1000 正常关闭码
      this.ws.close(1000, '主动断开');
      this.ws = null;
    }
    this.state = ConnectionState.DISCONNECTED;
    this.handlers.clear();
    console.log('[WebSocket] 已主动断开连接');
  }

  /**
   * 获取当前连接状态
   */
  getConnectionState(): ConnectionState {
    return this.state;
  }

  /**
   * 获取当前会话ID
   */
  getSessionId(): null | string {
    return this.sessionId;
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 注册消息处理器
   * @param handler 处理函数
   * @returns 取消注册函数
   */
  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * 请求教学提示
   * @param state 当前状态
   */
  requestHint(state: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'hint', state }));
    }
  }

  /**
   * 重置连接（断开并清除状态，用于切换场景）
   */
  reset(): void {
    this.disconnect();
    this.sessionId = null;
    this.reconnectAttempts = 0;
    this.autoReconnect = true;
  }

  /**
   * 发送二进制音频数据
   * @param data ArrayBuffer 或 Blob 格式的 PCM 数据
   * @returns 是否发送成功
   */
  sendAudio(data: ArrayBuffer | Blob): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }
    console.warn('[WebSocket] 连接未就绪，丢弃音频数据, state:', this.state);
    return false;
  }

  /**
   * 发送控制指令
   * @param action 控制动作: pause | resume | reset
   */
  sendControl(action: 'pause' | 'reset' | 'resume'): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'control', action }));
      console.log('[WebSocket] 发送控制指令:', action);
    } else {
      console.warn('[WebSocket] 连接未就绪，无法发送控制指令');
    }
  }

  /**
   * 发送任意文本或对象消息（JSON 格式）
   * @param data 字符串或可序列化的对象
   * @throws 如果连接未就绪则抛出错误
   */
  sendMessage(data: Record<string, any> | string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(payload);
    } else {
      throw new Error('WebSocket 未连接');
    }
  }

  // ===== 私有方法 =====

  /**
   * 清除重连定时器
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 安排重连（指数退避）
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WebSocket] 已达到最大重连次数，停止重连');
      this.state = ConnectionState.DISCONNECTED;
      return;
    }

    // 指数退避：延迟时间 = baseDelay * 1.5^attempts
    const delay = this.reconnectDelay * 1.5 ** this.reconnectAttempts;
    this.reconnectAttempts++;
    this.state = ConnectionState.RECONNECTING;

    console.log(
      `[WebSocket] ${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连`,
    );

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      if (this.sessionId) {
        this.connect(this.sessionId).catch((error) => {
          console.error('[WebSocket] 重连失败:', error);
          // 失败后会自动触发 onclose，继续重连循环
        });
      }
    }, delay);
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
        console.debug('[WebSocket] 心跳发送');
      } else {
        // 如果连接已断开，停止心跳
        this.stopHeartbeat();
      }
    }, this.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// ==================== 导出单例实例 ====================

/**
 * WebSocket 服务单例
 *
 * @example
 * ```ts
 * import { wsService } from '@/services/ems/WebSocketService';
 *
 * // 连接
 * await wsService.connect(sessionId);
 *
 * // 监听消息
 * wsService.onMessage((msg) => {
 *   console.log('收到消息:', msg);
 * });
 *
 * // 发送音频
 * wsService.sendAudio(pcmBuffer);
 * ```
 */
export const wsService = WebSocketService.getInstance();

// 方便全局调试（开发环境）
if (import.meta.env.DEV) {
  (window as any).__wsService = wsService;
}
