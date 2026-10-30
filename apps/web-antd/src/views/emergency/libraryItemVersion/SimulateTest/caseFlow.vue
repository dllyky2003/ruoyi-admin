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
import mermaid from 'mermaid';

import { useEmsSession } from '../../../../composables/ems/useEmsSession';
import { wsService } from '../../../../services/ems/WebSocketService';
import { useEmsStore } from '../../../../store/modules/ems';
import { request } from '../../../../utils/request';
// 导入四个独立 composable
import { useIntent } from './composables/useIntent';
import { useRoomJoin } from './composables/useRoomJoin';
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

// ★ 房间加入 composable
const {
    rooms,
    isLoadingRooms,
    loadRooms,
    joinRoomId,
    isJoining,
    roomJoined,
    roomWsConnected,
    handleJoinRoom,
    handleLeaveRoom,
    dispose: disposeRoom,
} = useRoomJoin();

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

// ===== ★ Phase 子状态机 Modal =====
const phaseModalVisible = ref(false);
const phaseModalLoading = ref(false);
const phaseModalTitle = ref('');
const phaseModalContainer = ref<HTMLElement | null>(null);
// ★ Phase Modal 高亮相关
const lastStateInfo = ref<any>(null); // 缓存最近一次 snapshot
const cachedPhases = ref<any[]>([]); // 缓存 definitions.phases
const phaseModalPhaseId = ref<string>(''); // 当前 Modal 展示的 phaseId

// ===== ★ 已知 phase 集合（动态构建 + 硬编码兜底）=====
// 用途：主图点击节点时，优先判断是否为 phase：
//   - 是 phase → 打开内部 state 图（/phase/subgraph）
//   - 不是    → 走 state 进入条件逻辑（/node/entry）
// 说明：
//   1) 会从后端 /stateInfo 的 definitions.phases 递归收集所有 phase id（含 children 子阶段）
//   2) 若后端未返回 phases（老接口），则回退到硬编码兜底集合
const KNOWN_PHASES_FALLBACK = new Set<string>([
    'ADENOSINE_6MG',
    'ADENOSINE_12MG',
    // GLOBAL 顶层
    'BLS',
    'BRADY',
    'CARDIOVERSION',
    'CPR',
    'MONITOR',
    'POST_ROSC',
    'ROSC',
    'SECOND_LINE',
    'SETUP',
    // SVT_PATH 子阶段
    'SVT_ASSESSMENT',
    // 顶层 phase 兜底
    'SVT_PATH',
    'TERMINATION',
    'VAGAL',
    'WIDE_QRS_UNSTABLE',
]);
const knownPhases = ref<Set<string>>(new Set(KNOWN_PHASES_FALLBACK));

/**
 * 递归收集 phase id（含 children 子阶段），写入 acc
 */
const collectPhaseIds = (
    phases: any[] | null | undefined,
    acc: Set<string>,
) => {
    if (!Array.isArray(phases)) return;
    for (const p of phases) {
        if (p?.id) acc.add(p.id);
        if (Array.isArray(p?.children) && p.children.length > 0) {
            collectPhaseIds(p.children, acc);
        }
    }
};

/**
 * ★ 递归查找 phase 定义
 */
const findPhaseById = (phases: any[], id: string): any | null => {
    if (!Array.isArray(phases)) return null;
    for (const p of phases) {
        if (p?.id === id) return p;
        if (Array.isArray(p?.children)) {
            const found = findPhaseById(p.children, id);
            if (found) return found;
        }
    }
    return null;
};

/**
 * ★ 递归收集 phase 下所有 id（自身 + 子 phase id + 所有子孙 state id）
 */
const collectAllIds = (phase: any, acc: Set<string>): Set<string> => {
    if (!phase) return acc;
    if (phase.id) acc.add(phase.id);
    if (Array.isArray(phase.children)) {
        for (const child of phase.children) {
            collectAllIds(child, acc);
        }
    }
    if (Array.isArray(phase.states)) {
        for (const s of phase.states) {
            acc.add(s);
        }
    }
    return acc;
};

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
const sessionIdFromRoute = computed<string>(() => {
    return props.sessionId || (route.query.sessionId as string) || '';
});

const fetchStateInfo = async (
    sessionIdParam?: string,
    caseTypeParam?: string,
) => {
    // ★ 防御：模板里直接 `@click="fetchStateInfo"` 会把 MouseEvent 传进来，
    //   这里只认字符串，其他一律忽略。
    const safeSessionId =
        typeof sessionIdParam === 'string' ? sessionIdParam : '';
    const safeCaseType = typeof caseTypeParam === 'string' ? caseTypeParam : '';

    // ★ 三级兜底：显式参数 → 表单选择 → props.id（传入的 caseId）
    const effectiveCaseType =
        safeCaseType || setupForm.value.scenarioId || props.id || '';

    const currentSessionId =
        safeSessionId || sessionId.value || sessionIdFromRoute.value;

    const params: Record<string, string> = {};
    if (currentSessionId) {
        params.sessionId = currentSessionId;
    } else if (effectiveCaseType) {
        params.caseType = effectiveCaseType;
    } else {
        // 既没有 sessionId 也没有 caseId，直接返回，避免发出非法请求
        return;
    }

    // console.log('[StateInfo] 请求参数:', JSON.stringify(params));

    stateMachine.loading.value = true;
    variables.variablesLoading.value = true;

    try {
        const result = await request.get('/ems/session/stateInfo', { params });
        const res = result.data;

        variables.loadFromStateInfo(res);
        intent.loadFromStateInfo(res);

        // ★ 缓存 snapshot 用于 Modal 高亮
        if (res.mode === 'runtime' && res.snapshot) {
            lastStateInfo.value = res.snapshot;
        }

        // ★ 动态构建 knownPhases + 缓存 phases 定义
        const phasesDef = res?.definitions?.phases || res?.phases;
        if (Array.isArray(phasesDef) && phasesDef.length > 0) {
            cachedPhases.value = phasesDef;

            const acc = new Set<string>();
            collectPhaseIds(phasesDef, acc);
            if (acc.size > 0) {
                knownPhases.value = acc;
                // console.log('[StateInfo] 已动态构建 knownPhases, size =', acc.size);
            }
        } else {
            console.log('[StateInfo] 未返回 phases，沿用兜底 KNOWN_PHASES');
        }

        const mermaidCode =
            res.mode === 'runtime' ? res.snapshot?.mermaid : res.mermaid;

        if (mermaidCode) {
            await stateMachine.renderMermaid(mermaidCode);
        } else {
            stateMachine.error.value = '未获取到流程图';
        }

        // ★ 主图高亮：优先用 primaryTopPhase（主图只画顶层 phase），
        //    子阶段 SVT_ASSESSMENT 等会被解析到顶层 SVT_PATH
        let highlightTarget = '';
        if (res.mode === 'runtime') {
            const phaseObj = res.snapshot?.phase || {};
            highlightTarget = phaseObj.primaryTopPhase || phaseObj.primaryPhase || '';

            if (res.snapshot?.history && Array.isArray(res.snapshot.history)) {
                res.snapshot.history.forEach((item: any) => {
                    if (item.from && item.to) {
                        stateMachine.highlightEdge(item.from, item.to);
                    }
                });
            }
        } else {
            highlightTarget = res.initialPhase || '';
        }
        if (highlightTarget) {
            stateMachine.highlightNode(highlightTarget);
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
    const currentSessionId = sessionId.value || sessionIdFromRoute.value;
    if (currentSessionId) {
        await fetchStateInfo(currentSessionId);
        message.success('已刷新状态');
    } else {
        message.warning('没有会话ID，请先创建会话');
    }
};

// ===== Mermaid 节点点击处理 =====
const onMermaidClick = async (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // ★ 优先判断节点（.node）
    const nodeElement = target.closest('.node') as HTMLElement | null;
    if (nodeElement) {
        await handleNodeClick(nodeElement);
        return;
    }

    // ★ 再判断阶段（subgraph 在 DOM 里是 .cluster）
    const clusterElement = target.closest('.cluster') as HTMLElement | null;
    if (clusterElement) {
        await handleClusterClick(clusterElement);
        return;
    }

    console.log('[Mermaid] 点击非节点区域');
};

/**
 * 处理单节点点击：
 *   - 若节点 ID 属于 phase → 打开内部状态机 Modal
 *   - 否则按原逻辑走"进入条件"查询
 */
const handleNodeClick = async (nodeElement: HTMLElement) => {
    const originalState = nodeElement.dataset.state;
    let nodeCode = '';

    if (originalState) {
        nodeCode = originalState;
        console.log('[Mermaid] 从 data-state 获取节点编码:', nodeCode);
    } else {
        const fullId = nodeElement.id;
        let rawId = fullId;
        if (fullId.startsWith('flowchart-')) {
            rawId = fullId.slice('flowchart-'.length);
        }
        nodeCode = rawId.replace(/-\d+$/, '');
        console.log('[Mermaid] 从 id 解析节点编码:', rawId, '-> 清理后:', nodeCode);
    }

    // ★ 优先判断：节点是 phase → 打开内部 state 图
    if (knownPhases.value.has(nodeCode)) {
        console.log('[Mermaid] 节点为 phase，打开内部状态机:', nodeCode);
        await openPhaseModal(nodeCode);
        return;
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

/**
 * ★ 处理阶段（subgraph）点击：打开子状态机 Modal
 */
const handleClusterClick = async (clusterElement: HTMLElement) => {
    const phaseId = parsePhaseId(clusterElement);
    if (!phaseId) {
        message.warning('无法识别该阶段的 ID');
        return;
    }
    console.log('[Mermaid] 点击阶段:', phaseId);
    await openPhaseModal(phaseId);
};

/**
 * 从 cluster 元素解析 phaseId。
 * mermaid 渲染后 id 一般是 flowchart-PHASE_XXX-数字，需要剥掉前后缀。
 */
const parsePhaseId = (clusterElement: HTMLElement): null | string => {
    // 优先用 dataset
    const dsPhase = clusterElement.dataset.phase;
    if (dsPhase) return dsPhase;

    const fullId = clusterElement.id || '';
    let raw = fullId;
    if (raw.startsWith('flowchart-')) {
        raw = raw.slice('flowchart-'.length);
    }
    raw = raw.replace(/-\d+$/, '');

    if (raw.startsWith('PHASE_')) {
        return raw.slice('PHASE_'.length);
    }
    return raw || null;
};

/**
 * ★ 从 mermaid 节点的 id 或 data-state 中提取 state id
 * 形如：flowchart-F_101_CHECK_QRS_WIDTH-12  →  F_101_CHECK_QRS_WIDTH
 */
const extractStateIdFromNode = (el: HTMLElement): string => {
    const ds = el.dataset?.state;
    if (ds) return ds;
    let raw = el.id || '';
    if (raw.startsWith('flowchart-')) {
        raw = raw.slice('flowchart-'.length);
    }
    return raw.replace(/-\d+$/, '');
};

/**
 * ★ 在 Phase Modal 容器里应用高亮
 * @param phaseId 当前 Modal 展示的 phaseId
 *
 * 高亮目标选择：
 *   - 容器 phase（有 children）→ Modal 画的是子 phase 概览，用 primaryPhase 匹配
 *   - 叶子 phase（无 children）→ Modal 画的是 state 图，用 currentState 匹配
 *   - 两个候选都不在该 phase 范围内 → 不高亮
 *
 * 注：因为 mermaid 的 classDef 会往 SVG 元素写内联 style，
 *     普通 CSS 无法稳定覆盖，所以这里用 inline style + important 强刷。
 */
const applyPhaseModalHighlight = (phaseId: string) => {
    if (!phaseModalContainer.value || !phaseId) return;

    // ---------- 1. 清除旧高亮（class + inline style）----------
    phaseModalContainer.value
        .querySelectorAll('.node.phase-modal-current-state')
        .forEach((n) => {
            const el = n as HTMLElement;
            el.classList.remove('phase-modal-current-state');
            el.querySelectorAll(
                'rect, circle, polygon, path, ellipse, text, tspan',
            ).forEach((child) => {
                const c = child as HTMLElement;
                c.style.removeProperty('fill');
                c.style.removeProperty('stroke');
                c.style.removeProperty('stroke-width');
                c.style.removeProperty('font-weight');
                c.style.removeProperty('color');
            });
        });

    // ---------- 2. 找到 phase 定义，收集范围内所有 id ----------
    const phaseDef = findPhaseById(cachedPhases.value, phaseId);
    if (!phaseDef) {
        console.log('[Phase Modal] 未找到 phase 定义:', phaseId);
        return;
    }
    const idsInScope = collectAllIds(phaseDef, new Set());

    const primaryPhase = lastStateInfo.value?.phase?.primaryPhase;
    const currentState = lastStateInfo.value?.currentState;
    const hasChildren =
        Array.isArray(phaseDef.children) && phaseDef.children.length > 0;

    // ---------- 3. 决定候选目标 ----------
    const candidates: string[] = hasChildren
        ? [primaryPhase, currentState]
        : [currentState, primaryPhase];

    // ---------- 4. 匹配节点并强刷 inline style ----------
    const nodes = phaseModalContainer.value.querySelectorAll('.node');
    for (const candidate of candidates) {
        if (!candidate || !idsInScope.has(candidate)) continue;

        let hit: HTMLElement | null = null;
        nodes.forEach((node) => {
            const el = node as HTMLElement;
            if (extractStateIdFromNode(el) === candidate) {
                hit = el;
            }
        });

        if (hit) {
            const hitEl = hit as HTMLElement;
            hitEl.classList.add('phase-modal-current-state');

            // 形状：rect/circle/polygon/path/ellipse 都刷一遍
            hitEl
                .querySelectorAll('rect, circle, polygon, path, ellipse')
                .forEach((child) => {
                    const c = child as HTMLElement;
                    c.style.setProperty('fill', '#52c41a', 'important');
                    c.style.setProperty('stroke', '#237804', 'important');
                    c.style.setProperty('stroke-width', '2.5px', 'important');
                });

            // 文本：text/tspan 都刷一遍
            hitEl.querySelectorAll('text, tspan').forEach((child) => {
                const c = child as HTMLElement;
                c.style.setProperty('fill', '#fff', 'important');
                c.style.setProperty('font-weight', 'bold', 'important');
            });

            console.log(
                `[Phase Modal] 高亮命中: phase=${phaseId}, target=${candidate}`,
            );
            setTimeout(() => {
                hitEl.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }, 50);
            return;
        }
    }
    console.log(
        `[Phase Modal] 未命中高亮: phase=${phaseId}, primaryPhase=${primaryPhase}, currentState=${currentState}`,
    );
};

/**
 * 打开 Phase 子状态机 Modal
 */
const openPhaseModal = async (phaseId: string) => {
    phaseModalPhaseId.value = phaseId; // ★ 记住当前 phaseId
    phaseModalTitle.value = `📦 阶段 [${phaseId}] 内部状态机`;
    phaseModalVisible.value = true;
    phaseModalLoading.value = true;

    try {
        const currentSessionId = sessionId.value || sessionIdFromRoute.value;
        // ★ caseType 兜底：表单 → props.id（传入的 caseId）→ phaseId
        const caseType = setupForm.value.scenarioId || props.id || phaseId;

        const params: Record<string, string> = { phaseId };
        if (currentSessionId) {
            params.sessionId = currentSessionId;
        } else {
            params.caseType = caseType;
        }

        console.log('[Phase Modal] 请求参数:', JSON.stringify(params));
        const result = await request.get('/ems/session/phase/subgraph', {
            params,
        });
        console.log('[Phase Modal] 完整响应:', JSON.stringify(result));

        const mermaidCode = result.data?.mermaid || result.data || '';

        if (!mermaidCode) {
            message.warning(`阶段 [${phaseId}] 没有内部状态机`);
            closePhaseModal();
            return;
        }

        phaseModalLoading.value = false;
        await nextTick();
        await renderPhaseMermaid(mermaidCode, phaseId); // ★ 传入 phaseId
    } catch (error: any) {
        console.error('[Phase Modal] 加载失败:', error);
        message.error(`加载子状态机失败：${error?.message || '未知错误'}`);
        closePhaseModal();
    }
};

/**
 * 在 Modal 容器里渲染 mermaid
 */
const renderPhaseMermaid = async (code: string, phaseId?: string) => {
    if (!phaseModalContainer.value) return;
    try {
        // 每次渲染用唯一 id，避免 mermaid 内部冲突
        const id = `phase-modal-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const { svg } = await mermaid.render(id, code);
        phaseModalContainer.value.innerHTML = svg;

        // ★ 渲染完成后应用高亮（传 phaseId，由函数内部决定目标）
        await nextTick();
        if (phaseId) {
            applyPhaseModalHighlight(phaseId);
        }
    } catch (error: any) {
        console.error('[Phase Modal] 渲染失败:', error);
        if (phaseModalContainer.value) {
            phaseModalContainer.value.innerHTML = `<div style="color:#dc3545;padding:16px;">渲染失败: ${error?.message || '未知错误'
                }</div>`;
        }
    }
};

/**
 * 关闭 Phase Modal
 */
const closePhaseModal = () => {
    phaseModalVisible.value = false;
    phaseModalLoading.value = false;
    phaseModalTitle.value = '';
    phaseModalPhaseId.value = '';
    if (phaseModalContainer.value) {
        phaseModalContainer.value.innerHTML = '';
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
    // ★ 优先用传入的 caseId（props.id），其次场景列表第一项，最后留空
    setupForm.value.scenarioId = props.id || scenarios.value[0]?.id || '';
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

    console.log(intentItem.standard_script);
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

        // ★ 更新缓存的 currentState
        if (lastStateInfo.value && to) {
            lastStateInfo.value = { ...lastStateInfo.value, currentState: to };
        }

        // ★ 如果 Modal 打开，用它自己的 phaseId 重新应用高亮
        if (phaseModalVisible.value && phaseModalPhaseId.value) {
            applyPhaseModalHighlight(phaseModalPhaseId.value);
        }

        // ★ 主图节点是 phase id，state id 高亮不上，不再调 highlightNode
        //   主图高亮由 fetchStateInfo 驱动（用户点「刷新状态」或切 Tab 时）
        if (from && to) {
            stateMachine.highlightEdge(from, to);
        }

        transcriptItems.value.push({
            text: `📍 状态转移: ${from || '?'} → ${to || '?'} (事件: ${event || '无'
                })`,
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
        console.log('[mount] props.id =', props.id);

        const initialCaseId = props.id;

        if (initialCaseId) {
            console.log('初始场景ID:', initialCaseId);
            setupForm.value.scenarioId = initialCaseId;

            const currentSessionId =
                props.sessionId || sessionId.value || sessionIdFromRoute.value;
            await (currentSessionId
                ? fetchStateInfo(currentSessionId)
                : fetchStateInfo(undefined, initialCaseId));
        }
    } catch (error) {
        console.error('加载场景失败', error);
        message.error('加载场景列表失败');
    }

    // 2. 预填 roomSessionId（如果 URL 带参数）
    //    注意：这一步要在 loadRooms() 之前，loadRooms 里会检测"已有 joinRoomId 就不覆盖"
    const urlRoomSid = route.query.roomSessionId as string;
    if (urlRoomSid) {
        joinRoomId.value = urlRoomSid;
    }

    // 3. 拉取房间列表（下拉框数据源）
    await loadRooms();

    // 4. 注册 WebSocket 监听
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
    // ★ 断开房间 WebSocket
    disposeRoom();
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

                <!-- ★ 加入现有房间（作为 Speaker） -->
                <div class="setup-card" style="margin-bottom: 16px">
                    <div class="card-title">🔗 加入现有房间（Speaker）</div>
                    <div style="font-size: 12px; color: #888; margin-bottom: 12px">
                        选择一个由 Engine（Unity）创建的活跃房间，以 speaker 身份加入， 让
                        Engine 的 start_case_request 可以通过。
                    </div>

                    <div class="form-item">
                        <label class="form-label">
                            房间列表
                            <button class="btn-link" style="font-size: 12px; margin-left: 8px"
                                :disabled="isLoadingRooms || roomJoined" @click="loadRooms()">
                                {{ isLoadingRooms ? '刷新中...' : '🔄 刷新' }}
                            </button>
                        </label>
                        <select v-model="joinRoomId" class="form-select"
                            :disabled="isJoining || roomJoined || isLoadingRooms">
                            <option value="" disabled>
                                {{
                                    isLoadingRooms
                                        ? '加载中...'
                                        : rooms.length === 0
                                            ? '（暂无可用房间）'
                                : '-- 请选择房间 --'
                                }}
                            </option>
                            <option v-for="r in rooms" :key="r.sessionId" :value="r.sessionId">
                                {{ r.sessionId }} | {{ r.caseId }} | {{ r.state }} |
                                {{ r.clientCount }}人 | {{ (r.roles || []).join(',') }}
                            </option>
                        </select>
                    </div>

                    <div class="form-actions">
                        <button v-if="!roomJoined" class="btn-primary" :disabled="!joinRoomId || isJoining"
                            @click="handleJoinRoom">
                            {{ isJoining ? '加入中...' : '🚪 加入房间' }}
                        </button>
                        <button v-else class="btn-danger" @click="handleLeaveRoom">
                            离开房间
                        </button>
                        <span v-if="roomJoined" class="custom-tag" :class="roomWsConnected ? 'tag-green' : 'tag-red'"
                            style="margin-left: 8px; align-self: center">
                            ● {{ roomWsConnected ? '已连接' : '未连接' }}
                        </span>
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

        <!-- ★ Phase 子状态机 Modal -->
        <div v-if="phaseModalVisible" class="phase-modal-overlay" @click.self="closePhaseModal">
            <div class="phase-modal">
                <div class="phase-modal-header">
                    <span class="phase-modal-title">{{ phaseModalTitle }}</span>
                    <button class="phase-modal-close" @click="closePhaseModal">×</button>
                </div>
                <div class="phase-modal-body">
                    <div v-if="phaseModalLoading" class="phase-modal-loading">
                        加载中...
                    </div>
                    <div v-else ref="phaseModalContainer" class="phase-modal-mermaid"></div>
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

.card-title {
    font-weight: 600;
    font-size: 16px;
    margin-bottom: 12px;
    color: #333;
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
    align-items: center;
    flex-wrap: wrap;
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

/* ===== Phase 子状态机 Modal ===== */
.phase-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
    animation: phaseModalFadeIn 0.15s ease-out;
}

@keyframes phaseModalFadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

.phase-modal {
    width: 80vw;
    height: 80vh;
    max-width: 1200px;
    background: #fff;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    overflow: hidden;
}

.phase-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    border-bottom: 1px solid #f0f0f0;
    background: #fafafa;

    .phase-modal-title {
        font-size: 16px;
        font-weight: 600;
        color: #333;
    }

    .phase-modal-close {
        font-size: 24px;
        line-height: 1;
        color: #999;
        cursor: pointer;
        padding: 0;
        background: transparent;
        border: none;

        &:hover {
            color: #333;
        }
    }
}

.phase-modal-body {
    flex: 1;
    overflow: auto;
    padding: 16px;
    position: relative;

    .phase-modal-loading {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        color: #666;
        font-size: 15px;
    }

    .phase-modal-mermaid {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: flex-start;

        svg {
            display: block;
            max-width: 100%;
            height: auto;
        }

        /* ★ 当前 state 高亮（绿色系，与主图 highlightNode 风格一致） */
        :deep(.node.phase-modal-current-state) {

            rect,
            circle,
            polygon,
            path {
                fill: #52c41a !important;
                stroke: #237804 !important;
                stroke-width: 2.5px !important;
            }

            .label text,
            text {
                fill: #fff !important;
                font-weight: bold;
            }
        }
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
