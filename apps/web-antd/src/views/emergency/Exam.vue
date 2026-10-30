/* eslint-disable indent */
<script setup lang="ts">
import type { Scenario } from '../../api/ems/types';

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { AudioOutlined, PauseCircleOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';

import { useEmsSession } from '../../composables/ems/useEmsSession';
import { wsService } from '../../services/ems/WebSocketService';
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

// ===== 本地状态 =====
const isCreating = ref(false);
const isConnecting = ref(false);
const isSubmitting = ref(false);
const currentHint = ref('');
const elapsedSeconds = ref(0);
let timer: null | ReturnType<typeof setInterval> = null;

// ===== 转写记录 =====
interface TranscriptItem {
	text: string;
	isFinal: boolean;
	timestamp: number;
	isHint?: boolean;
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

// ===== 从 Store 获取意图数据 =====
const intentDefinitions = computed(() => store.intentDefinitions);
const loadingIntents = computed(() => store.loadingIntents);

// ===== 选中的子域 =====
const selectedSubDomain = ref<null | string>(null);

// 监听意图数据变化，自动选中第一个子域
watch(
	intentDefinitions,
	(newData) => {
		if (newData && newData.length > 0 && !selectedSubDomain.value) {
			selectedSubDomain.value = newData[0].subDomainName;
			console.log('[Exam] watch 自动选中子域:', selectedSubDomain.value);
		}
	},
	{ immediate: true },
);

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
		message.error(
			`❌ 录音启动失败: ${error?.message || '未知错误，请查看控制台'}`,
		);
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
		message.success('✅ 已触发重载');
		manualText.value = '';
	} catch (error: any) {
		console.error('[Exam] 发送重载指令失败:', error);
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
		onOk: async () => {
			isSubmitting.value = true;
			try {
				if (isRecording.value) {
					stopRecording();
				}
				await submitEvaluation();
				message.success('✅ 评估提交成功，报告已生成！');
			} catch {
				// 错误已由 composable 处理
			} finally {
				isSubmitting.value = false;
			}
		},
	});
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
			transcriptItems.value = [];
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
	setupForm.value.traineeName = '演示学员1';
	setupForm.value.mode = 'TEACH';
	message.info('已加载演示数据');
};

// ===== 意图面板相关方法 =====
const selectSubDomain = (subDomainName: string) => {
	selectedSubDomain.value = subDomainName;
};

const currentIntents = computed(() => {
	if (!selectedSubDomain.value) return [];
	const def = intentDefinitions.value.find(
		(d) => d.subDomainName === selectedSubDomain.value,
	);
	return def ? def.intents : [];
});

// 原有：发送随机示例
const handleIntentClick = async (intent: {
	examples: string[];
	intentName: string;
}) => {
	if (!session.value || !sessionId.value) {
		message.error('❌ 会话不存在，请先创建会话');
		return;
	}
	if (!wsService.isConnected()) {
		message.error('❌ WebSocket 未连接，无法发送');
		return;
	}

	if (!intent.examples || intent.examples.length === 0) {
		message.warning('该意图没有示例文本');
		return;
	}

	const randomIndex = Math.floor(Math.random() * intent.examples.length);
	const text = intent.examples[randomIndex];

	try {
		const result = wsService.sendMessage({
			type: 'manual_transcript',
			text,
		});
		if (result && typeof result.then === 'function') {
			await result;
		}
		message.success(`✅ 已发送: "${text}"`);
	} catch (error: any) {
		console.error('[Exam] 发送意图示例失败:', error);
		message.error(`❌ 发送失败: ${error?.message || '未知错误'}`);
	}
};

// ===== 新增：直接发送意图编码 =====
const handleIntentCodeClick = async (intent: { intentCode: string }) => {
	if (!session.value || !sessionId.value) {
		message.error('❌ 会话不存在，请先创建会话');
		return;
	}
	if (!wsService.isConnected()) {
		message.error('❌ WebSocket 未连接，无法发送');
		return;
	}
	try {
		await wsService.sendMessage({
			type: 'manual_transcript',
			text: intent.intent_code,
		});
		message.success(`✅ 已发送意图编码: ${intent.intent_code}`);
	} catch (error: any) {
		console.error('[Exam] 发送意图编码失败:', error);
		message.error(`❌ 发送失败: ${error?.message || '未知错误'}`);
	}
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

	store
		.loadIntentDefinitions(setupForm.value.scenarioId)
		.then(() => {
			// 由 watch 自动选中子域
		})
		.catch((error) => {
			console.error('[Exam] 意图数据加载失败:', error);
			message.error('加载意图数据失败');
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
			case 'state_change': {
				console.log('[Exam] 状态变更:', msg.from, '→', msg.to);
				break;
			}
			case 'teamMsg': {
				const hintText = msg.data?.text || msg.text || '💡 提示';
				currentHint.value = hintText;
				transcriptItems.value.push({
					text: `💡 ${hintText}`,
					isFinal: true,
					timestamp: msg.timestamp || Date.now(),
					isHint: true,
				});
				store.appendTranscript(`[提示] ${hintText}`);
				scrollToBottom();
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
						<span style="font-size: 12px; color: #888">{{
							selectedScenario.description
						}}</span>
					</div>
				</div>

				<div class="form-item">
					<label class="form-label">学员姓名</label>
					<input v-model="setupForm.traineeName" placeholder="请输入学员姓名（可选）" maxlength="20"
						class="form-input" />
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
						<span class="custom-tag" :class="wsConnected ? 'tag-green' : 'tag-red'">
							● {{ wsConnected ? '已连接' : '未连接' }}
						</span>
						<button class="btn-link" @click="handleClearTranscript">
							清空
						</button>
					</span>
				</div>
				<div class="transcript-content" ref="transcriptContainer">
					<div v-for="(item, index) in transcriptItems" :key="index" class="transcript-item"
						:class="{ final: item.isFinal }">
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
						<button class="btn-primary" :disabled="isConnecting ||
							isRecording ||
							!session ||
							session.status === 'COMPLETED'
							" @click="handleStartRecording">
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
						<button class="btn-primary" :disabled="!session || session.status !== 'RUNNING' || isRecording
							" :loading="isSubmitting" @click="handleSubmit">
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
					<button class="btn-primary" :disabled="!manualText.trim() || sendingTranscript"
						@click="handleSendManualTranscript">
						{{ sendingTranscript ? '发送中...' : '发送' }}
					</button>

					<button class="btn-primary" :disabled="sendingTranscript" @click="reloadAll">
						{{ sendingTranscript ? '加载中...' : '加载' }}
					</button>
				</div>

				<!-- ★ 意图快捷面板（仅在会话未完成时显示） -->
				<div v-if="session && session.status !== 'COMPLETED'" class="intent-panel">
					<div class="intent-panel-title">🤖 意图快捷输入</div>
					<div class="intent-panel-body">
						<!-- 左侧 subDomain 列表 -->
						<div class="sub-domain-list">
							<div v-for="def in intentDefinitions" :key="def.subDomainName" class="sub-domain-item"
								:class="{ active: selectedSubDomain === def.subDomainName }"
								@click="selectSubDomain(def.subDomainName)">
								{{ def.subDomainName }}
							</div>
						</div>
						<!-- 右侧 intent 按钮列表 -->
						<div class="intent-list">
							<div v-if="loadingIntents" class="loading-placeholder">
								加载中...
							</div>
							<div v-else-if="!selectedSubDomain" class="empty-placeholder">
								← 请选择一个子领域
							</div>
							<div v-else-if="currentIntents.length === 0" class="empty-placeholder">
								该子领域下暂无意图
							</div>
							<template v-else>
								<!-- 每个意图显示两个按钮 -->
								<div v-for="intent in currentIntents" :key="intent.intentCode" class="intent-item">
									<!-- 原有按钮：发送随机示例文本 -->
									<button class="intent-btn" @click="handleIntentClick(intent)">
										{{ intent.name_cn }}
									</button>
									<!-- 新增绿色按钮：直接发送 intentCode -->
									<button class="intent-btn intent-btn-green" @click="handleIntentCodeClick(intent)">
										{{ intent.intent_code }}
									</button>
								</div>
							</template>
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

/* ===== 意图面板 ===== */
.intent-panel {
	margin-top: 12px;
	border: 1px solid #e8e8e8;
	border-radius: 8px;
	padding: 14px 16px;
	background: #fafafa;
}

.intent-panel-title {
	font-weight: 600;
	font-size: 15px;
	margin-bottom: 12px;
	color: #333;
}

.intent-panel-body {
	display: flex;
	gap: 16px;
	min-height: 100px;
}

/* 左侧子域列表 - 加大尺寸 */
.sub-domain-list {
	flex: 0 0 140px;
	display: flex;
	flex-direction: column;
	gap: 6px;
	border-right: 1px solid #e8e8e8;
	padding-right: 14px;

	.sub-domain-item {
		padding: 10px 14px;
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		color: #555;
		transition: all 0.2s;
		white-space: nowrap;

		&:hover {
			background: #e6f7ff;
			color: #1890ff;
		}

		&.active {
			background: #1890ff;
			color: #fff;
			font-weight: 600;
		}
	}
}

/* 右侧意图按钮列表 - 加大尺寸 */
.intent-list {
	flex: 1;
	display: flex;
	flex-wrap: wrap;
	align-content: flex-start;
	gap: 10px;
	padding-left: 4px;

	.loading-placeholder,
	.empty-placeholder {
		color: #999;
		font-size: 14px;
		padding: 12px 0;
		width: 100%;
		text-align: center;
	}

	/* 每个意图的容器 - 横向排列两个按钮 */
	.intent-item {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	/* 原有灰色按钮（发送示例） */
	.intent-btn {
		background: #fff;
		border: 1px solid #d9d9d9;
		border-radius: 6px;
		padding: 8px 20px;
		font-size: 15px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		color: #333;
		min-height: 36px;
		white-space: nowrap;

		&:hover {
			border-color: #40a9ff;
			color: #40a9ff;
			background: #f0faff;
			transform: translateY(-1px);
			box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
		}

		&:active {
			background: #e6f7ff;
			transform: scale(0.97);
		}
	}

	/* 新增绿色按钮（发送 intentCode） */
	.intent-btn-green {
		background: #52c41a;
		border: 1px solid #52c41a;
		color: #fff;
		padding: 8px 14px;
		font-size: 13px;
		font-weight: 500;
		min-height: 36px;
		white-space: nowrap;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			background: #73d13d;
			border-color: #73d13d;
			color: #fff;
			transform: translateY(-1px);
			box-shadow: 0 2px 8px rgba(82, 196, 26, 0.2);
		}

		&:active {
			transform: scale(0.97);
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

	/* 意图面板响应式 - 移动端适配 */
	.intent-panel-body {
		flex-direction: column;
	}

	.sub-domain-list {
		flex: auto;
		flex-direction: row;
		flex-wrap: wrap;
		border-right: none;
		border-bottom: 1px solid #e8e8e8;
		padding-right: 0;
		padding-bottom: 10px;
		gap: 6px;

		.sub-domain-item {
			padding: 6px 12px;
			font-size: 13px;
		}
	}

	.intent-list {
		gap: 8px;

		.intent-item {
			flex-wrap: wrap;
		}

		.intent-btn {
			padding: 6px 14px;
			font-size: 14px;
			min-height: 32px;
		}

		.intent-btn-green {
			padding: 6px 12px;
			font-size: 12px;
			min-height: 32px;
		}
	}
}
</style>
