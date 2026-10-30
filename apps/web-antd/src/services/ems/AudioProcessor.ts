/**
 * 音频处理器
 *
 * 职责：
 * 1. Float32 ↔ Int16 PCM 格式转换
 * 2. 音频重采样（支持 44.1kHz / 48kHz → 16kHz）
 * 3. 音频分块（便于 WebSocket 实时传输）
 *
 * ASR 标准规格：
 * - 采样率：16000 Hz
 * - 位深：16-bit
 * - 声道：单声道
 * - 格式：PCM
 *
 * @example
 * ```ts
 * import { AudioProcessor } from '@/services/ems/AudioProcessor';
 *
 * // 转换 Float32 → Int16 PCM
 * const int16Data = AudioProcessor.float32ToInt16(float32Data);
 *
 * // 重采样到 16kHz
 * const resampled = AudioProcessor.resample(float32Data, 44100, 16000);
 *
 * // 分块（每 0.5 秒一块）
 * const chunks = AudioProcessor.chunkData(int16Data.buffer, 16000, 0.5);
 * ```
 */

// ==================== 类型定义 ====================

/** 音频输出配置 */
export interface AudioConfig {
  /** 目标采样率（ASR 标准：16000） */
  targetSampleRate: number;
  /** 位深（ASR 标准：16-bit） */
  bitDepth: 16;
  /** 声道数（ASR 标准：单声道） */
  channels: 1;
}

/** 音频分块配置 */
export interface ChunkConfig {
  /** 每块时长（秒），默认 0.5 */
  chunkDuration?: number;
  /** 目标采样率，默认 16000 */
  sampleRate?: number;
}

// ==================== AudioProcessor 类 ====================

export class AudioProcessor {
  /** ASR 标准位深 */
  static readonly BIT_DEPTH = 16;
  /** ASR 标准声道数 */
  static readonly CHANNELS = 1;
  /** ASR 标准采样率 */
  static readonly TARGET_SAMPLE_RATE = 16_000;

  /**
   * 计算音频 RMS（均方根，用于音量指示）
   *
   * @param data - Float32Array 音频数据
   * @returns RMS 值（0-1）
   */
  static calculateRMS(data: Float32Array): number {
    let sum = 0;
    for (const datum of data) {
      sum += datum * datum;
    }
    return Math.sqrt(sum / data.length);
  }

  /**
   * 将音频数据切分成固定时长的块（用于实时流式传输）
   *
   * @param pcmBuffer - Int16Array 或 ArrayBuffer PCM 数据
   * @param sampleRate - 采样率（默认 16000）
   * @param chunkDuration - 每块时长（秒），默认 0.5
   * @returns ArrayBuffer 分块数组
   *
   * @example
   * ```ts
   * // 将 16000 采样点（1秒）切成 2 块（每块 0.5 秒）
   * const chunks = AudioProcessor.chunkData(
   *   int16Data.buffer, 16000, 0.5
   * );
   * ```
   */
  static chunkData(
    pcmBuffer: ArrayBuffer | Int16Array,
    sampleRate: number = AudioProcessor.TARGET_SAMPLE_RATE,
    chunkDuration: number = 0.5,
  ): ArrayBuffer[] {
    // 转换为 Int16Array
    const int16Data =
      pcmBuffer instanceof ArrayBuffer ? new Int16Array(pcmBuffer) : pcmBuffer;

    const chunkSize = Math.round(sampleRate * chunkDuration);
    const totalSamples = int16Data.length;
    const chunks: ArrayBuffer[] = [];

    for (let offset = 0; offset < totalSamples; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, totalSamples);
      const chunk = int16Data.subarray(offset, end);
      // 复制数据（subarray 是视图，需要复制出独立 buffer）
      const chunkBuffer = new ArrayBuffer(chunk.byteLength);
      new Int16Array(chunkBuffer).set(chunk);
      chunks.push(chunkBuffer);
    }

    return chunks;
  }

  /**
   * Float32 → 16-bit Int16 PCM 转换
   *
   * Web Audio API 输出的音频数据为 Float32Array，范围 [-1.0, 1.0]。
   * 本方法将其转换为 16-bit PCM Int16Array，范围 [-32768, 32767]。
   *
   * @param float32 - Float32Array 音频数据
   * @param clamp - 是否裁剪超出范围的值，默认 true
   * @returns Int16Array PCM 数据
   *
   * @example
   * ```ts
   * const floatData = new Float32Array([0.5, -0.3, 0.8]);
   * const int16Data = AudioProcessor.float32ToInt16(floatData);
   * // int16Data: [16384, -9830, 26214]
   * ```
   */
  static float32ToInt16(
    float32: Float32Array,
    clamp: boolean = true,
  ): Int16Array {
    const int16 = new Int16Array(float32.length);
    for (let [i, sample] of float32.entries()) {
      if (clamp) {
        sample = Math.max(-1, Math.min(1, sample));
      }
      // 将 [-1, 1] 映射到 [-32768, 32767]
      int16[i] = sample < 0 ? sample * 0x80_00 : sample * 0x7f_ff;
    }
    return int16;
  }

  /**
   * 获取音频时长（秒）
   *
   * @param data - Int16Array 或 Float32Array 音频数据
   * @param sampleRate - 采样率
   * @returns 时长（秒）
   */
  static getDuration(
    data: Float32Array | Int16Array,
    sampleRate: number,
  ): number {
    return data.length / sampleRate;
  }

  /**
   * Int16 PCM → Float32 转换（用于调试或播放）
   *
   * @param int16 - Int16Array PCM 数据
   * @returns Float32Array 音频数据，范围 [-1.0, 1.0]
   */
  static int16ToFloat32(int16: Int16Array): Float32Array {
    const float32 = new Float32Array(int16.length);
    for (const [i, sample] of int16.entries()) {
      // 将 [-32768, 32767] 映射到 [-1, 1]
      float32[i] = sample < 0 ? sample / 0x80_00 : sample / 0x7f_ff;
    }
    return float32;
  }

  /**
   * 检测音频是否静音（可用于 VAD 语音活动检测）
   *
   * @param data - Float32Array 音频数据
   * @param threshold - 静音阈值，默认 0.01
   * @param silenceRatio - 静音比例阈值，默认 0.8（80% 样本低于阈值则认为静音）
   * @returns 是否静音
   */
  static isSilent(
    data: Float32Array,
    threshold: number = 0.01,
    silenceRatio: number = 0.8,
  ): boolean {
    let silentCount = 0;
    for (const datum of data) {
      if (Math.abs(datum) < threshold) {
        silentCount++;
      }
    }
    return silentCount / data.length > silenceRatio;
  }

  /**
   * 合并多个 PCM 数据块
   *
   * @param chunks - ArrayBuffer 数组
   * @returns 合并后的 Int16Array
   */
  static mergeChunks(chunks: ArrayBuffer[]): Int16Array {
    if (chunks.length === 0) {
      return new Int16Array(0);
    }

    let totalLength = 0;
    const int16Chunks = chunks.map((buf) => {
      const arr = new Int16Array(buf);
      totalLength += arr.length;
      return arr;
    });

    const result = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of int16Chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  /**
   * 便捷方法：完整预处理（重采样 + 格式转换 + 分块）
   *
   * 这是一个一站式方法，适用于从 getUserMedia 获取音频后
   * 直接发送到 WebSocket 的场景。
   *
   * @param float32Data - 原始 Float32Array 音频数据
   * @param originalSampleRate - 原始采样率
   * @param targetSampleRate - 目标采样率（默认 16000）
   * @param chunkDuration - 每块时长（秒），默认 0.5
   * @returns 处理后的 PCM 块数组（ArrayBuffer[]）
   *
   * @example
   * ```ts
   * // 在 useAudioCapture 中使用
   * const chunks = AudioProcessor.processForASR(
   *   audioData, audioContext.sampleRate
   * );
   * chunks.forEach(chunk => wsService.sendAudio(chunk));
   * ```
   */
  static processForASR(
    float32Data: Float32Array,
    originalSampleRate: number,
    targetSampleRate: number = AudioProcessor.TARGET_SAMPLE_RATE,
    chunkDuration: number = 0.5,
  ): ArrayBuffer[] {
    // 1. 重采样到目标采样率
    const resampled = this.resample(
      float32Data,
      originalSampleRate,
      targetSampleRate,
    );

    // 2. 转换为 Int16 PCM
    const int16Data = this.float32ToInt16(resampled);

    // 3. 分块
    return this.chunkData(int16Data, targetSampleRate, chunkDuration);
  }

  /**
   * 音频重采样（线性插值）
   *
   * 将音频数据从原始采样率转换到目标采样率。
   * 例如：48kHz → 16kHz（降采样）或 8kHz → 16kHz（升采样）
   *
   * @param data - Float32Array 原始音频数据
   * @param originalSampleRate - 原始采样率（如 48000）
   * @param targetSampleRate - 目标采样率（如 16000）
   * @returns Float32Array 重采样后的音频数据
   *
   * @example
   * ```ts
   * // 从 44.1kHz 降采样到 16kHz
   * const resampled = AudioProcessor.resample(
   *   originalData, 44100, 16000
   * );
   * ```
   */
  static resample(
    data: Float32Array,
    originalSampleRate: number,
    targetSampleRate: number = AudioProcessor.TARGET_SAMPLE_RATE,
  ): Float32Array {
    if (originalSampleRate === targetSampleRate) {
      return [...data]; // 无需重采样，返回副本
    }

    const ratio = originalSampleRate / targetSampleRate;
    const newLength = Math.round(data.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      // 计算源位置（浮点数）
      const srcPos = i * ratio;
      // 线性插值
      const srcIdx = Math.floor(srcPos);
      const frac = srcPos - srcIdx;

      result[i] =
        srcIdx >= data.length - 1
          ? data[data.length - 1]
          : data[srcIdx] * (1 - frac) + data[srcIdx + 1] * frac;
    }

    return result;
  }
}

// ==================== 工具函数（独立导出，方便按需引用） ====================

/**
 * 快速 PCM 转换（直接从 Float32Array 到 ArrayBuffer）
 * 适合在音频处理循环中快速调用
 */
export function convertFloat32ToPCMBuffer(
  float32Data: Float32Array,
): ArrayBuffer {
  const int16 = AudioProcessor.float32ToInt16(float32Data);
  return int16.buffer;
}

/**
 * 快速重采样并转换为 PCM
 */
export function resampleAndConvert(
  float32Data: Float32Array,
  originalSampleRate: number,
  targetSampleRate: number = AudioProcessor.TARGET_SAMPLE_RATE,
): ArrayBuffer {
  const resampled = AudioProcessor.resample(
    float32Data,
    originalSampleRate,
    targetSampleRate,
  );
  const int16 = AudioProcessor.float32ToInt16(resampled);
  return int16.buffer;
}

// ==================== 导出默认对象（兼容性） ====================

export default AudioProcessor;
