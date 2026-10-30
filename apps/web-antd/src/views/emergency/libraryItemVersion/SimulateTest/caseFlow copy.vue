<script setup lang="ts">
import type { Scenario } from '../../../../api/ems/types';

import {
    computed,
    h,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AudioOutlined, PauseCircleOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';

import { useEmsSession } from '../../../../composables/ems/useEmsSession';
import { wsService } from '../../../../services/ems/WebSocketService';
import { useEmsStore } from '../../../../store/modules/ems';
import { request } from '../../../../utils/request';
// 导入三个独立 composable（相对于 caseFlow.vue 的路径）
import { useIntent } from './composables/useIntent';
import { useStateMachine } from './composables/useStateMachine';
import { useVariables } from './composables/useVariables';

// ===== Props =====
const props = defineProps<{
    id?: string;
    sessionId?: string;
}>();

// ===== Router =====
const route = useRoute();
const router = useRouter();

// ===== Store =====
const store = useEmsStore();

// ===== Composable 实例 =====
const intent = useIntent();
const variables = useVariables();
const stateMachine = useStateMachine();

// ===== 会话相关 =====
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
} = useEmsSession();

// ===== 页面状态 =====
const activeTab = ref<'exam' | 'flow' | 'variables'>('flow');
const isCreating = ref(false);
const isConnecting = ref(false);
const isSubmitting = ref(false);
const currentHint = ref('');
const elapsedSeconds = ref(0);
let timer: null | ReturnType<typeof setInterval> = null;

// ===== 转写相关 =====
interface TranscriptItem {
    text: string;
    isFinal: boolean;
    timestamp: number;
    isHint?: boolean;
}
const transcriptItems = ref<TranscriptItem[]>([]);
const transcriptContainer = ref<HTMLElement | null>(null);

// ===== 会话设置 =====
const setupForm = ref({
    scenarioId: '',
    traineeName: '',
    mode: 'EXAM' as 'EXAM' | 'TEACH',
});
const scenarios = ref<Scenario[]>([]);
const difficultyMap: Record<string, string> = {
    BASIC: '基础',
    INTERMEDIATE: '中级',
    ADVANCED: '高级',
    EXPERT: '专家',
};
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

const volumePercent = computed(() =>
    Math.min(100, Math.round((volume.value || 0) * 100)),
);
const volumeColor = computed(() => {
    const p = volumePercent.value;
    if (p < 30) return '#52c41a';
    if (p < 60) return '#faad14';
    return '#ff4d4f';
});
const transcriptWordCount = computed(() => store.transcriptWordCount || 0);

// ===== 统一加载函数 =====
// ★ 改造：优先取 props.sessionId，其次取 route.query.sessionId
const sessionIdFromRoute = computed<string>(() => {
    return props.sessionId || (route.query.sessionId as string) || '';
});

const fetchStateInfo = async (
    sessionIdParam?: string,
    caseTypeParam?: string,
) => {
    const effectiveCaseType =
        caseTypeParam || setupForm.value.scenarioId || 'stable_narrow';

    // ★ 改造：sessionIdFromRoute 加 .value
    const currentSessionId = sessionId.value || sessionIdFromRoute.value;

    const params: Record<string, string> = {};
    if (currentSessionId) {
        params.sessionId = currentSessionId;
    } else if (effectiveCaseType) {
        params.caseType = effectiveCaseType;
    } else {
        return;
    }

    // 开始加载
    stateMachine.loading.value = true;
    variables.variablesLoading.value = true;

    try {
        const result = await request.get('/ems/session/stateInfo', { params });
        const res = result.data;
        // 1. 加载变量
        variables.loadFromStateInfo(res);

        // 2. 加载意图
        intent.loadFromStateInfo(res);

        // 3. 渲染流程图
        const mermaidCode =
            res.mode === 'runtime' ? res.snapshot?.mermaid : res.mermaid;

        if (mermaidCode) {
            console.log('渲染流程图:', mermaidCode);
            await stateMachine.renderMermaid(mermaidCode);
        } else {
            stateMachine.error.value = '未获取到流程图';
        }

        // 4. 高亮当前状态和边
        let currentState = '';
        if (res.mode === 'runtime') {
            currentState = res.snapshot?.currentState;
            // 着色历史边
            if (res.snapshot?.history && Array.isArray(res.snapshot.history)) {
                res.snapshot.history.forEach((item: any) => {
                    if (item.from && item.to) {
                        stateMachine.highlightEdge(item.from, item.to);
                    }
                });
            }
        } else {
            currentState = res.initialState;
        }
        if (currentState) {
            stateMachine.highlightNode(currentState);
        }

        stateMachine.error.value = '';
    } catch (error: any) {
        console.error('加载状态信息失败', error);
        stateMachine.error.value = `加载失败：${error.message || '未知错误'}`;
        message.error('加载配置失败，请刷新重试');
    } finally {
        stateMachine.loading.value = false;
        variables.variablesLoading.value = false;
    }
};

// 手动刷新
const refreshState = async () => {
    // ★ 改造：sessionIdFromRoute 加 .value
    const currentSessionId = sessionId.value || sessionIdFromRoute.value;
    if (currentSessionId) {
        await fetchStateInfo(currentSessionId);
        message.success('已刷新状态');
    } else {
        message.warning('没有会话ID，请先创建会话');
    }
};

// ===== Mermaid 节点点击处理（动态获取进入条件） =====
const onMermaidClick = async (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const nodeElement = target.closest('.node, .cluster') as HTMLElement | null;
    if (!nodeElement) {
        console.log('[Mermaid] 点击非节点区域');
        return;
    }

    // 1. 优先从 data-state 属性获取原始状态名
    const originalState = nodeElement.dataset.state;
    let nodeCode = '';

    if (originalState) {
        nodeCode = originalState;
        console.log('[Mermaid] 从 data-state 获取节点编码:', nodeCode);
    } else {
        // 2. 降级方案：从 id 解析并清理
        const fullId = nodeElement.id;
        let rawId = fullId;
        if (fullId.startsWith('flowchart-')) {
            rawId = fullId.slice('flowchart-'.length);
        }
        nodeCode = rawId.replace(/-\d+$/, '');
        console.log('[Mermaid] 从 id 解析节点编码:', rawId, '-> 清理后:', nodeCode);
    }

    if (!sessionId.value) {
        message.warning('请先创建会话，再查看节点条件');
        return;
    }

    try {
        const result = await request.get('/ems/session/node/entry', {
            params: {
                sessionId: sessionId.value,
                nodeId: nodeCode,
            },
        });

        const data = result.data;
        console.log('[Mermaid] 获取节点进入条件:', data);

        if (data && data.entries && data.entries.length > 0) {
            const entries = data.entries;

            const children = entries.map((entry: any, index: number) => {
                const conditionDisplay = entry.evaluated || entry.rawCondition || '无';
                return h(
                    'div',
                    {
                        style: {
                            borderBottom: '1px solid #f0f0f0',
                            padding: '10px 0',
                        },
                    },
                    [
                        h(
                            'div',
                            { style: { fontWeight: 'bold' } },
                            `${index + 1}. 从 [${entry.from}] 进入`,
                        ),
                        h('div', `📝 ${entry.description}`),
                        h('div', `📐 条件表达式：${entry.rawCondition || '无'}`),
                        h('div', `📊 当前值：${conditionDisplay}`),
                    ],
                );
            });

            const contentVNode = h(
                'div',
                {
                    style: {
                        maxHeight: '400px',
                        overflowY: 'auto',
                        fontSize: '14px',
                    },
                },
                children,
            );

            Modal.info({
                title: `📌 进入节点 [${nodeCode}] 的条件`,
                content: contentVNode,
                width: 700,
                okText: '我知道了',
            });
        } else {
            message.info(`节点 [${nodeCode}] 为起始节点，或无显式进入条件`);
        }
    } catch (error: any) {
        console.error('[Mermaid] 获取节点条件失败:', error);
        message.error(`获取节点条件失败：${error?.message || '未知错误'}`);
    }
};

// ===== 考核方法 =====
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
const formatTime = (timestamp: number): string =>
    new Date(timestamp).toLocaleTimeString();
const scrollToBottom = () => {
    nextTick(() => {
        if (transcriptContainer.value) {
            transcriptContainer.value.scrollTop =
                transcriptContainer.value.scrollHeight;
        }
    });
};

// 创建会话
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
        // 创建后重新加载状态信息
        await fetchStateInfo(sessionId.value);
    } catch {
        // composable 已处理
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

const handleStopRecording = () => stopRecording();
const handleTogglePause = () => togglePause();

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
    console.log('[clear] before', {
        sendingTranscript: sendingTranscript.value,
        wsConnected: wsConnected.value,
        sessionId: sessionId.value,
        status: session.value?.status,
        manualText: manualText.value,
    });

    transcriptItems.value = [];
    store.clearTranscript();

    nextTick(() => {
        console.log('[clear] after nextTick', {
            sendingTranscript: sendingTranscript.value,
            wsConnected: wsConnected.value,
            sessionId: sessionId.value,
            status: session.value?.status,
            manualText: manualText.value,
        });
    });
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
            variables.reset();
            intent.reset();
            stateMachine.resetHighlights();
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

// ===== 意图面板 =====
const selectSubDomain = (name: string) => {
    intent.selectSubDomain(name);
};

// ===== 发送意图示例 =====
const handleIntentClick = async (intentItem: {
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
    if (!intentItem.examples || intentItem.examples.length === 0) {
        message.warning('该意图没有示例文本');
        return;
    }
    const randomIndex = Math.floor(Math.random() * intentItem.examples.length);
    const text = intentItem.examples[randomIndex];
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

const handleIntentCodeClick = async (intentItem: { intent_code: string }) => {
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
            text: intentItem.standard_script,
        });
        message.success(`✅ 已发送意图编码: ${intentItem.standard_script}`);
    } catch (error: any) {
        console.error('[Exam] 发送意图编码失败:', error);
        message.error(`❌ 发送失败: ${error?.message || '未知错误'}`);
    }
};

// ===== WebSocket 消息处理 =====
let unregisterWs: (() => void) | null = null;

function handleWsMessage(msg: any) {
    const type = msg.type;
    const data = msg.data || msg;

    if (type === 'state_change') {
        const from = data.from || msg.from;
        const to = data.to || msg.to;
        const event = data.event || msg.event;

        if (to) {
            stateMachine.highlightNode(to);
        }
        if (from && to) {
            stateMachine.highlightEdge(from, to);
        }

        transcriptItems.value.push({
            text: `📍 状态转移: ${from || '?'} → ${to || '?'} (事件: ${event || '无'})`,
            isFinal: true,
            timestamp: msg.timestamp || Date.now(),
            isHint: false,
        });
        store.appendTranscript(`[状态] ${from} → ${to}`);
        scrollToBottom();
        return;
    }

    switch (type) {
        case 'batch_variable_update': {
            const changes = data.changes || {};
            if (Object.keys(changes).length > 0) {
                variables.mergeVariables(changes);
                const changeText = Object.entries(changes)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ');
                transcriptItems.value.push({
                    text: `📊 批量变量更新: ${changeText}`,
                    isFinal: true,
                    timestamp: msg.timestamp || Date.now(),
                });
                scrollToBottom();
            }
            break;
        }
        case 'connected': {
            message.success('✅ WebSocket 连接成功');
            break;
        }
        case 'error': {
            message.error(`❌ ${data?.message || '未知错误'}`);
            break;
        }
        case 'teamMsg': {
            const hintText = data?.text || data || '💡 提示';
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
            const text = data?.text || data;
            const isFinal = data?.isFinal ?? true;
            if (text) {
                transcriptItems.value.push({
                    text,
                    isFinal,
                    timestamp: msg.timestamp || Date.now(),
                });
                store.appendTranscript(text);
                scrollToBottom();
            }
            break;
        }
        case 'variable_update': {
            const varName = data?.varName;
            const newValue = data?.newValue;
            if (varName !== undefined) {
                variables.mergeVariables({ [varName]: newValue });
                transcriptItems.value.push({
                    text: `📊 变量更新: ${varName} → ${newValue}`,
                    isFinal: true,
                    timestamp: msg.timestamp || Date.now(),
                });
                scrollToBottom();
            }
            break;
        }
        default: {
            console.debug('收到未知消息类型:', type, msg);
            break;
        }
    }
}

// ===== 生命周期 =====
onMounted(async () => {
    // 1. 加载场景列表
    try {
        const data = await store.loadScenarios();
        scenarios.value = data;
        if (data.length > 0) {
            setupForm.value.scenarioId = data[0].id;
            // 2. 加载状态信息（包含变量、意图、流程图）
            // ★ 改造：sessionIdFromRoute 加 .value
            const currentSessionId = sessionId.value || sessionIdFromRoute.value;
            await (currentSessionId
                ? fetchStateInfo(currentSessionId)
                : fetchStateInfo(undefined, setupForm.value.scenarioId));
        }
    } catch (error) {
        console.error('加载场景失败', error);
        message.error('加载场景列表失败');
    }

    // 3. 注册 WebSocket 监听
    // ★ 改造：sessionIdFromRoute 加 .value
    const currentSessionId = sessionId.value || sessionIdFromRoute.value;
    if (
        currentSessionId &&
        wsService &&
        typeof wsService.connect === 'function'
    ) {
        wsService.connect(currentSessionId);
    }
    unregisterWs = onWsMessage(handleWsMessage);
});

onBeforeUnmount(() => {
    stateMachine.destroy();
    if (unregisterWs) {
        unregisterWs();
    }
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
});

// 计时器
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

defineExpose({
    highlightNode: stateMachine.highlightNode,
    resetHighlights: stateMachine.resetHighlights,
    zoomIn: stateMachine.zoomIn,
    zoomOut: stateMachine.zoomOut,
    resetZoom: stateMachine.resetZoom,
});
</script>

<template>
    <div class="mermaid-page">
        <!-- 标签栏 -->
        <div class="tab-bar">
            <button class="tab-btn" :class="{ active: activeTab === 'exam' }" @click="activeTab = 'exam'">
                📝 考核
            </button>

            <button class="tab-btn" :class="{ active: activeTab === 'flow' }" @click="activeTab = 'flow'">
                📊 流程图
            </button>
            <button class="tab-btn" :class="{ active: activeTab === 'variables' }" @click="activeTab = 'variables'">
                📊 变量
            </button>
        </div>

        <div class="content-area">
            <!-- 考核标签 -->
            <div v-show="activeTab === 'exam'" class="exam-container">
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

                <!-- 开始前 -->
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

                <!-- 进行中 -->
                <div v-else class="exam-panel">
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
                                    <PauseCircleOutlined /> 停止录音
                                </button>
                                <button v-if="isRecording" class="btn-default" @click="handleTogglePause">
                                    {{ isPaused ? '▶ 恢复' : '⏸ 暂停' }}
                                </button>
                            </div>
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

                        <div v-if="currentHint" class="custom-alert">
                            <span>{{ currentHint }}</span>
                            <span class="alert-close" @click="currentHint = ''">×</span>
                        </div>

                        <div v-if="session && session.status !== 'COMPLETED'"
                            style="display: flex; gap: 8px; margin-top: 12px">
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

                        <div v-if="session && session.status !== 'COMPLETED'" class="intent-panel">
                            <div class="intent-panel-title">🤖 意图快捷输入</div>
                            <div class="intent-panel-body">
                                <div class="sub-domain-list">
                                    <div v-for="def in intent.intentDefinitions.value" :key="def.subDomainName"
                                        class="sub-domain-item" :class="{
                                            active:
                                                intent.selectedSubDomain.value === def.subDomainName,
                                        }" @click="selectSubDomain(def.subDomainName)">
                                        {{ def.subDomainName }}
                                    </div>
                                </div>
                                <div class="intent-list">
                                    <div v-if="intent.loadingIntents.value" class="loading-placeholder">
                                        加载中...
                                    </div>
                                    <div v-else-if="!intent.selectedSubDomain.value" class="empty-placeholder">
                                        ← 请选择一个子领域
                                    </div>
                                    <div v-else-if="intent.currentIntents.value.length === 0" class="empty-placeholder">
                                        该子领域下暂无意图
                                    </div>
                                    <template v-else>
                                        <div v-for="intentItem in intent.currentIntents.value"
                                            :key="intentItem.intentCode" class="intent-item">
                                            <button class="intent-btn" @click="handleIntentClick(intentItem)">
                                                {{ intentItem.nameCn }}
                                            </button>
                                            <button class="intent-btn intent-btn-green"
                                                @click="handleIntentCodeClick(intentItem)">
                                                {{ intentItem.intentCode }}
                                            </button>
                                        </div>
                                    </template>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 流程图标签 -->
            <div v-show="activeTab === 'flow'" class="flow-container">
                <div class="sidebar">
                    <div class="sidebar-title">操作</div>
                    <button class="sidebar-btn refresh-btn" @click="refreshState">
                        🔄 刷新状态
                    </button>
                </div>
                <div class="main-area">
                    <div v-show="stateMachine.loading.value" class="loading">
                        加载中...
                    </div>
                    <div v-show="stateMachine.error.value" class="error">
                        {{ stateMachine.error.value }}
                    </div>
                    <div :ref="(el) => {
                            stateMachine.mermaidContainer.value = el;
                        }
                        " class="mermaid-container" @click="onMermaidClick"></div>
                    <div v-if="!stateMachine.loading.value && !stateMachine.error.value" class="zoom-controls">
                        <button @click="stateMachine.zoomIn()">＋</button>
                        <button @click="stateMachine.zoomOut()">－</button>
                        <button @click="stateMachine.resetZoom()">⟲</button>
                    </div>
                </div>
            </div>

            <!-- 变量标签 -->
            <div v-show="activeTab === 'variables'" class="variables-container">
                <div class="page-header">
                    <h2>📊 变量监控</h2>
                    <div>
                        <span class="custom-tag tag-blue">实时更新</span>
                        <button class="btn-link" @click="fetchStateInfo" :disabled="stateMachine.loading.value || variables.variablesLoading.value
                            ">
                            {{
                                stateMachine.loading.value || variables.variablesLoading.value
                                    ? '加载中...'
                            : '🔄 刷新'
                            }}
                        </button>
                    </div>
                </div>
                <div class="variables-table-wrapper">
                    <table class="variables-table">
                        <thead>
                            <tr>
                                <th style="width: 30px">#</th>
                                <th>变量名（英文）</th>
                                <th>中文名</th>

                                <th>当前值</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="
                                stateMachine.loading.value || variables.variablesLoading.value
                            ">
                                <td colspan="4" style="text-align: center">加载中...</td>
                            </tr>
                            <tr v-else-if="
                                Object.keys(variables.variablesData.value).length === 0
                            ">
                                <td colspan="4" style="text-align: center; color: #999">
                                    暂无变量数据，请创建会话
                                </td>
                            </tr>
                            <tr v-for="(value, key, index) in variables.variablesData.value" :key="key">
                                <td>{{ index + 1 }}</td>
                                <td>
                                    <code>{{ key }}</code>
                                </td>

                                <td>{{ variables.variableMetaMap.value[key] || '—' }}</td>
                                <td>
                                    <span class="variable-value">{{
                                        value !== undefined && value !== null ? value : 'null'
                                        }}</span>
                                    <span v-if="typeof value === 'boolean'" style="margin-left: 6px; font-size: 12px">
                                        {{ value ? '✅' : '❌' }}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
/* ===== 通用样式 ===== */
.mermaid-page {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.tab-bar {
    display: flex;
    gap: 0;
    background: #f0f2f5;
    padding: 8px 16px 0;
    border-bottom: 1px solid #d9d9d9;
}

.tab-btn {
    padding: 8px 20px;
    border: none;
    background: transparent;
    font-size: 15px;
    cursor: pointer;
    border-radius: 4px 4px 0 0;
    transition: all 0.2s;

    &:hover {
        background: #e6f7ff;
    }

    &.active {
        background: #fff;
        border-bottom: 2px solid #1890ff;
        font-weight: 500;
        color: #1890ff;
    }
}

.content-area {
    flex: 1;
    overflow: hidden;
    background: #fff;
}

/* 流程图布局 */
.flow-container {
    display: flex;
    height: 100%;
}

.sidebar {
    width: 200px;
    padding: 12px;
    background: #fafafa;
    border-right: 1px solid #e8e8e8;
    overflow-y: auto;

    .sidebar-title {
        font-weight: bold;
        margin-bottom: 8px;
    }

    .sidebar-btn {
        display: block;
        width: 100%;
        padding: 6px 12px;
        margin: 2px 0;
        border: 1px solid transparent;
        border-radius: 4px;
        background: transparent;
        text-align: left;
        cursor: pointer;
        transition: background 0.2s;

        &:hover {
            background: #e6f7ff;
        }

        &.refresh-btn {
            background: #1890ff;
            color: #fff;
            text-align: center;
            font-weight: 500;

            &:hover {
                background: #40a9ff;
            }
        }
    }
}

.main-area {
    flex: 1;
    position: relative;
    padding: 12px;
    overflow: hidden;
}

.mermaid-container {
    width: 100%;
    height: calc(100% - 40px);
    overflow: hidden;
    position: relative;

    svg {
        display: block;
        width: 100%;
        height: auto;
    }
}

.zoom-controls {
    position: absolute;
    bottom: 12px;
    right: 12px;
    display: flex;
    gap: 4px;

    button {
        width: 32px;
        height: 32px;
        border: 1px solid #d9d9d9;
        border-radius: 4px;
        background: #fff;
        cursor: pointer;
        font-size: 18px;

        &:hover {
            background: #f0f0f0;
        }
    }
}

.loading,
.error {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    font-size: 18px;
    color: #666;
}

.error {
    color: #dc3545;
}

/* 考核样式 */
.exam-container {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
}

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

    &.btn-danger {
        color: #ff4d4f;

        &:hover {
            color: #ff7875;
        }
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

    .intent-item {
        display: flex;
        align-items: center;
        gap: 6px;
    }

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

/* ===== 变量样式 ===== */
.variables-container {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
}

.variables-table-wrapper {
    background: #fff;
    border-radius: 8px;
    border: 1px solid #f0f0f0;
    overflow: auto;
}

.variables-table {
    width: 100%;
    border-collapse: collapse;

    th,
    td {
        padding: 10px 16px;
        text-align: left;
        border-bottom: 1px solid #f0f0f0;
    }

    th {
        background: #fafafa;
        font-weight: 600;
        position: sticky;
        top: 0;
        z-index: 2;
    }

    code {
        background: #f5f5f5;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 13px;
    }

    .variable-value {
        font-weight: 500;
        color: #333;
    }

    tr:hover {
        background: #f0f7ff;
    }
}

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

    .variables-table {

        th,
        td {
            padding: 6px 10px;
            font-size: 13px;
        }
    }
}
</style>
