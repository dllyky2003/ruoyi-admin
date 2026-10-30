<!-- DoTestClient.vue -->
<script setup lang="ts">
import type { Scenario } from '../../api/ems/types';

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { AudioOutlined, PauseCircleOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';

import {
  downloadBlob,
  getReportFilename,
  reportApi,
} from '../../api/ems/report.api';
// 业务导入
import { useEmsSession } from '../../composables/ems/useEmsSession';
import { useEvaluation } from '../../composables/ems/useEvaluation';
import { wsService } from '../../services/ems/WebSocketService';
import { useEmsStore } from '../../store/modules/ems';
</script>

<template>
  <Page :auto-content-height="true">
    <!-- 页面标题区域 -->
    <div class="page-header">
      <div class="header-left">
        <h2>🚑 院前急救 AI 考核</h2>
        <span v-if="session" class="custom-tag" :class="`tag-${sessionStatusColor}`">
          {{ sessionStatusText }}
        </span>
        <span v-if="session" class="custom-tag tag-blue">
          {{ session?.mode === 'TEACH' ? '📖 教学模式' : '📝 考核模式' }}
        </span>
      </div>
      <div class="header-right">
        <button v-if="session" class="btn-link" @click="handleViewHistory">
          📋 历史记录
        </button>
        <button v-if="session" class="btn-link btn-danger" @click="handleReset">
          重置
        </button>
      </div>
    </div>

    <!-- ====== 开始前：场景选择 ====== -->
    <div v-if="!session" class="setup-card">
      <div class="card-title">📋 考核设置</div>
      <form @submit.prevent="handleCreateSession" class="setup-form">
        <div class="form-item">
          <label class="form-label">考核场景 <span style="color: red">*</span></label>
          <select v-model="setupForm.scenarioId" class="form-select">
            <option v-for="s in scenarios" :key="s.id" :value="s.id">
              {{ s.name }} ({{ difficultyMap[s.difficulty] }})
            </option>
          </select>
          <div v-if="selectedScenario" class="scenario-desc">
            <span style="font-size: 12px; color: #888">{{ selectedScenario.description }}</span>
          </div>
        </div>

        <div class="form-item">
          <label class="form-label">学员姓名</label>
          <input v-model="setupForm.traineeName" placeholder="请输入学员姓名（可选）" maxlength="20" class="form-input" />
        </div>

        <div class="form-item">
          <label class="form-label">考核模式</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" value="EXAM" v-model="setupForm.mode" />
              📝 考核模式
            </label>
            <label class="radio-label">
              <input type="radio" value="TEACH" v-model="setupForm.mode" />
              📖 教学模式（含提示）
            </label>
          </div>
          <div style="margin-top: 8px">
            <span style="font-size: 12px; color: #888">
              {{ setupForm.mode === 'TEACH' ? '教学模式下系统会提供实时操作提示' : '考核模式下无提示，独立完成' }}
            </span>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="!setupForm.scenarioId || isCreating">
            {{ isCreating ? '创建中...' : '🚀 开始考核' }}
          </button>
          <button type="button" class="btn-default" @click="handleLoadDemo">
            加载演示数据
          </button>
        </div>
      </form>
    </div>

    <!-- ====== 进行中：考核面板 ====== -->
    <div v-else class="exam-panel">
      <!-- 学员信息栏 -->
      <div class="info-bar">
        <div class="info-item">
          <div class="info-label">学员</div>
          <div class="info-value">{{ session?.traineeName || '未知' }}</div>
        </div>
        <div class="info-item">
          <div class="info-label">场景</div>
          <div class="info-value">{{ getScenarioName(session?.scenarioId) }}</div>
        </div>
        <div class="info-item">
          <div class="info-label">已用时</div>
          <div class="info-value">{{ formatDuration(elapsedSeconds) }}</div>
        </div>
        <div class="info-item">
          <div class="info-label">转写字数</div>
          <div class="info-value">{{ transcriptWordCount }}</div>
        </div>
      </div>

      <!-- 实时转写区域 -->
      <div class="card transcript-card">
        <div class="card-header">
          <span>📝 实时转写</span>
          <span style="float: right">
            <span class="custom-tag" :class="wsConnected ? 'tag-green' : 'tag-red'">
              ● {{ wsConnected ? '已连接' : '未连接' }}
            </span>
            <button class="btn-link" @click="handleClearTranscript">清空</button>
          </span>
        </div>
        <div class="transcript-content" ref="transcriptContainer">
          <div v-for="(item, index) in transcriptItems" :key="index" class="transcript-item" :class="{ final: item.isFinal }">
            <span class="transcript-text">{{ item.text }}</span>
            <span v-if="item.isFinal" class="final-badge">✓</span>
            <span class="transcript-time">{{ formatTime(item.timestamp) }}</span>
          </div>
          <div v-if="transcriptItems.length === 0" class="empty-placeholder">
            <div style="text-align: center; color: #999; padding: 20px 0">
              <div style="font-size: 48px; margin-bottom: 8px">🎤</div>
              <div>等待语音输入...</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 控制栏 -->
      <div class="card control-card">
        <div class="control-bar">
          <div class="control-group">
            <button class="btn-primary" :disabled="isConnecting || isRecording || !session || session.status === 'COMPLETED'"
              @click="handleStartRecording">
              <AudioOutlined />
              {{ isConnecting ? '连接中...' : '🎤 开始录音' }}
            </button>
            <button class="btn-danger" :disabled="!isRecording" @click="handleStopRecording">
              <PauseCircleOutlined />
              停止录音
            </button>
            <button v-if="isRecording" class="btn-default" @click="handleTogglePause">
              {{ isPaused ? '▶ 恢复' : '⏸ 暂停' }}
            </button>
          </div>

          <!-- 音量指示器 -->
          <div class="volume-indicator" v-if="isRecording">
            <span class="volume-label">音量</span>
            <div class="custom-progress">
              <div class="custom-progress-bg" :style="{
                width: `${volumePercent}%`,
                backgroundColor: volumeColor,
              }"></div>
            </div>
          </div>

          <div class="action-group">
            <button v-if="session?.mode === 'TEACH'" class="btn-default" @click="handleRequestHint">
              💡 获取提示
            </button>
            <button class="btn-primary" :disabled="!session || session.status !== 'RUNNING' || isRecording"
              :loading="isSubmitting" @click="handleSubmit">
              {{ isSubmitting ? '提交中...' : '📊 提交评估' }}
            </button>
          </div>
        </div>

        <!-- 提示 -->
        <div v-if="currentHint" class="custom-alert">
          <span>{{ currentHint }}</span>
          <span class="alert-close" @click="currentHint = ''">×</span>
        </div>

        <!-- ★ 手动转写输入（仅在会话未完成时显示） -->
        <div v-if="session && session.status !== 'COMPLETED'" style="display: flex; gap: 8px; margin-top: 12px">
          <input v-model="manualText" placeholder="输入转写文本（模拟语音识别）" class="form-input" style="flex: 1"
            @keyup.enter="handleSendManualTranscript" />
          <button class="btn-primary" :disabled="!manualText.trim() || sendingTranscript" @click="handleSendManualTranscript">
            {{ sendingTranscript ? '发送中...' : '发送' }}
          </button>
          <button class="btn-primary" :disabled="sendingTranscript" @click="reloadAll">
            {{ sendingTranscript ? '加载中...' : '加载' }}
          </button>
        </div>
      </div>

      <!-- 评估结果 -->
      <div v-if="evaluation" class="card result-card">
        <div class="card-header">
          <span>📊 评估结果</span>
          <span class="custom-tag" :class="evaluation.isPass ? 'tag-green' : 'tag-red'" style="float: right">
            {{ evaluation.isPass ? '✅ 通过' : '❌ 不通过' }}
          </span>
        </div>
        <div class="result-grid">
          <div class="score-display" :class="scoreLevelClass">
            <div class="score-number">{{ evaluation.totalScore }}</div>
            <div class="score-label">总分</div>
          </div>
          <div class="result-details">
            <div class="detail-row">
              <span class="detail-label">评分等级：</span>
              <span class="custom-tag" :class="`tag-${scoreLevelTag}`">{{ scoreLevelText }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">各维度得分：</span>
              <span v-for="(score, key) in evaluation.dimensionScores" :key="key" style="margin-right: 12px">
                {{ dimensionLabelMap[key] || key }}: <strong>{{ score }}</strong>
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">警告：</span>
              <span v-if="evaluation.warnings?.length">
                <span v-for="(w, i) in evaluation.warnings" :key="i" class="custom-tag tag-orange" style="margin: 2px">
                  {{ w }}
                </span>
              </span>
              <span v-else style="color: #999">无</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">致命错误：</span>
              <span v-if="evaluation.criticalErrors?.length">
                <span v-for="(e, i) in evaluation.criticalErrors" :key="i" class="custom-tag tag-red" style="margin: 2px">
                  {{ e }}
                </span>
              </span>
              <span v-else style="color: #52c41a">✅ 无致命错误</span>
            </div>
          </div>
        </div>

        <div class="report-actions">
          <button class="btn-primary" @click="handleViewReport">📄 查看完整报告</button>
          <button class="btn-primary-outline" @click="handleExportMarkdown">📥 导出 Markdown</button>
          <button class="btn-default" @click="handleExportTxt">📥 导出 TXT</button>
          <button v-if="agentTrace" class="btn-link" @click="showAgentTrace = !showAgentTrace">
            🤖 智能体诊断 {{ showAgentTrace ? '▲' : '▼' }}
          </button>
        </div>

        <!-- 智能体诊断 -->
        <div v-show="showAgentTrace && agentTrace" class="agent-trace">
          <hr class="custom-divider" />
          <div style="text-align: center; font-weight: bold; margin: 12px 0">🤖 多智能体诊断轨迹</div>
          <div class="agent-grid">
            <div v-for="(output, name) in agentTrace" :key="name" class="agent-card">
              <div class="mini-card">
                <div class="mini-card-header">
                  <span>{{ name }}</span>
                  <span class="custom-tag" :class="output.score >= 70 ? 'tag-green' : 'tag-orange'" style="float: right">
                    {{ output.score }}分
                  </span>
                </div>
                <div class="agent-output">
                  <p><strong>推理：</strong>{{ output.reasoning }}</p>
                  <p v-if="output.warnings?.length">
                    <strong>警告：</strong>
                    <span v-for="(w, i) in output.warnings" :key="i" style="color: #faad14; margin-right: 8px">
                      {{ w }}
                    </span>
                  </p>
                  <p v-if="output.recommendations?.length">
                    <strong>建议：</strong>
                    <span v-for="(r, i) in output.recommendations" :key="i" style="color: #1890ff; margin-right: 8px">
                      {{ r }}
                    </span>
                  </p>
                  <p v-if="output.hasCriticalViolation" style="color: #ff4d4f">❌ 存在致命违规！</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped lang="scss">
/* ===== 通用 ===== */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    h2 {
      margin: 0;
      font-size: 20px;
    }
  }

  .header-right {
    display: flex;
    gap: 8px;
  }
}

/* ===== 标签 ===== */
.custom-tag {
  display: inline-block;
  padding: 0 8px;
  height: 22px;
  line-height: 22px;
  font-size: 12px;
  border-radius: 4px;
  white-space: nowrap;
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  color: rgba(0, 0, 0, 0.85);

  &.tag-green {
    background: #f6ffed;
    border-color: #b7eb8f;
    color: #52c41a;
  }

  &.tag-red {
    background: #fff1f0;
    border-color: #ffa39e;
    color: #ff4d4f;
  }

  &.tag-orange {
    background: #fff7e6;
    border-color: #ffd591;
    color: #fa8c16;
  }

  &.tag-blue {
    background: #e6f7ff;
    border-color: #91d5ff;
    color: #1890ff;
  }

  &.tag-default {
    background: #fafafa;
    border-color: #d9d9d9;
    color: rgba(0, 0, 0, 0.65);
  }
}

/* ===== 按钮 ===== */
button {
  cursor: pointer;
  border: none;
  background: none;
  font-size: 14px;
  padding: 4px 12px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-link {
  color: #1890ff;
  background: transparent;

  &:hover {
    color: #40a9ff;
  }
}

.btn-link.btn-danger {
  color: #ff4d4f;

  &:hover {
    color: #ff7875;
  }
}

.btn-primary {
  background: #1890ff;
  color: #fff;
  border: 1px solid #1890ff;
  padding: 4px 16px;

  &:hover:not(:disabled) {
    background: #40a9ff;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-primary-outline {
  background: transparent;
  color: #1890ff;
  border: 1px solid #1890ff;
  padding: 4px 16px;

  &:hover {
    background: #e6f7ff;
  }
}

.btn-danger {
  background: #ff4d4f;
  color: #fff;
  border: 1px solid #ff4d4f;
  padding: 4px 16px;

  &:hover:not(:disabled) {
    background: #ff7875;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-default {
  background: #fff;
  color: #333;
  border: 1px solid #d9d9d9;
  padding: 4px 16px;

  &:hover {
    border-color: #40a9ff;
    color: #40a9ff;
  }
}

/* ===== 卡片 ===== */
.card {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.card-header {
  font-weight: 500;
  font-size: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* ===== 设置卡片 ===== */
.setup-card {
  max-width: 700px;
  margin: 0 auto;
}

.setup-form .form-item {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-weight: 500;
  margin-bottom: 4px;
}

.form-select,
.form-input {
  width: 100%;
  padding: 6px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #40a9ff;
    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
  }
}

.scenario-desc {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.radio-group {
  display: flex;
  gap: 16px;

  .radio-label {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* ===== 信息栏 ===== */
.info-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;

  .info-item {
    flex: 1 0 120px;
    background: #f8f9fa;
    padding: 12px 16px;
    border-radius: 8px;
    text-align: center;

    .info-label {
      font-size: 12px;
      color: #888;
      margin-bottom: 4px;
    }

    .info-value {
      font-size: 18px;
      font-weight: bold;
      color: #333;
    }
  }
}

/* ===== 转写 ===== */
.transcript-card .transcript-content {
  height: 240px;
  overflow-y: auto;
  padding: 8px 4px;

  .transcript-item {
    padding: 4px 8px;
    margin: 2px 0;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.8;
    display: flex;
    align-items: center;
    gap: 8px;

    &.final {
      background: #f6ffed;
      color: #52c41a;
    }

    .transcript-text {
      flex: 1;
    }

    .final-badge {
      color: #52c41a;
      font-weight: bold;
    }

    .transcript-time {
      font-size: 12px;
      color: #999;
      flex-shrink: 0;
    }
  }

  .empty-placeholder {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

/* ===== 控制栏 ===== */
.control-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;

  .control-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    flex: 1;
  }

  .volume-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px;

    .volume-label {
      font-size: 13px;
      color: #666;
    }

    .custom-progress {
      width: 120px;
      height: 6px;
      background: #f0f0f0;
      border-radius: 3px;
      overflow: hidden;

      .custom-progress-bg {
        height: 100%;
        transition: width 0.2s;
      }
    }
  }

  .action-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.custom-alert {
  margin-top: 12px;
  padding: 8px 12px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .alert-close {
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    color: #888;

    &:hover {
      color: #333;
    }
  }
}

/* ===== 结果 ===== */
.result-card .result-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;

  .score-display {
    flex: 0 0 120px;
    text-align: center;
    padding: 16px;
    border-radius: 8px;

    .score-number {
      font-size: 48px;
      font-weight: bold;
    }

    .score-label {
      font-size: 14px;
      color: #666;
      margin-top: 4px;
    }

    &.level-excellent {
      background: #f6ffed;

      .score-number {
        color: #52c41a;
      }
    }

    &.level-good {
      background: #e6f7ff;

      .score-number {
        color: #1890ff;
      }
    }

    &.level-average {
      background: #fff7e6;

      .score-number {
        color: #faad14;
      }
    }

    &.level-poor {
      background: #fff1f0;

      .score-number {
        color: #ff4d4f;
      }
    }

    &.level-fail {
      background: #fff1f0;

      .score-number {
        color: #ff4d4f;
      }
    }
  }

  .result-details {
    flex: 1;

    .detail-row {
      margin-bottom: 8px;
      font-size: 14px;

      .detail-label {
        font-weight: bold;
        color: #333;
      }
    }
  }
}

.report-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ===== 智能体 ===== */
.agent-trace {
  margin-top: 16px;

  .custom-divider {
    border: none;
    border-top: 1px solid #e8e8e8;
    margin: 16px 0;
  }

  .agent-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;

    .agent-card {
      flex: 1 1 calc(50% - 8px);
      min-width: 200px;
    }
  }

  .mini-card {
    background: #fafafa;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
    padding: 12px;
  }

  .mini-card-header {
    font-weight: 500;
    margin-bottom: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .agent-output {
    font-size: 13px;
    line-height: 1.8;

    p {
      margin: 4px 0;
    }
  }
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    .header-left {
      flex-wrap: wrap;
    }
  }

  .control-bar {
    flex-direction: column;
    align-items: stretch;

    .control-group,
    .action-group {
      justify-content: center;
    }

    .volume-indicator {
      justify-content: center;
    }
  }

  .result-grid {
    flex-direction: column;
    align-items: center;
  }

  .agent-grid .agent-card {
    flex: 1 1 100%;
  }
}
</style><!-- DoTestClient.vue -->
<script setup lang="ts">
import type { Scenario } from '../../api/ems/types';

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { AudioOutlined, PauseCircleOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';

import {
  downloadBlob,
  getReportFilename,
  reportApi,
} from '../../api/ems/report.api';
// 业务导入
import { useEmsSession } from '../../composables/ems/useEmsSession';
import { useEvaluation } from '../../composables/ems/useEvaluation';
import { wsService } from '../../services/ems/WebSocketService';

// ===== Router =====
const router = useRouter();

// ===== Store =====
const store = useEmsStore();

// ===== Composables =====
const {
  session,
  sessionId,
  createSession,
  startRecording,
  stopRecording,
  togglePause,
  submitEvaluation,
  reset: resetSession,
  onWsMessage,
  isRecording,
  isPaused,
  wsConnected,
  volume,
  sendingTranscript,
  sendTranscript,
} = useEmsSession();

const { evaluation, getAgentTrace, reset: resetEvaluation } = useEvaluation();

// ===== 本地状态 =====
const isCreating = ref(false);
const isConnecting = ref(false);
const isSubmitting = ref(false);
const showAgentTrace = ref(false);
const currentHint = ref('');
const elapsedSeconds = ref(0);
let timer: null | ReturnType<typeof setInterval> = null;

// ===== 转写记录 =====
interface TranscriptItem {
  text: string;
  isFinal: boolean;
  timestamp: number;
}
const transcriptItems = ref<TranscriptItem[]>([]);
const transcriptContainer = ref<HTMLElement | null>(null);

// ===== 设置表单 =====
const setupForm = ref({
  scenarioId: '',
  traineeName: '',
  mode: 'EXAM' as 'EXAM' | 'TEACH',
});

// ===== 场景数据 =====
const scenarios = ref<Scenario[]>([]);
const difficultyMap: Record<string, string> = {
  BASIC: '基础',
  INTERMEDIATE: '中级',
  ADVANCED: '高级',
  EXPERT: '专家',
};

// ===== 计算属性 =====
const selectedScenario = computed(() => {
  return scenarios.value.find((s) => s.id === setupForm.value.scenarioId);
});

const sessionStatusText = computed(() => {
  if (!session.value) return '未知';
  const map: Record<string, string> = {
    INIT: '初始化',
    RUNNING: '进行中',
    PAUSED: '已暂停',
    COMPLETED: '已完成',
  };
  return map[session.value.status] || session.value.status;
});

const sessionStatusColor = computed(() => {
  if (!session.value) return 'default';
  const map: Record<string, string> = {
    INIT: 'blue',
    RUNNING: 'green',
    PAUSED: 'orange',
    COMPLETED: 'default',
  };
  return map[session.value.status] || 'default';
});

const volumePercent = computed(() => {
  return Math.min(100, Math.round((volume.value || 0) * 100));
});

const volumeColor = computed(() => {
  const p = volumePercent.value;
  if (p < 30) return '#52c41a';
  if (p < 60) return '#faad14';
  return '#ff4d4f';
});

const transcriptWordCount = computed(() => {
  return store.transcriptWordCount || 0;
});

const scoreLevelClass = computed(() => {
  if (!evaluation.value) return '';
  const score = evaluation.value.totalScore;
  if (score >= 90) return 'level-excellent';
  if (score >= 80) return 'level-good';
  if (score >= 70) return 'level-average';
  if (score >= 60) return 'level-poor';
  return 'level-fail';
});

const scoreLevelText = computed(() => {
  if (!evaluation.value) return '';
  const score = evaluation.value.totalScore;
  if (score >= 90) return '优秀';
  if (score >= 80) return '良好';
  if (score >= 70) return '中等';
  if (score >= 60) return '及格';
  return '不及格';
});

const scoreLevelTag = computed(() => {
  if (!evaluation.value) return 'default';
  const score = evaluation.value.totalScore;
  if (score >= 80) return 'green';
  if (score >= 60) return 'orange';
  return 'red';
});

const dimensionLabelMap: Record<string, string> = {
  assessmentAccuracy: '评估准确性',
  treatmentSequence: '治疗顺序',
  drugDosage: '药物剂量',
  communication: '沟通质量',
};

const agentTrace = ref<null | Record<string, any>>(null);

// ===== 方法 =====

const getScenarioName = (id?: string): string => {
  if (!id) return '未知';
  const s = scenarios.value.find((sc) => sc.id === id);
  return s ? s.name : id;
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
};

const scrollToBottom = () => {
  nextTick(() => {
    if (transcriptContainer.value) {
      transcriptContainer.value.scrollTop = transcriptContainer.value.scrollHeight;
    }
  });
};

// ===== 事件处理 =====

const handleCreateSession = async () => {
  if (!setupForm.value.scenarioId) {
    message.warning('请选择考核场景');
    return;
  }

  isCreating.value = true;
  try {
    await createSession({
      scenarioId: setupForm.value.scenarioId,
      traineeName: setupForm.value.traineeName || undefined,
      mode: setupForm.value.mode,
    });
    message.success('✅ 会话创建成功');
  } catch {
    // 错误已由 composable 处理
  } finally {
    isCreating.value = false;
  }
};

const handleStartRecording = async () => {
  if (!session.value) {
    message.error('❌ 会话不存在，请先创建会话');
    return;
  }

  if (!sessionId.value) {
    message.error('❌ 会话ID无效，请重新创建会话');
    return;
  }

  isConnecting.value = true;
  try {
    await startRecording();
  } catch (error: any) {
    console.error('[Exam] 启动录音失败:', error);
    message.error(`❌ 录音启动失败: ${error?.message || '未知错误'}`);
  } finally {
    isConnecting.value = false;
  }
};

// ===== 手动转写提交 =====
const manualText = ref('');

const handleSendManualTranscript = async () => {
  if (!session.value) {
    message.error('❌ 会话不存在，请先创建会话');
    return;
  }
  if (!sessionId.value) {
    message.error('❌ 会话ID无效，请重新创建会话');
    return;
  }
  if (!manualText.value.trim()) {
    message.warning('请输入要提交的转写文本');
    return;
  }

  if (!wsService.isConnected()) {
    message.error('❌ WebSocket 未连接，无法发送文本');
    return;
  }

  try {
    await wsService.sendMessage({
      type: 'manual_transcript',
      text: manualText.value.trim(),
    });
    message.success('✅ 转写文本已通过 WebSocket 发送');
    manualText.value = '';
  } catch (error: any) {
    console.error('[Exam] 发送文本失败:', error);
    message.error(`❌ 发送失败: ${error?.message || '未知错误'}`);
  }
};

const reloadAll = async () => {
  if (!session.value) {
    message.error('❌ 会话不存在，请先创建会话');
    return;
  }
  if (!sessionId.value) {
    message.error('❌ 会话ID无效，请重新创建会话');
    return;
  }

  if (!wsService.isConnected()) {
    message.error('❌ WebSocket 未连接，无法发送文本');
    return;
  }

  try {
    await wsService.sendMessage({
      type: 'reloadAll',
      text: '',
    });
    message.success('✅ 已请求重载数据');
  } catch (error: any) {
    console.error('[Exam] 发送失败:', error);
    message.error(`❌ 发送失败: ${error?.message || '未知错误'}`);
  }
};

const handleStopRecording = () => {
  stopRecording();
};

const handleTogglePause = () => {
  togglePause();
};

const handleSubmit = () => {
  Modal.confirm({
    title: '⚠️ 确认提交',
    content: '确认提交当前考核结果吗？提交后将自动结束会话并生成评估报告。',
    okText: '确认提交',
    cancelText: '取消',
    onOk: confirmSubmit,
  });
};

const confirmSubmit = async () => {
  isSubmitting.value = true;
  try {
    if (isRecording.value) {
      stopRecording();
    }
    await submitEvaluation();

    if (sessionId.value) {
      const trace = await getAgentTrace(sessionId.value);
      if (trace) {
        agentTrace.value = trace;
      }
    }

    message.success('✅ 评估完成！');
  } catch {
    // 错误已由 composable 处理
  } finally {
    isSubmitting.value = false;
  }
};

const handleViewReport = () => {
  if (sessionId.value) {
    router.push(`/emergency/report/${sessionId.value}`);
  }
};

const handleExportMarkdown = async () => {
  if (!sessionId.value) return;
  try {
    const blob = await reportApi.exportMarkdown(sessionId.value);
    downloadBlob(blob, getReportFilename(sessionId.value, 'md'));
    message.success('📥 导出成功');
  } catch {
    message.error('导出失败');
  }
};

const handleExportTxt = async () => {
  if (!sessionId.value) return;
  try {
    const blob = await reportApi.exportTxt(sessionId.value);
    downloadBlob(blob, getReportFilename(sessionId.value, 'txt'));
    message.success('📥 导出成功');
  } catch {
    message.error('导出失败');
  }
};

const handleRequestHint = () => {
  const hints = [
    '💡 请评估患者心率和脉搏状态',
    '💡 请评估患者血流动力学是否稳定',
    '💡 请判断QRS宽度是否小于0.12秒',
    '💡 可考虑迷走神经刺激或腺苷给药',
  ];
  currentHint.value = hints[Math.floor(Math.random() * hints.length)];
};

const handleClearTranscript = () => {
  transcriptItems.value = [];
  store.clearTranscript();
};

const handleReset = () => {
  Modal.confirm({
    title: '⚠️ 警告',
    content: '确认重置所有状态吗？当前会话将被终止。',
    okText: '确认重置',
    cancelText: '取消',
    okType: 'danger',
    onOk: () => {
      resetSession();
      resetEvaluation();
      transcriptItems.value = [];
      agentTrace.value = null;
      showAgentTrace.value = false;
      currentHint.value = '';
      elapsedSeconds.value = 0;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      message.success('已重置');
    },
  });
};

const handleViewHistory = () => {
  router.push('/emergency/history');
};

const handleLoadDemo = () => {
  setupForm.value.scenarioId = 'stable_narrow';
  setupForm.value.traineeName = '演示学员';
  setupForm.value.mode = 'TEACH';
  message.info('已加载演示数据');
};

// ===== WebSocket 消息监听 =====

let unregisterWs: (() => void) | null = null;

onMounted(() => {
  store.loadScenarios().then((data) => {
    scenarios.value = data;
    if (data.length > 0) {
      setupForm.value.scenarioId = data[0].id;
    }
  });

  unregisterWs = onWsMessage((msg: any) => {
    switch (msg.type) {
      case 'connected': {
        message.success('✅ WebSocket 连接成功');
        break;
      }
      case 'error': {
        message.error(`❌ ${msg.data?.message || '未知错误'}`);
        break;
      }
      case 'hint': {
        currentHint.value = msg.data?.text || msg.text || '💡 请继续操作';
        break;
      }
      case 'state_change': {
        console.log('[Exam] 状态变更:', msg.from, '→', msg.to);
        break;
      }
      case 'transcript': {
        transcriptItems.value.push({
          text: msg.text,
          isFinal: msg.isFinal,
          timestamp: msg.timestamp || Date.now(),
        });
        store.appendTranscript(msg.text);
        scrollToBottom();
        break;
      }
      default: {
        break;
      }
    }
  });
});

onUnmounted(() => {
  if (unregisterWs) {
    unregisterWs();
  }
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});

// ===== 计时器 =====

watch(
  () => session.value?.status,
  (status) => {
    if (status === 'RUNNING') {
      elapsedSeconds.value = 0;
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        elapsedSeconds.value++;
      }, 1000);
    } else if ((status === 'COMPLETED' || status === 'INIT') && timer) {
      clearInterval(timer);
      timer = null;
    }
  },
  { immediate: true },
);
import { useEmsStore } from '../../store/modules/ems';

// ===== Router =====
const router = useRouter();

// ===== Store =====
const store = useEmsStore();

// ===== Composables =====
const {
  session,
  sessionId,
  createSession,
  startRecording,
  stopRecording,
  togglePause,
  submitEvaluation,
  reset: resetSession,
  onWsMessage,
  isRecording,
  isPaused,
  wsConnected,
  volume,
  sendingTranscript,
  sendTranscript,
} = useEmsSession();

const { evaluation, getAgentTrace, reset: resetEvaluation } = useEvaluation();

// ===== 本地状态 =====
const isCreating = ref(false);
const isConnecting = ref(false);
const isSubmitting = ref(false);
const showAgentTrace = ref(false);
const currentHint = ref('');
const elapsedSeconds = ref(0);
let timer: null | ReturnType<typeof setInterval> = null;

// ===== 转写记录 =====
interface TranscriptItem {
  text: string;
  isFinal: boolean;
  timestamp: number;
}
const transcriptItems = ref<TranscriptItem[]>([]);
const transcriptContainer = ref<HTMLElement | null>(null);

// ===== 设置表单 =====
const setupForm = ref({
  scenarioId: '',
  traineeName: '',
  mode: 'EXAM' as 'EXAM' | 'TEACH',
});

// ===== 场景数据 =====
const scenarios = ref<Scenario[]>([]);
const difficultyMap: Record<string, string> = {
  BASIC: '基础',
  INTERMEDIATE: '中级',
  ADVANCED: '高级',
  EXPERT: '专家',
};

// ===== 计算属性 =====
const selectedScenario = computed(() => {
  return scenarios.value.find((s) => s.id === setupForm.value.scenarioId);
});

const sessionStatusText = computed(() => {
  if (!session.value) return '未知';
  const map: Record<string, string> = {
    INIT: '初始化',
    RUNNING: '进行中',
    PAUSED: '已暂停',
    COMPLETED: '已完成',
  };
  return map[session.value.status] || session.value.status;
});

const sessionStatusColor = computed(() => {
  if (!session.value) return 'default';
  const map: Record<string, string> = {
    INIT: 'blue',
    RUNNING: 'green',
    PAUSED: 'orange',
    COMPLETED: 'default',
  };
  return map[session.value.status] || 'default';
});

const volumePercent = computed(() => {
  return Math.min(100, Math.round((volume.value || 0) * 100));
});

const volumeColor = computed(() => {
  const p = volumePercent.value;
  if (p < 30) return '#52c41a';
  if (p < 60) return '#faad14';
  return '#ff4d4f';
});

const transcriptWordCount = computed(() => {
  return store.transcriptWordCount || 0;
});

const scoreLevelClass = computed(() => {
  if (!evaluation.value) return '';
  const score = evaluation.value.totalScore;
  if (score >= 90) return 'level-excellent';
  if (score >= 80) return 'level-good';
  if (score >= 70) return 'level-average';
  if (score >= 60) return 'level-poor';
  return 'level-fail';
});

const scoreLevelText = computed(() => {
  if (!evaluation.value) return '';
  const score = evaluation.value.totalScore;
  if (score >= 90) return '优秀';
  if (score >= 80) return '良好';
  if (score >= 70) return '中等';
  if (score >= 60) return '及格';
  return '不及格';
});

const scoreLevelTag = computed(() => {
  if (!evaluation.value) return 'default';
  const score = evaluation.value.totalScore;
  if (score >= 80) return 'green';
  if (score >= 60) return 'orange';
  return 'red';
});

const dimensionLabelMap: Record<string, string> = {
  assessmentAccuracy: '评估准确性',
  treatmentSequence: '治疗顺序',
  drugDosage: '药物剂量',
  communication: '沟通质量',
};

const agentTrace = ref<null | Record<string, any>>(null);

// ===== 方法 =====

const getScenarioName = (id?: string): string => {
  if (!id) return '未知';
  const s = scenarios.value.find((sc) => sc.id === id);
  return s ? s.name : id;
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
};

const scrollToBottom = () => {
  nextTick(() => {
    if (transcriptContainer.value) {
      transcriptContainer.value.scrollTop =
        transcriptContainer.value.scrollHeight;
    }
  });
};

// ===== 事件处理 =====

const handleCreateSession = async () => {
  if (!setupForm.value.scenarioId) {
    message.warning('请选择考核场景');
    return;
  }

  isCreating.value = true;
  try {
    await createSession({
      scenarioId: setupForm.value.scenarioId,
      traineeName: setupForm.value.traineeName || undefined,
      mode: setupForm.value.mode,
    });
    message.success('✅ 会话创建成功');
  } catch {
    // 错误已由 composable 处理
  } finally {
    isCreating.value = false;
  }
};

const handleStartRecording = async () => {
  if (!session.value) {
    message.error('❌ 会话不存在，请先创建会话');
    return;
  }

  if (!sessionId.value) {
    message.error('❌ 会话ID无效，请重新创建会话');
    return;
  }

  isConnecting.value = true;
  try {
    await startRecording();
  } catch (error: any) {
    console.error('[Exam] 启动录音失败:', error);
    message.error(`❌ 录音启动失败: ${error?.message || '未知错误'}`);
  } finally {
    isConnecting.value = false;
  }
};

// ===== 手动转写提交 =====
const manualText = ref('');

const handleSendManualTranscript = async () => {
  if (!session.value) {
    message.error('❌ 会话不存在，请先创建会话');
    return;
  }
  if (!sessionId.value) {
    message.error('❌ 会话ID无效，请重新创建会话');
    return;
  }
  if (!manualText.value.trim()) {
    message.warning('请输入要提交的转写文本');
    return;
  }

  if (!wsService.isConnected()) {
    message.error('❌ WebSocket 未连接，无法发送文本');
    return;
  }

  try {
    await wsService.sendMessage({
      type: 'manual_transcript',
      text: manualText.value.trim(),
    });
    message.success('✅ 转写文本已通过 WebSocket 发送');
    manualText.value = '';
  } catch (error: any) {
    console.error('[Exam] 发送文本失败:', error);
    message.error(`❌ 发送失败: ${error?.message || '未知错误'}`);
  }
};

const reloadAll = async () => {
  if (!session.value) {
    message.error('❌ 会话不存在，请先创建会话');
    return;
  }
  if (!sessionId.value) {
    message.error('❌ 会话ID无效，请重新创建会话');
    return;
  }

  if (!wsService.isConnected()) {
    message.error('❌ WebSocket 未连接，无法发送文本');
    return;
  }

  try {
    await wsService.sendMessage({
      type: 'reloadAll',
      text: '',
    });
    message.success('✅ 已请求重载数据');
  } catch (error: any) {
    console.error('[Exam] 发送失败:', error);
    message.error(`❌ 发送失败: ${error?.message || '未知错误'}`);
  }
};

const handleStopRecording = () => {
  stopRecording();
};

const handleTogglePause = () => {
  togglePause();
};

const handleSubmit = () => {
  Modal.confirm({
    title: '⚠️ 确认提交',
    content: '确认提交当前考核结果吗？提交后将自动结束会话并生成评估报告。',
    okText: '确认提交',
    cancelText: '取消',
    onOk: confirmSubmit,
  });
};

const confirmSubmit = async () => {
  isSubmitting.value = true;
  try {
    if (isRecording.value) {
      stopRecording();
    }
    await submitEvaluation();

    if (sessionId.value) {
      const trace = await getAgentTrace(sessionId.value);
      if (trace) {
        agentTrace.value = trace;
      }
    }

    message.success('✅ 评估完成！');
  } catch {
    // 错误已由 composable 处理
  } finally {
    isSubmitting.value = false;
  }
};

const handleViewReport = () => {
  if (sessionId.value) {
    router.push(`/emergency/report/${sessionId.value}`);
  }
};

const handleExportMarkdown = async () => {
  if (!sessionId.value) return;
  try {
    const blob = await reportApi.exportMarkdown(sessionId.value);
    downloadBlob(blob, getReportFilename(sessionId.value, 'md'));
    message.success('📥 导出成功');
  } catch {
    message.error('导出失败');
  }
};

const handleExportTxt = async () => {
  if (!sessionId.value) return;
  try {
    const blob = await reportApi.exportTxt(sessionId.value);
    downloadBlob(blob, getReportFilename(sessionId.value, 'txt'));
    message.success('📥 导出成功');
  } catch {
    message.error('导出失败');
  }
};

const handleRequestHint = () => {
  const hints = [
    '💡 请评估患者心率和脉搏状态',
    '💡 请评估患者血流动力学是否稳定',
    '💡 请判断QRS宽度是否小于0.12秒',
    '💡 可考虑迷走神经刺激或腺苷给药',
  ];
  currentHint.value = hints[Math.floor(Math.random() * hints.length)];
};

const handleClearTranscript = () => {
  transcriptItems.value = [];
  store.clearTranscript();
};

const handleReset = () => {
  Modal.confirm({
    title: '⚠️ 警告',
    content: '确认重置所有状态吗？当前会话将被终止。',
    okText: '确认重置',
    cancelText: '取消',
    okType: 'danger',
    onOk: () => {
      resetSession();
      resetEvaluation();
      transcriptItems.value = [];
      agentTrace.value = null;
      showAgentTrace.value = false;
      currentHint.value = '';
      elapsedSeconds.value = 0;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      message.success('已重置');
    },
  });
};

const handleViewHistory = () => {
  router.push('/emergency/history');
};

const handleLoadDemo = () => {
  setupForm.value.scenarioId = 'stable_narrow';
  setupForm.value.traineeName = '演示学员';
  setupForm.value.mode = 'TEACH';
  message.info('已加载演示数据');
};

// ===== WebSocket 消息监听 =====

let unregisterWs: (() => void) | null = null;

onMounted(() => {
  store.loadScenarios().then((data) => {
    scenarios.value = data;
    if (data.length > 0) {
      setupForm.value.scenarioId = data[0].id;
    }
  });

  unregisterWs = onWsMessage((msg: any) => {
    switch (msg.type) {
      case 'connected': {
        message.success('✅ WebSocket 连接成功');
        break;
      }
      case 'error': {
        message.error(`❌ ${msg.data?.message || '未知错误'}`);
        break;
      }
      case 'hint': {
        currentHint.value = msg.data?.text || msg.text || '💡 请继续操作';
        break;
      }
      case 'state_change': {
        console.log('[Exam] 状态变更:', msg.from, '→', msg.to);
        break;
      }
      case 'transcript': {
        transcriptItems.value.push({
          text: msg.text,
          isFinal: msg.isFinal,
          timestamp: msg.timestamp || Date.now(),
        });
        store.appendTranscript(msg.text);
        scrollToBottom();
        break;
      }
      default: {
        break;
      }
    }
  });
});

onUnmounted(() => {
  if (unregisterWs) {
    unregisterWs();
  }
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});

// ===== 计时器 =====

watch(
  () => session.value?.status,
  (status) => {
    if (status === 'RUNNING') {
      elapsedSeconds.value = 0;
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        elapsedSeconds.value++;
      }, 1000);
    } else if ((status === 'COMPLETED' || status === 'INIT') && timer) {
      clearInterval(timer);
      timer = null;
    }
  },
  { immediate: true },
);
</script>

<template>
  <Page :auto-content-height="true">
    <!-- 页面标题区域 -->
    <div class="page-header">
      <div class="header-left">
        <h2>🚑 院前急救 AI 考核</h2>
        <span
          v-if="session"
          class="custom-tag"
          :class="`tag-${sessionStatusColor}`"
        >
          {{ sessionStatusText }}
        </span>
        <span v-if="session" class="custom-tag tag-blue">
          {{ session?.mode === 'TEACH' ? '📖 教学模式' : '📝 考核模式' }}
        </span>
      </div>
      <div class="header-right">
        <button v-if="session" class="btn-link" @click="handleViewHistory">
          📋 历史记录
        </button>
        <button v-if="session" class="btn-link btn-danger" @click="handleReset">
          重置
        </button>
      </div>
    </div>

    <!-- ====== 开始前：场景选择 ====== -->
    <div v-if="!session" class="setup-card">
      <div class="card-title">📋 考核设置</div>
      <form @submit.prevent="handleCreateSession" class="setup-form">
        <div class="form-item">
          <label class="form-label">考核场景 <span style="color: red">*</span></label>
          <select v-model="setupForm.scenarioId" class="form-select">
            <option v-for="s in scenarios" :key="s.id" :value="s.id">
              {{ s.name }} ({{ difficultyMap[s.difficulty] }})
            </option>
          </select>
          <div v-if="selectedScenario" class="scenario-desc">
            <span style="font-size: 12px; color: #888">{{
              selectedScenario.description
            }}</span>
          </div>
        </div>

        <div class="form-item">
          <label class="form-label">学员姓名</label>
          <input
            v-model="setupForm.traineeName"
            placeholder="请输入学员姓名（可选）"
            maxlength="20"
            class="form-input"
          />
        </div>

        <div class="form-item">
          <label class="form-label">考核模式</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" value="EXAM" v-model="setupForm.mode" />
              📝 考核模式
            </label>
            <label class="radio-label">
              <input type="radio" value="TEACH" v-model="setupForm.mode" />
              📖 教学模式（含提示）
            </label>
          </div>
          <div style="margin-top: 8px">
            <span style="font-size: 12px; color: #888">
              {{
                setupForm.mode === 'TEACH'
                  ? '教学模式下系统会提供实时操作提示'
                  : '考核模式下无提示，独立完成'
              }}
            </span>
          </div>
        </div>

        <div class="form-actions">
          <button
            type="submit"
            class="btn-primary"
            :disabled="!setupForm.scenarioId || isCreating"
          >
            {{ isCreating ? '创建中...' : '🚀 开始考核' }}
          </button>
          <button type="button" class="btn-default" @click="handleLoadDemo">
            加载演示数据
          </button>
        </div>
      </form>
    </div>

    <!-- ====== 进行中：考核面板 ====== -->
    <div v-else class="exam-panel">
      <!-- 学员信息栏 -->
      <div class="info-bar">
        <div class="info-item">
          <div class="info-label">学员</div>
          <div class="info-value">{{ session?.traineeName || '未知' }}</div>
        </div>
        <div class="info-item">
          <div class="info-label">场景</div>
          <div class="info-value">
            {{ getScenarioName(session?.scenarioId) }}
          </div>
        </div>
        <div class="info-item">
          <div class="info-label">已用时</div>
          <div class="info-value">{{ formatDuration(elapsedSeconds) }}</div>
        </div>
        <div class="info-item">
          <div class="info-label">转写字数</div>
          <div class="info-value">{{ transcriptWordCount }}</div>
        </div>
      </div>

      <!-- 实时转写区域 -->
      <div class="card transcript-card">
        <div class="card-header">
          <span>📝 实时转写</span>
          <span style="float: right">
            <span
              class="custom-tag"
              :class="wsConnected ? 'tag-green' : 'tag-red'"
            >
              ● {{ wsConnected ? '已连接' : '未连接' }}
            </span>
            <button class="btn-link" @click="handleClearTranscript">
              清空
            </button>
          </span>
        </div>
        <div class="transcript-content" ref="transcriptContainer">
          <div
            v-for="(item, index) in transcriptItems"
            :key="index"
            class="transcript-item"
            :class="{ final: item.isFinal }"
          >
            <span class="transcript-text">{{ item.text }}</span>
            <span v-if="item.isFinal" class="final-badge">✓</span>
            <span class="transcript-time">{{
              formatTime(item.timestamp)
            }}</span>
          </div>
          <div v-if="transcriptItems.length === 0" class="empty-placeholder">
            <div style="text-align: center; color: #999; padding: 20px 0">
              <div style="font-size: 48px; margin-bottom: 8px">🎤</div>
              <div>等待语音输入...</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 控制栏 -->
      <div class="card control-card">
        <div class="control-bar">
          <div class="control-group">
            <button
              class="btn-primary"
              :disabled="
                isConnecting ||
                isRecording ||
                !session ||
                session.status === 'COMPLETED'
              "
              @click="handleStartRecording"
            >
              <AudioOutlined />
              {{ isConnecting ? '连接中...' : '🎤 开始录音' }}
            </button>
            <button
              class="btn-danger"
              :disabled="!isRecording"
              @click="handleStopRecording"
            >
              <PauseCircleOutlined />
              停止录音
            </button>
            <button
              v-if="isRecording"
              class="btn-default"
              @click="handleTogglePause"
            >
              {{ isPaused ? '▶ 恢复' : '⏸ 暂停' }}
            </button>
          </div>

          <!-- 音量指示器 -->
          <div class="volume-indicator" v-if="isRecording">
            <span class="volume-label">音量</span>
            <div class="custom-progress">
              <div
                class="custom-progress-bg"
                :style="{
                  width: `${volumePercent}%`,
                  backgroundColor: volumeColor,
                }"
              ></div>
            </div>
          </div>

          <div class="action-group">
            <button
              v-if="session?.mode === 'TEACH'"
              class="btn-default"
              @click="handleRequestHint"
            >
              💡 获取提示
            </button>
            <button
              class="btn-primary"
              :disabled="
                !session || session.status !== 'RUNNING' || isRecording
              "
              :loading="isSubmitting"
              @click="handleSubmit"
            >
              {{ isSubmitting ? '提交中...' : '📊 提交评估' }}
            </button>
          </div>
        </div>

        <!-- 提示 -->
        <div v-if="currentHint" class="custom-alert">
          <span>{{ currentHint }}</span>
          <span class="alert-close" @click="currentHint = ''">×</span>
        </div>

        <!-- ★ 手动转写输入（仅在会话未完成时显示） -->
        <div
          v-if="session && session.status !== 'COMPLETED'"
          style="display: flex; gap: 8px; margin-top: 12px"
        >
          <input
            v-model="manualText"
            placeholder="输入转写文本（模拟语音识别）"
            class="form-input"
            style="flex: 1"
            @keyup.enter="handleSendManualTranscript"
          />
          <button
            class="btn-primary"
            :disabled="!manualText.trim() || sendingTranscript"
            @click="handleSendManualTranscript"
          >
            {{ sendingTranscript ? '发送中...' : '发送' }}
          </button>
          <button
            class="btn-primary"
            :disabled="sendingTranscript"
            @click="reloadAll"
          >
            {{ sendingTranscript ? '加载中...' : '加载' }}
          </button>
        </div>
      </div>

      <!-- 评估结果 -->
      <div v-if="evaluation" class="card result-card">
        <div class="card-header">
          <span>📊 评估结果</span>
          <span
            class="custom-tag"
            :class="evaluation.isPass ? 'tag-green' : 'tag-red'"
            style="float: right"
          >
            {{ evaluation.isPass ? '✅ 通过' : '❌ 不通过' }}
          </span>
        </div>
        <div class="result-grid">
          <div class="score-display" :class="scoreLevelClass">
            <div class="score-number">{{ evaluation.totalScore }}</div>
            <div class="score-label">总分</div>
          </div>
          <div class="result-details">
            <div class="detail-row">
              <span class="detail-label">评分等级：</span>
              <span class="custom-tag" :class="`tag-${scoreLevelTag}`">{{
                scoreLevelText
              }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">各维度得分：</span>
              <span
                v-for="(score, key) in evaluation.dimensionScores"
                :key="key"
                style="margin-right: 12px"
              >
                {{ dimensionLabelMap[key] || key }}:
                <strong>{{ score }}</strong>
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">警告：</span>
              <span v-if="evaluation.warnings?.length">
                <span
                  v-for="(w, i) in evaluation.warnings"
                  :key="i"
                  class="custom-tag tag-orange"
                  style="margin: 2px"
                >
                  {{ w }}
                </span>
              </span>
              <span v-else style="color: #999">无</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">致命错误：</span>
              <span v-if="evaluation.criticalErrors?.length">
                <span
                  v-for="(e, i) in evaluation.criticalErrors"
                  :key="i"
                  class="custom-tag tag-red"
                  style="margin: 2px"
                >
                  {{ e }}
                </span>
              </span>
              <span v-else style="color: #52c41a">✅ 无致命错误</span>
            </div>
          </div>
        </div>

        <div class="report-actions">
          <button class="btn-primary" @click="handleViewReport">
            📄 查看完整报告
          </button>
          <button class="btn-primary-outline" @click="handleExportMarkdown">
            📥 导出 Markdown
          </button>
          <button class="btn-default" @click="handleExportTxt">
            📥 导出 TXT
          </button>
          <button
            v-if="agentTrace"
            class="btn-link"
            @click="showAgentTrace = !showAgentTrace"
          >
            🤖 智能体诊断 {{ showAgentTrace ? '▲' : '▼' }}
          </button>
        </div>

        <!-- 智能体诊断 -->
        <div v-show="showAgentTrace && agentTrace" class="agent-trace">
          <hr class="custom-divider" />
          <div style="text-align: center; font-weight: bold; margin: 12px 0">
            🤖 多智能体诊断轨迹
          </div>
          <div class="agent-grid">
            <div
              v-for="(output, name) in agentTrace"
              :key="name"
              class="agent-card"
            >
              <div class="mini-card">
                <div class="mini-card-header">
                  <span>{{ name }}</span>
                  <span
                    class="custom-tag"
                    :class="output.score >= 70 ? 'tag-green' : 'tag-orange'"
                    style="float: right"
                  >
                    {{ output.score }}分
                  </span>
                </div>
                <div class="agent-output">
                  <p><strong>推理：</strong>{{ output.reasoning }}</p>
                  <p v-if="output.warnings?.length">
                    <strong>警告：</strong>
                    <span
                      v-for="(w, i) in output.warnings"
                      :key="i"
                      style="color: #faad14; margin-right: 8px"
                    >
                      {{ w }}
                    </span>
                  </p>
                  <p v-if="output.recommendations?.length">
                    <strong>建议：</strong>
                    <span
                      v-for="(r, i) in output.recommendations"
                      :key="i"
                      style="color: #1890ff; margin-right: 8px"
                    >
                      {{ r }}
                    </span>
                  </p>
                  <p v-if="output.hasCriticalViolation" style="color: #ff4d4f">
                    ❌ 存在致命违规！
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped lang="scss">
/* ===== 通用 ===== */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    h2 {
      margin: 0;
      font-size: 20px;
    }
  }

  .header-right {
    display: flex;
    gap: 8px;
  }
}

/* ===== 标签 ===== */
.custom-tag {
  display: inline-block;
  padding: 0 8px;
  height: 22px;
  line-height: 22px;
  font-size: 12px;
  border-radius: 4px;
  white-space: nowrap;
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  color: rgba(0, 0, 0, 0.85);

  &.tag-green {
    background: #f6ffed;
    border-color: #b7eb8f;
    color: #52c41a;
  }

  &.tag-red {
    background: #fff1f0;
    border-color: #ffa39e;
    color: #ff4d4f;
  }

  &.tag-orange {
    background: #fff7e6;
    border-color: #ffd591;
    color: #fa8c16;
  }

  &.tag-blue {
    background: #e6f7ff;
    border-color: #91d5ff;
    color: #1890ff;
  }

  &.tag-default {
    background: #fafafa;
    border-color: #d9d9d9;
    color: rgba(0, 0, 0, 0.65);
  }
}

/* ===== 按钮 ===== */
button {
  cursor: pointer;
  border: none;
  background: none;
  font-size: 14px;
  padding: 4px 12px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-link {
  color: #1890ff;
  background: transparent;

  &:hover {
    color: #40a9ff;
  }
}

.btn-link.btn-danger {
  color: #ff4d4f;

  &:hover {
    color: #ff7875;
  }
}

.btn-primary {
  background: #1890ff;
  color: #fff;
  border: 1px solid #1890ff;
  padding: 4px 16px;

  &:hover:not(:disabled) {
    background: #40a9ff;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-primary-outline {
  background: transparent;
  color: #1890ff;
  border: 1px solid #1890ff;
  padding: 4px 16px;

  &:hover {
    background: #e6f7ff;
  }
}

.btn-danger {
  background: #ff4d4f;
  color: #fff;
  border: 1px solid #ff4d4f;
  padding: 4px 16px;

  &:hover:not(:disabled) {
    background: #ff7875;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-default {
  background: #fff;
  color: #333;
  border: 1px solid #d9d9d9;
  padding: 4px 16px;

  &:hover {
    border-color: #40a9ff;
    color: #40a9ff;
  }
}

/* ===== 卡片 ===== */
.card {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.card-header {
  font-weight: 500;
  font-size: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* ===== 设置卡片 ===== */
.setup-card {
  max-width: 700px;
  margin: 0 auto;
}

.setup-form .form-item {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-weight: 500;
  margin-bottom: 4px;
}

.form-select,
.form-input {
  width: 100%;
  padding: 6px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #40a9ff;
    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
  }
}

.scenario-desc {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.radio-group {
  display: flex;
  gap: 16px;

  .radio-label {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* ===== 信息栏 ===== */
.info-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;

  .info-item {
    flex: 1 0 120px;
    background: #f8f9fa;
    padding: 12px 16px;
    border-radius: 8px;
    text-align: center;

    .info-label {
      font-size: 12px;
      color: #888;
      margin-bottom: 4px;
    }

    .info-value {
      font-size: 18px;
      font-weight: bold;
      color: #333;
    }
  }
}

/* ===== 转写 ===== */
.transcript-card .transcript-content {
  height: 240px;
  overflow-y: auto;
  padding: 8px 4px;

  .transcript-item {
    padding: 4px 8px;
    margin: 2px 0;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.8;
    display: flex;
    align-items: center;
    gap: 8px;

    &.final {
      background: #f6ffed;
      color: #52c41a;
    }

    .transcript-text {
      flex: 1;
    }

    .final-badge {
      color: #52c41a;
      font-weight: bold;
    }

    .transcript-time {
      font-size: 12px;
      color: #999;
      flex-shrink: 0;
    }
  }

  .empty-placeholder {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

/* ===== 控制栏 ===== */
.control-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;

  .control-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    flex: 1;
  }

  .volume-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px;

    .volume-label {
      font-size: 13px;
      color: #666;
    }

    .custom-progress {
      width: 120px;
      height: 6px;
      background: #f0f0f0;
      border-radius: 3px;
      overflow: hidden;

      .custom-progress-bg {
        height: 100%;
        transition: width 0.2s;
      }
    }
  }

  .action-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.custom-alert {
  margin-top: 12px;
  padding: 8px 12px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .alert-close {
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    color: #888;

    &:hover {
      color: #333;
    }
  }
}

/* ===== 结果 ===== */
.result-card .result-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;

  .score-display {
    flex: 0 0 120px;
    text-align: center;
    padding: 16px;
    border-radius: 8px;

    .score-number {
      font-size: 48px;
      font-weight: bold;
    }

    .score-label {
      font-size: 14px;
      color: #666;
      margin-top: 4px;
    }

    &.level-excellent {
      background: #f6ffed;

      .score-number {
        color: #52c41a;
      }
    }

    &.level-good {
      background: #e6f7ff;

      .score-number {
        color: #1890ff;
      }
    }

    &.level-average {
      background: #fff7e6;

      .score-number {
        color: #faad14;
      }
    }

    &.level-poor {
      background: #fff1f0;

      .score-number {
        color: #ff4d4f;
      }
    }

    &.level-fail {
      background: #fff1f0;

      .score-number {
        color: #ff4d4f;
      }
    }
  }

  .result-details {
    flex: 1;

    .detail-row {
      margin-bottom: 8px;
      font-size: 14px;

      .detail-label {
        font-weight: bold;
        color: #333;
      }
    }
  }
}

.report-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ===== 智能体 ===== */
.agent-trace {
  margin-top: 16px;

  .custom-divider {
    border: none;
    border-top: 1px solid #e8e8e8;
    margin: 16px 0;
  }

  .agent-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;

    .agent-card {
      flex: 1 1 calc(50% - 8px);
      min-width: 200px;
    }
  }

  .mini-card {
    background: #fafafa;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
    padding: 12px;
  }

  .mini-card-header {
    font-weight: 500;
    margin-bottom: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .agent-output {
    font-size: 13px;
    line-height: 1.8;

    p {
      margin: 4px 0;
    }
  }
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    .header-left {
      flex-wrap: wrap;
    }
  }

  .control-bar {
    flex-direction: column;
    align-items: stretch;

    .control-group,
    .action-group {
      justify-content: center;
    }

    .volume-indicator {
      justify-content: center;
    }
  }

  .result-grid {
    flex-direction: column;
    align-items: center;
  }

  .agent-grid .agent-card {
    flex: 1 1 100%;
  }
}
</style>
