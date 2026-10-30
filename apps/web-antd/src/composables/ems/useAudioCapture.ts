/**
 * 麦克风音频采集组合式函数
 *
 * 职责：
 * 1. 获取用户麦克风权限
 * 2. 采集音频数据（Float32 PCM）
 * 3. 重采样到 16kHz
 * 4. 转换为 16-bit PCM
 * 5. 分块并通过 WebSocket 发送
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useAudioCapture } from '@/composables/ems/useAudioCapture';
 *
 * const { isRecording, isPaused, error, start, stop, togglePause } = useAudioCapture();
 *
 * const handleStart = async () => {
 *   await start(sessionId);
 * };
 * </script>
 * ```
 */

import type { Ref } from 'vue';

import { onUnmounted, readonly, ref } from 'vue';

import { AudioProcessor } from '../../services/ems/AudioProcessor';
import { wsService } from '../../services/ems/WebSocketService';

// ==================== 类型定义 ====================

/** 音频采集配置 */
export interface AudioCaptureOptions {
  /** 目标采样率（ASR 标准：16000） */
  targetSampleRate?: number;
  /** 每块音频时长（秒），默认 0.5 */
  chunkDuration?: number;
  /** 是否启用回声消除，默认 true */
  echoCancellation?: boolean;
  /** 是否启用降噪，默认 true */
  noiseSuppression?: boolean;
  /** 是否启用自动增益控制，默认 true */
  autoGainControl?: boolean;
}

/** useAudioCapture 返回值 */
export interface UseAudioCaptureReturn {
  /** 是否正在录音 */
  isRecording: Readonly<Ref<boolean>>;
  /** 是否暂停 */
  isPaused: Readonly<Ref<boolean>>;
  /** 是否已连接 WebSocket */
  isConnected: Readonly<Ref<boolean>>;
  /** 错误信息 */
  error: Readonly<Ref<null | string>>;
  /** 当前音量（RMS，用于波形显示） */
  volume: Readonly<Ref<number>>;
  /** 开始录音 */
  start: (sessionId: string) => Promise<void>;
  /** 停止录音 */
  stop: () => void;
  /** 暂停/恢复切换 */
  togglePause: () => void;
  /** 重置状态 */
  reset: () => void;
}

// ==================== 组合式函数 ====================

export function useAudioCapture(
  options: AudioCaptureOptions = {},
): UseAudioCaptureReturn {
  // ===== 配置 =====
  const {
    targetSampleRate = AudioProcessor.TARGET_SAMPLE_RATE,
    chunkDuration = 0.5,
    echoCancellation = true,
    noiseSuppression = true,
    autoGainControl = true,
  } = options;

  // ===== 状态 =====
  const isRecording = ref(false);
  const isPaused = ref(false);
  const isConnected = ref(false);
  const error = ref<null | string>(null);
  const volume = ref(0);

  // ===== 音频上下文相关 =====
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let processorNode: null | ScriptProcessorNode = null;
  let analyserNode: AnalyserNode | null = null;

  // ===== 缓冲区 =====
  let audioBuffer: Float32Array[] = [];
  let chunkSize = 0;

  // ===== 会话ID =====
  let currentSessionId: null | string = null;

  // ===== 内部方法 =====

  /**
   * 处理音频数据（积累到 chunkSize 后通过 WebSocket 发送）
   */
  const handleAudioData = (inputData: Float32Array) => {
    if (isPaused.value) {
      return; // 暂停时丢弃数据
    }

    audioBuffer.push(inputData);

    let totalLength = 0;
    for (const buf of audioBuffer) {
      totalLength += buf.length;
    }

    if (totalLength >= chunkSize) {
      // 合并所有 buffer
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const buf of audioBuffer) {
        merged.set(buf, offset);
        offset += buf.length;
      }

      // 截取 chunkSize 长度的数据
      const chunk = merged.subarray(0, chunkSize);

      // 处理并发送
      sendAudioChunk(chunk);

      // 保留剩余数据
      if (merged.length > chunkSize) {
        const remaining = merged.subarray(chunkSize);
        audioBuffer = [remaining];
      } else {
        audioBuffer = [];
      }
    }
  };

  /**
   * 发送音频块（重采样 → PCM → WebSocket）
   */
  const sendAudioChunk = (float32Data: Float32Array) => {
    // 获取当前 AudioContext 的实际采样率
    const originalSampleRate = audioContext?.sampleRate || 48_000;

    // 使用 AudioProcessor 一站式处理
    const pcmChunks = AudioProcessor.processForASR(
      float32Data,
      originalSampleRate,
      targetSampleRate,
      chunkDuration,
    );

    // 发送所有块
    for (const chunk of pcmChunks) {
      wsService.sendAudio(chunk);
    }

    // 更新音量（用于波形显示）
    const rms = AudioProcessor.calculateRMS(float32Data);
    volume.value = rms;
  };

  /**
   * 更新音量指示（在音频处理循环中调用）
   */
  const updateVolume = (data: Float32Array) => {
    const rms = AudioProcessor.calculateRMS(data);
    volume.value = rms * 0.5 + volume.value * 0.5; // 平滑
  };

  // ===== 公共方法 =====

  /**
   * 开始录音
   * @param sessionId 会话ID
   */
  const start = async (sessionId: string): Promise<void> => {
    if (isRecording.value) {
      console.warn('[useAudioCapture] 录音已在进行中');
      return;
    }

    // 重置错误状态
    error.value = null;

    try {
      // 1. 建立 WebSocket 连接
      if (!wsService.isConnected()) {
        await wsService.connect(sessionId);
      }
      isConnected.value = true;
      currentSessionId = sessionId;

      // 2. 获取麦克风权限
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation,
          noiseSuppression,
          autoGainControl,
          sampleRate: targetSampleRate,
          channelCount: 1,
        },
      });

      // 3. 创建 AudioContext
      // 注意：某些浏览器不支持指定 sampleRate，会使用系统默认值
      audioContext = new AudioContext({
        sampleRate: targetSampleRate,
      });

      // 如果实际采样率与目标不一致，后续会通过 AudioProcessor 重采样
      console.log(
        '[useAudioCapture] AudioContext 采样率:',
        audioContext.sampleRate,
      );

      // 4. 计算分块大小
      chunkSize = Math.round(audioContext.sampleRate * chunkDuration);

      // 5. 创建音频节点
      sourceNode = audioContext.createMediaStreamSource(mediaStream);
      processorNode = audioContext.createScriptProcessor(4096, 1, 1);
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 512;

      // 6. 连接节点
      sourceNode.connect(analyserNode);
      analyserNode.connect(processorNode);
      processorNode.connect(audioContext.destination);

      // 7. 音频数据处理
      processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
        const inputData = event.inputBuffer.getChannelData(0);
        handleAudioData(inputData);
        updateVolume(inputData);
      };

      // 8. 更新状态
      isRecording.value = true;
      isPaused.value = false;
      audioBuffer = [];

      console.log('[useAudioCapture] 录音已开始, sessionId:', sessionId);
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : '启动录音失败';
      error.value = message;
      console.error('[useAudioCapture] 启动失败:', error_);
      // 清理资源
      cleanup();
      throw error_;
    }
  };

  /**
   * 停止录音
   */
  const stop = (): void => {
    if (!isRecording.value) {
      return;
    }

    // 发送剩余数据
    if (audioBuffer.length > 0) {
      const totalLength = audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const buf of audioBuffer) {
        merged.set(buf, offset);
        offset += buf.length;
      }
      sendAudioChunk(merged);
      audioBuffer = [];
    }

    cleanup();
    isRecording.value = false;
    isPaused.value = false;
    currentSessionId = null;

    console.log('[useAudioCapture] 录音已停止');
  };

  /**
   * 清理音频资源
   */
  const cleanup = (): void => {
    if (processorNode) {
      processorNode.disconnect();
      processorNode.onaudioprocess = null;
      processorNode = null;
    }
    if (analyserNode) {
      analyserNode.disconnect();
      analyserNode = null;
    }
    if (sourceNode) {
      sourceNode.disconnect();
      sourceNode = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    volume.value = 0;
  };

  /**
   * 暂停/恢复切换
   */
  const togglePause = (): void => {
    if (!isRecording.value) {
      return;
    }
    isPaused.value = !isPaused.value;
    wsService.sendControl(isPaused.value ? 'pause' : 'resume');
    console.log('[useAudioCapture] 录音', isPaused.value ? '已暂停' : '已恢复');
  };

  /**
   * 重置状态
   */
  const reset = (): void => {
    if (isRecording.value) {
      stop();
    }
    wsService.disconnect();
    isConnected.value = false;
    error.value = null;
    currentSessionId = null;
    volume.value = 0;
    audioBuffer = [];
    console.log('[useAudioCapture] 已重置');
  };

  // ===== 生命周期 =====
  onUnmounted(() => {
    if (isRecording.value) {
      stop();
    }
    wsService.disconnect();
  });

  // ===== 返回 =====
  return {
    isRecording: readonly(isRecording),
    isPaused: readonly(isPaused),
    isConnected: readonly(isConnected),
    error: readonly(error),
    volume: readonly(volume),
    start,
    stop,
    togglePause,
    reset,
  };
}

// ==================== 导出默认（兼容性） ====================
export default useAudioCapture;
