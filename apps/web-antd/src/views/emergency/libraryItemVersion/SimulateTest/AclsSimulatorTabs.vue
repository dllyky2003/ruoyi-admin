<!-- AclsSimulatorTabs.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';

import { ClockCircleOutlined } from '@ant-design/icons-vue';
import {
    Badge,
    Button,
    Card,
    Col,
    Divider,
    Row,
    Space,
    Statistic,
    Steps,
    Tabs,
    Tag,
    Timeline,
} from 'ant-design-vue';

// ============ 状态机定义 ============
const stateList = [
    { key: 'INITIAL_ASSESSMENT', label: '初始评估' },
    { key: 'ASSESS_STABILITY', label: '稳定性评估' },
    { key: 'CHECK_QRS_WIDTH', label: 'QRS判读' },
    { key: 'NARROW_QRS_CHECK_RHYTHM', label: '节律规则性' },
    { key: 'DO_VAGAL_MANEUVER', label: '迷走刺激' },
    { key: 'ASSESS_VAGAL_EFFECT', label: '评估迷走效果' },
    { key: 'DO_ADENOSINE_6MG', label: '腺苷6mg' },
    { key: 'ASSESS_6MG_EFFECT', label: '评估6mg' },
    { key: 'DO_ADENOSINE_12MG', label: '腺苷12mg' },
    { key: 'ASSESS_12MG_EFFECT', label: '评估12mg' },
    { key: 'DO_SECOND_LINE_DRUG', label: '二线药物' },
    { key: 'ASSESS_SECOND_EFFECT', label: '评估二线' },
    { key: 'EXPERT_CONSULTATION', label: '专家会诊' },
    { key: 'UNSTABLE_CARDIOVERSION', label: '紧急电复律' },
    { key: 'MONITOR_SINUS_RHYTHM', label: '监护窦性' },
    { key: 'WIDE_QRS_ALGORITHM', label: '宽QRS算法' },
    { key: 'IRREGULAR_RHYTHM_ALGORITHM', label: '不规则算法' },
    { key: 'ERROR_HANDLING', label: '错误处理' },
    { key: 'TIMEOUT_HANDLING', label: '延时处理' },
    { key: 'TERMINAL_END', label: '终止' },
];

const currentState = ref('ASSESS_STABILITY');
const patient = reactive({
    hr: 155,
    bpSystolic: 108,
    bpDiastolic: 70,
    spo2: 98,
    isStable: true,
});
const timer = ref(0);
let timerInterval: null | number = null;

interface LogEntry {
    time: string;
    message: string;
    type: 'error' | 'info' | 'success' | 'warning';
    intentCode?: string;
}
const logs = ref<LogEntry[]>([]);

const score = reactive({
    correct: 0,
    wrong: 0,
    fatalErrors: 0,
});

// ============ 标准话术按钮配置 ============
interface CommandButton {
    id: string;
    group: 'diagnosis' | 'emergency' | 'team' | 'treatment';
    label: string;
    intentCode: string;
    type: 'correct' | 'fatal' | 'trap';
    params?: Record<string, any>;
    allowedStates: string[];
    advances: boolean;
}

const commandButtons: CommandButton[] = [
    // ---- 诊断评估（S1） ----
    {
        id: 's1-1-1',
        group: 'diagnosis',
        label: '看一下心电图，QRS波群宽度是多少？',
        intentCode: 'S1-1',
        type: 'correct',
        allowedStates: ['ASSESS_STABILITY', 'CHECK_QRS_WIDTH'],
        advances: true,
        params: { qrsWidth: 'narrow' },
    },
    {
        id: 's1-1-2',
        group: 'diagnosis',
        label: 'QRS波群超过0.12秒了，是宽QRS。',
        intentCode: 'S1-1',
        type: 'trap',
        allowedStates: ['CHECK_QRS_WIDTH'],
        advances: true,
        params: { qrsWidth: 'wide' },
    },
    {
        id: 's1-2-1',
        group: 'diagnosis',
        label: 'R-R间期整齐吗？心律规不规则？',
        intentCode: 'S1-2',
        type: 'correct',
        allowedStates: ['NARROW_QRS_CHECK_RHYTHM'],
        advances: true,
        params: { rhythmRegular: true },
    },
    {
        id: 's1-2-2',
        group: 'diagnosis',
        label: '心律绝对不齐，看起来像房颤。',
        intentCode: 'S1-2',
        type: 'trap',
        allowedStates: ['NARROW_QRS_CHECK_RHYTHM'],
        advances: true,
        params: { rhythmRegular: false },
    },
    {
        id: 's1-3-1',
        group: 'diagnosis',
        label: '患者目前血流动力学稳定，没有低血压和意识改变。',
        intentCode: 'S1-3',
        type: 'correct',
        allowedStates: ['INITIAL_ASSESSMENT', 'ASSESS_STABILITY'],
        advances: true,
        params: { isUnstable: false },
    },
    {
        id: 's1-3-2',
        group: 'diagnosis',
        label: '血压掉到85了，患者意识不清，不稳定了！',
        intentCode: 'S1-3',
        type: 'fatal',
        allowedStates: [
            'ASSESS_STABILITY',
            'DO_VAGAL_MANEUVER',
            'DO_ADENOSINE_6MG',
        ],
        advances: true,
        params: { isUnstable: true },
    },

    // ---- 阶梯治疗（S2） ----
    {
        id: 's2-1-1',
        group: 'treatment',
        label: '让患者做Valsalva动作，屏气用力。',
        intentCode: 'S2-1',
        type: 'correct',
        allowedStates: ['DO_VAGAL_MANEUVER'],
        advances: true,
        params: { actionStatus: 'done' },
    },
    {
        id: 's2-2-1',
        group: 'treatment',
        label: '推注腺苷6毫克，快速静脉推注。',
        intentCode: 'S2-2',
        type: 'correct',
        allowedStates: ['DO_ADENOSINE_6MG'],
        advances: true,
        params: { dose: '6mg', dose_sequence: 'first', actionStatus: 'done' },
    },
    {
        id: 's2-2-2',
        group: 'treatment',
        label: '直接推腺苷12毫克吧。',
        intentCode: 'S2-2',
        type: 'trap',
        allowedStates: ['DO_ADENOSINE_6MG', 'DO_ADENOSINE_12MG'],
        advances: true,
        params: { dose: '12mg', dose_sequence: 'second', actionStatus: 'done' },
    },
    {
        id: 's2-4-1',
        group: 'treatment',
        label: '推完腺苷马上用20毫升生理盐水快速冲管。',
        intentCode: 'S2-4',
        type: 'correct',
        allowedStates: ['DO_ADENOSINE_6MG', 'DO_ADENOSINE_12MG'],
        advances: true,
        params: { actionStatus: 'done' },
    },
    {
        id: 's2-5a-1',
        group: 'treatment',
        label: '静推美托洛尔5毫克控制心率。',
        intentCode: 'S2-5a',
        type: 'correct',
        allowedStates: ['DO_SECOND_LINE_DRUG'],
        advances: true,
        params: { drug: 'metoprolol', dose: '5mg', actionStatus: 'done' },
    },
    {
        id: 's2-5a-2',
        group: 'treatment',
        label: '用地尔硫卓0.25毫克每公斤静注。',
        intentCode: 'S2-5a',
        type: 'trap',
        allowedStates: ['DO_SECOND_LINE_DRUG'],
        advances: true,
        params: { drug: 'diltiazem', dose: '0.25mg/kg', actionStatus: 'done' },
    },

    // ---- 团队与安全（G1/G2） ----
    {
        id: 'g1-1-1',
        group: 'team',
        label: '大家手离开床，准备放电！',
        intentCode: 'G1-1',
        type: 'correct',
        allowedStates: ['UNSTABLE_CARDIOVERSION'],
        advances: true,
        params: {},
    },
    {
        id: 'g2-1-1',
        group: 'team',
        label: '李护士，你来负责胸外按压。',
        intentCode: 'G2-1',
        type: 'correct',
        allowedStates: stateList.map((s) => s.key),
        advances: false,
        params: { person: '李护士', duty: 'compressor' },
    },
    {
        id: 'g2-3-1',
        group: 'team',
        label: '记录时间，现在是14点22分。',
        intentCode: 'G2-3',
        type: 'correct',
        allowedStates: stateList.map((s) => s.key),
        advances: false,
        params: { time: '14:22' },
    },

    // ---- 紧急干预（S3/S4） ----
    {
        id: 's3-2-1',
        group: 'emergency',
        label: '马上同步电复律，100焦耳！',
        intentCode: 'S3-2',
        type: 'correct',
        allowedStates: ['UNSTABLE_CARDIOVERSION'],
        advances: true,
        params: { actionStatus: 'start' },
    },
    {
        id: 's4-4-1',
        group: 'emergency',
        label: '快！开始胸外按压！',
        intentCode: 'S4-4',
        type: 'fatal',
        allowedStates: stateList
            .filter((s) => s.key !== 'TERMINAL_END')
            .map((s) => s.key),
        advances: false,
        params: { forbiddenAction: 'cpr' },
    },
    {
        id: 's4-2-1',
        group: 'emergency',
        label: '别管同步了，直接非同步除颤！',
        intentCode: 'S4-2',
        type: 'fatal',
        allowedStates: stateList
            .filter((s) => s.key !== 'TERMINAL_END')
            .map((s) => s.key),
        advances: false,
        params: { energy: '200J' },
    },
];

// ============ 计算属性 ============
const currentStepIndex = computed(() => {
    const idx = stateList.findIndex((s) => s.key === currentState.value);
    return Math.max(idx, 0);
});

const groupedButtons = computed(() => {
    const groups = ['diagnosis', 'treatment', 'team', 'emergency'] as const;
    const groupLabels = {
        diagnosis: '🔍 诊断评估 (S1)',
        treatment: '💊 阶梯治疗 (S2)',
        team: '👥 团队与安全 (G1/G2)',
        emergency: '🚨 紧急干预 (S3/S4)',
    };
    return groups.map((g) => ({
        key: g,
        label: groupLabels[g],
        buttons: commandButtons.filter((b) => b.group === g),
    }));
});

function isButtonEnabled(button: CommandButton): boolean {
    return button.allowedStates.includes(currentState.value);
}

// ============ 核心方法 ============
function addLog(
    message: string,
    type: LogEntry['type'] = 'info',
    intentCode?: string,
) {
    const now = new Date();
    const time = now.toTimeString().slice(0, 8);
    logs.value.unshift({ time, message, type, intentCode });
    if (logs.value.length > 100) logs.value.pop();
}

function handleCommand(button: CommandButton) {
    if (!isButtonEnabled(button)) {
        addLog(`⛔ 当前状态不允许此指令: ${button.label}`, 'warning');
        return;
    }

    const isFatal = button.type === 'fatal';
    const isTrap = button.type === 'trap';
    const logType = isFatal ? 'error' : (isTrap ? 'warning' : 'success');
    addLog(
        `📢 ${button.label}  (${button.intentCode})`,
        logType,
        button.intentCode,
    );

    if (isFatal) {
        score.fatalErrors += 1;
        addLog(`🚫 红线错误！触发 ${button.intentCode}，流程已冻结`, 'error');
        return;
    } else if (isTrap) {
        score.wrong += 1;
        addLog(`⚠️ 陷阱操作（非致命错误）`, 'warning');
    } else {
        score.correct += 1;
    }

    if (button.advances) {
        let nextState = currentState.value;
        if (button.intentCode === 'S1-1' && button.params?.qrsWidth === 'narrow') {
            nextState = 'NARROW_QRS_CHECK_RHYTHM';
        } else if (
            button.intentCode === 'S1-1' &&
            button.params?.qrsWidth === 'wide'
        ) {
            nextState = 'WIDE_QRS_ALGORITHM';
        } else if (
            button.intentCode === 'S1-2' &&
            button.params?.rhythmRegular === true
        ) {
            nextState = 'DO_VAGAL_MANEUVER';
        } else if (
            button.intentCode === 'S1-2' &&
            button.params?.rhythmRegular === false
        ) {
            nextState = 'IRREGULAR_RHYTHM_ALGORITHM';
        } else if (
            button.intentCode === 'S1-3' &&
            button.params?.isUnstable === false
        ) {
            nextState = 'CHECK_QRS_WIDTH';
        } else if (
            button.intentCode === 'S1-3' &&
            button.params?.isUnstable === true
        ) {
            nextState = 'UNSTABLE_CARDIOVERSION';
        } else if (button.intentCode === 'S2-1') {
            nextState = 'ASSESS_VAGAL_EFFECT';
        } else if (button.intentCode === 'S2-2' && button.params?.dose === '6mg') {
            nextState = 'ASSESS_6MG_EFFECT';
        } else if (button.intentCode === 'S2-2' && button.params?.dose === '12mg') {
            nextState = 'ASSESS_12MG_EFFECT';
        } else
            switch (button.intentCode) {
                case 'G1-1': {
                    addLog('✅ 清场完成，可以放电', 'success');

                    break;
                }
                case 'S2-4': {
                    addLog('✅ 冲管完成，等待评估', 'success');

                    break;
                }
                case 'S2-5a': {
                    nextState = 'ASSESS_SECOND_EFFECT';

                    break;
                }
                case 'S3-2': {
                    nextState = 'MONITOR_SINUS_RHYTHM';

                    break;
                }
                // No default
            }
        if (nextState !== currentState.value) {
            currentState.value = nextState;
            addLog(
                `🔄 状态转换至: ${stateList.find((s) => s.key === nextState)?.label || nextState}`,
                'info',
            );
        }
    } else {
        addLog(`ℹ️ 已记录指令，状态不变`, 'info');
    }

    // 模拟体征微变
    if (patient.hr > 80) patient.hr -= Math.floor(Math.random() * 5);
    if (patient.bpSystolic > 90)
        patient.bpSystolic += Math.floor(Math.random() * 3) - 1;
}

function resetSimulation() {
    currentState.value = 'ASSESS_STABILITY';
    patient.hr = 155;
    patient.bpSystolic = 108;
    patient.bpDiastolic = 70;
    patient.spo2 = 98;
    patient.isStable = true;
    logs.value = [];
    score.correct = 0;
    score.wrong = 0;
    score.fatalErrors = 0;
    timer.value = 0;
    addLog('🔄 案例已重置', 'info');
}

function jumpToState(stateKey: string) {
    if (stateList.some((s) => s.key === stateKey)) {
        currentState.value = stateKey;
        addLog(`⏩ 强制跳转至 ${stateKey}`, 'warning');
    }
}

onMounted(() => {
    timerInterval = window.setInterval(() => {
        timer.value += 1;
    }, 1000);
    addLog('✅ 系统就绪，请使用标准话术下达指令', 'success');
});

onUnmounted(() => {
    if (timerInterval) clearInterval(timerInterval);
});

function getStateColor(key: string) {
    if (key === currentState.value) return 'processing';
    const idx = stateList.findIndex((s) => s.key === key);
    if (idx < currentStepIndex.value) return 'finish';
    return 'wait';
}
</script>

<template>
    <div class="simulator-page">
        <!-- 顶部状态栏（固定） -->
        <div class="header">
            <Row :gutter="16" align="middle">
                <Col :span="4">
                    <Badge status="success" text="运行中" />
                    <span style="font-weight: bold; margin-left: 8px">窄QRS稳定心动过速</span>
                </Col>
                <Col :span="12">
                    <Space size="large">
                        <Statistic title="心率" :value="patient.hr" suffix="bpm" />
                        <Statistic title="血压" :value="`${patient.bpSystolic}/${patient.bpDiastolic}`" suffix="mmHg" />
                        <Statistic title="SpO2" :value="patient.spo2" suffix="%" />
                        <Tag :color="patient.isStable ? 'green' : 'red'">
                            {{ patient.isStable ? '稳定' : '不稳定' }}
                        </Tag>
                    </Space>
                </Col>
                <Col :span="4">
                    <Tag :color="getStateColor(currentState) === 'processing' ? 'blue' : 'default'
                        ">
                        {{
                            stateList.find((s) => s.key === currentState)?.label ||
                        currentState
                        }}
                    </Tag>
                </Col>
                <Col :span="4">
                    <Space>
                        <ClockCircleOutlined />
                        <span>{{ Math.floor(timer / 60) }}:{{
                            (timer % 60).toString().padStart(2, '0')
                            }}</span>
                        <Button size="small" @click="resetSimulation">重置</Button>
                    </Space>
                </Col>
            </Row>
        </div>

        <!-- 标签页主体 -->
        <div class="tab-content">
            <Tabs default-active-key="panel" size="large" tab-position="top">
                <!-- 标签页1：指令面板 -->
                <Tabs.TabPane key="panel" tab="🎙️ 话术指令面板">
                    <div class="panel-wrapper">
                        <Row :gutter="[16, 16]">
                            <Col v-for="group in groupedButtons" :key="group.key" :span="12">
                                <Card :title="group.label" :bordered="false" size="small" class="button-group">
                                    <template #extra>
                                        <Tag :color="group.key === 'diagnosis'
                                                ? 'blue'
                                                : group.key === 'treatment'
                                                    ? 'green'
                                                    : group.key === 'team'
                                                        ? 'orange'
                                                        : 'red'
                                            ">
                                            {{
                                                group.buttons.filter((b) => isButtonEnabled(b)).length
                                            }}
                                            / {{ group.buttons.length }}
                                        </Tag>
                                    </template>
                                    <Space wrap>
                                        <Button v-for="btn in group.buttons" :key="btn.id"
                                            :type="btn.type === 'fatal' ? 'primary' : 'default'"
                                            :danger="btn.type === 'fatal'" :disabled="!isButtonEnabled(btn)" :class="{
                                                'correct-btn': btn.type === 'correct',
                                                'trap-btn': btn.type === 'trap',
                                                'fatal-btn': btn.type === 'fatal',
                                            }" @click="handleCommand(btn)">
                                            {{ btn.label }}
                                        </Button>
                                    </Space>
                                </Card>
                            </Col>
                        </Row>
                    </div>
                </Tabs.TabPane>

                <!-- 标签页2：流程日志与计分 -->
                <Tabs.TabPane key="logs" tab="📋 流程日志 & 计分">
                    <Row :gutter="16">
                        <Col :span="12">
                            <Card title="流程进度" :bordered="false" size="small">
                                <Steps direction="vertical" :current="currentStepIndex" size="small">
                                    <Steps.Step v-for="(s, idx) in stateList" :key="s.key" :title="s.label" :status="idx < currentStepIndex
                                            ? 'finish'
                                            : idx === currentStepIndex
                                                ? 'process'
                                                : 'wait'
                                        " />
                                </Steps>
                            </Card>
                        </Col>
                        <Col :span="12">
                            <Card title="实时日志" :bordered="false" size="small"
                                style="max-height: 500px; overflow-y: auto">
                                <Timeline mode="left" pending>
                                    <Timeline.Item v-for="(log, idx) in logs" :key="idx" :color="log.type === 'error'
                                            ? 'red'
                                            : log.type === 'warning'
                                                ? 'orange'
                                                : log.type === 'success'
                                                    ? 'green'
                                                    : 'blue'
                                        ">
                                        <span style="font-size: 12px; color: #999">{{
                                            log.time
                                            }}</span>
                                        <div>{{ log.message }}</div>
                                    </Timeline.Item>
                                </Timeline>
                            </Card>
                            <Card title="考核计分" :bordered="false" size="small" style="margin-top: 12px">
                                <Row :gutter="16">
                                    <Col :span="8">
                                        <Statistic title="正确" :value="score.correct"
                                            :value-style="{ color: '#3f8600' }" />
                                    </Col>
                                    <Col :span="8">
                                        <Statistic title="错误" :value="score.wrong"
                                            :value-style="{ color: '#cf1322' }" />
                                    </Col>
                                    <Col :span="8">
                                        <Statistic title="红线" :value="score.fatalErrors"
                                            :value-style="{ color: '#fa541c' }" />
                                    </Col>
                                </Row>
                                <Divider />
                                <Space>
                                    <Button @click="resetSimulation">重置案例</Button>
                                    <Button @click="jumpToState('MONITOR_SINUS_RHYTHM')">
                                        跳至成功
                                    </Button>
                                    <Button @click="jumpToState('ERROR_HANDLING')">
                                        触发错误
                                    </Button>
                                </Space>
                            </Card>
                        </Col>
                    </Row>
                </Tabs.TabPane>
            </Tabs>
        </div>
    </div>
</template>

<style scoped>
.simulator-page {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #f0f2f5;
}

.header {
    background: #fff;
    padding: 12px 24px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    z-index: 1;
    flex-shrink: 0;
}

.tab-content {
    flex: 1;
    padding: 16px 24px;
    overflow: hidden;
}

.panel-wrapper {
    height: 100%;
    overflow-y: auto;
}

.button-group {
    height: 100%;
}

.correct-btn {
    background-color: #b7eb8f;
    border-color: #52c41a;
}

.trap-btn {
    background-color: #ffe58f;
    border-color: #faad14;
}

.fatal-btn {
    background-color: #ffccc7;
    border-color: #ff4d4f;
}
</style>
