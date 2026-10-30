<script setup lang="ts">
import type {
    ContractData,
    ContractNode,
    ContractTransition,
} from '#/api/ems/types';

import { computed, ref } from 'vue';

import { message, Modal } from 'ant-design-vue';

const props = defineProps<{
    caseId: string;
    contract: ContractData | null;
    stateId: null | string;
    transitionId: null | string;
}>();

const emit = defineEmits<{
    (e: 'selectState', id: string): void;
    (e: 'selectTransition', id: string): void;
}>();

// ==================== 选中数据 ====================
const stateContract = computed<ContractNode | null>(() => {
    if (!props.stateId || !props.contract) return null;
    return props.contract.states[props.stateId] || null;
});

const transitionContract = computed<ContractTransition | null>(() => {
    if (!props.transitionId || !props.contract) return null;
    return props.contract.transitions[props.transitionId] || null;
});

const incomingEdges = computed<ContractTransition[]>(() => {
    if (!stateContract.value || !props.contract) return [];
    const sid = stateContract.value.stateId;
    return Object.values(props.contract.transitions).filter(
        (t) => t.targetState === sid,
    );
});

// ==================== 中文名查询 ====================
function getIntentNameCn(intentCode: string): string {
    if (!intentCode || !props.contract?.intents) return '';
    const it = props.contract.intents[intentCode] as any;
    if (!it) return '';
    return (
        it.nameCn || it.name_cn || it.intentName || it.name || it.description || ''
    );
}

function getVariableNameCn(varName: string): string {
    if (!varName || !props.contract?.variables) return '';
    const vars = props.contract.variables as any;
    const pick = (o: any) =>
        o ? o.nameCn || o.name_cn || o.name || o.description || '' : '';

    const direct = pick(vars[varName]);
    if (direct) return direct;

    const parts = varName.split('.');
    for (let i = parts.length - 1; i > 0; i--) {
        const prefix = parts.slice(0, i).join('.');
        const cn = pick(vars[prefix]);
        if (cn) return cn;
    }
    return '';
}

function getStateNameCn(stateId: string): string {
    if (!stateId || !props.contract?.states) return '';
    const st = props.contract.states[stateId] as any;
    if (!st) return '';
    const desc = st.stateDescription || st.description || st.nameCn || '';
    return desc
        .replace(
            /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\s]+/u,
            '',
        )
        .trim();
}

// ==================== 工具 ====================
async function copyToClipboard(text: string, label = '内容') {
    try {
        await navigator.clipboard.writeText(text);
        message.success(`已复制${label}`);
    } catch {
        message.warning('复制失败');
    }
}

function openInVSCode() {
    const file = `config/acls/cases/${props.caseId}/_flow.yaml`;
    Modal.info({
        title: '源文件位置',
        content: `请在 VSCode 中打开：\n${file}`,
        okText: '知道了',
    });
}

function triggerType(t: ContractTransition) {
    if (t.intentCode) return { label: '意图', color: 'intent' };
    if (t.event) return { label: '事件', color: 'event' };
    if (t.systemTrigger) return { label: '定时', color: 'timer' };
    return { label: '条件驱动', color: 'info' };
}

function setToArray(s: any): string[] {
    if (!s) return [];
    if (Array.isArray(s)) return s;
    if (s instanceof Set) return [...s];
    return [];
}

// ==================== 变量详情弹窗 ====================
type WriterKind = 'skill' | 'state-effect' | 'state-exit';

interface TransitionAnalysis {
    transitionId: string;
    sourceState: string;
    targetState: string;
    sourceCn: string;
    targetCn: string;
    intents: Array<{ cn: string; code: string }>;
    skills: string[];
    guardExpression: null | string;
    priority: number;
    writerKind: WriterKind;
    exitReason?: null | string;
    effectValue?: any;
}

interface VariableDetail {
    varName: string;
    nameCn: string;
    readBy: TransitionAnalysis[];
    writtenBy: TransitionAnalysis[];
    relatedIntents: Array<{ cn: string; code: string }>;
    relatedSkills: string[];
}

const variableDetailOpen = ref(false);
const variableDetail = ref<null | VariableDetail>(null);

/** 前缀匹配：intervention.epinephrine.count 也匹配 intervention.epinephrine */
function matchVar(v: string, target: string): boolean {
    if (!v || !target) return false;
    return (
        v === target || v.startsWith(`${target}.`) || target.startsWith(`${v}.`)
    );
}

function showVariableDetail(varName: string) {
    if (!props.contract) return;

    const readBy: TransitionAnalysis[] = [];
    const writtenBy: TransitionAnalysis[] = [];
    const intentSet = new Map<string, string>();
    const skillSet = new Set<string>();

    for (const t of Object.values(props.contract.transitions)) {
        const reads = setToArray(t.readVariables).filter((v) =>
            matchVar(v, varName),
        );
        const writes = setToArray(t.writtenVariables).filter((v) =>
            matchVar(v, varName),
        );

        if (reads.length === 0 && writes.length === 0) continue;

        const intents = setToArray(t.triggeringIntents).map((i) => {
            const cn = getIntentNameCn(i);
            intentSet.set(i, cn);
            return { code: i, cn };
        });
        const skills = setToArray(t.skills);
        skills.forEach((s) => skillSet.add(s));

        // 判定写入类型
        const effects = (t as any).effects || [];
        const matchedEffect = effects.find((e: any) => matchVar(e.var, varName));
        const exitReason = (t as any).exitReason;
        const isExitWrite = exitReason && varName === 'process.returnToParent';
        const isEffectWrite = !!matchedEffect;
        const hasSkills = skills.length > 0;

        let writerKind: WriterKind = 'skill';
        if (isEffectWrite) writerKind = 'state-effect';
        else if (isExitWrite) writerKind = 'state-exit';
        else if (!hasSkills) writerKind = 'state-effect';

        const analysis: TransitionAnalysis = {
            transitionId: t.transitionId,
            sourceState: t.sourceState,
            targetState: t.targetState,
            sourceCn: getStateNameCn(t.sourceState),
            targetCn: getStateNameCn(t.targetState),
            intents,
            skills,
            guardExpression: t.guardExpression,
            priority: (t as any).priority || 0,
            writerKind,
            exitReason: exitReason || null,
            effectValue: matchedEffect?.value,
        };

        if (reads.length > 0) readBy.push(analysis);
        if (writes.length > 0) writtenBy.push(analysis);
    }

    variableDetail.value = {
        varName,
        nameCn: getVariableNameCn(varName),
        readBy,
        writtenBy,
        relatedIntents: [...intentSet.entries()].map(([code, cn]) => ({
            code,
            cn,
        })),
        relatedSkills: [...skillSet],
    };
    variableDetailOpen.value = true;
}

function jumpToState(sid: string) {
    variableDetailOpen.value = false;
    emit('selectState', sid);
}

function jumpToTransition(tid: string) {
    variableDetailOpen.value = false;
    emit('selectTransition', tid);
}

/** 按 writerKind 过滤 */
function filterWritten(kind: WriterKind): TransitionAnalysis[] {
    if (!variableDetail.value) return [];
    return variableDetail.value.writtenBy.filter((t) => t.writerKind === kind);
}
</script>

<template>
    <aside class="inspector">
        <!-- ==================== 空状态 ==================== -->
        <div v-if="!stateContract && !transitionContract" class="empty">
            <div class="icon">◇</div>
            <div class="t">未选择</div>
            <div class="h">点击中央图节点<br />查看契约详情</div>
        </div>

        <!-- ==================== 状态详情 ==================== -->
        <div v-else-if="stateContract" class="body">
            <header class="head">
                <div class="head-meta">
                    <span class="kind kind-state">状态</span>
                    <span class="sid" @click="copyToClipboard(stateContract.stateId, '状态ID')">
                        {{ stateContract.stateId }}
                    </span>
                </div>
                <div class="title">
                    {{ stateContract.stateDescription || stateContract.stateId }}
                </div>
                <div class="badges">
                    <span v-if="stateContract.initialState" class="badge badge-initial">
                        初始
                    </span>
                    <span v-if="stateContract.endState" class="badge badge-end">终止</span>
                    <span class="badge badge-info">
                        出边 {{ stateContract.transitions?.length || 0 }}
                    </span>
                    <span class="badge badge-info">入边 {{ incomingEdges.length }}</span>
                </div>
            </header>

            <!-- 出边列表 -->
            <section class="sec">
                <div class="sec-title">
                    出边列表
                    <span class="cnt">{{ stateContract.transitions?.length || 0 }}</span>
                </div>
                <div v-if="!stateContract.transitions?.length" class="hint">无出边</div>
                <div v-for="t in stateContract.transitions" :key="t.transitionId" class="edge"
                    :class="{ dead: t.dead, self: t.selfLoop }" @click="emit('selectTransition', t.transitionId)">
                    <div class="edge-row">
                        <span class="tag" :class="`tag-${triggerType(t).color}`">
                            {{ triggerType(t).label }}
                        </span>
                        <div class="edge-state-col">
                            <span class="edge-state-code">→ {{ t.targetState }}</span>
                            <span v-if="getStateNameCn(t.targetState)" class="edge-state-cn">
                                {{ getStateNameCn(t.targetState) }}
                            </span>
                        </div>
                    </div>
                    <div v-if="t.guardExpression" class="guard">
                        {{ t.guardExpression }}
                    </div>
                    <div v-if="t.dead || t.selfLoop" class="warn-row">
                        <span v-if="t.dead" class="warn-tag">DEAD</span>
                        <span v-if="t.selfLoop" class="warn-tag">SELF-LOOP</span>
                    </div>
                </div>
            </section>

            <!-- 入边反查 -->
            <section class="sec">
                <div class="sec-title">
                    入边（反查） <span class="cnt">{{ incomingEdges.length }}</span>
                </div>
                <div v-if="incomingEdges.length === 0" class="hint">无入边</div>
                <div v-for="t in incomingEdges" :key="`in-${t.transitionId}`" class="edge edge-in"
                    @click="emit('selectTransition', t.transitionId)">
                    <div class="edge-row">
                        <div class="edge-state-col">
                            <span class="edge-state-code">{{ t.sourceState }}</span>
                            <span v-if="getStateNameCn(t.sourceState)" class="edge-state-cn">
                                {{ getStateNameCn(t.sourceState) }}
                            </span>
                        </div>
                        <span class="arrow">→</span>
                    </div>
                    <div v-if="t.guardExpression" class="guard">
                        {{ t.guardExpression }}
                    </div>
                </div>
            </section>

            <!-- 涉及变量 -->
            <section v-if="setToArray(stateContract.requiredVariables).length > 0" class="sec">
                <div class="sec-title">
                    涉及变量
                    <span class="cnt">{{
                        setToArray(stateContract.requiredVariables).length
                        }}</span>
                </div>
                <div class="tag-list">
                    <span v-for="v in setToArray(stateContract.requiredVariables)" :key="v"
                        class="tag tag-read tag-stacked tag-clickable" @click="showVariableDetail(v)">
                        <span class="tag-code">{{ v }}</span>
                        <span v-if="getVariableNameCn(v)" class="tag-cn">
                            {{ getVariableNameCn(v) }}
                        </span>
                    </span>
                </div>
            </section>

            <section class="sec sec-actions">
                <button class="btn" @click="openInVSCode">📄 源文件</button>
                <button class="btn" @click="copyToClipboard(stateContract.stateId, '状态 ID')">
                    📋 复制 ID
                </button>
            </section>
        </div>

        <!-- ==================== 转移详情 ==================== -->
        <div v-else-if="transitionContract" class="body">
            <header class="head">
                <div class="head-meta">
                    <span class="kind kind-edge">转移</span>
                    <span class="sid" @click="copyToClipboard(transitionContract.transitionId, '转移ID')">
                        {{ transitionContract.transitionId }}
                    </span>
                </div>
                <div class="nav">
                    <span class="nav-state" @click="emit('selectState', transitionContract.sourceState)">
                        {{ transitionContract.sourceState }}
                    </span>
                    <span class="arrow">→</span>
                    <span class="nav-state" @click="emit('selectState', transitionContract.targetState)">
                        {{ transitionContract.targetState }}
                    </span>
                </div>
                <div class="badges">
                    <span class="badge" :class="`badge-${triggerType(transitionContract).color}`">
                        {{ triggerType(transitionContract).label }}
                    </span>
                    <span v-if="transitionContract.dead" class="badge badge-dead">
                        DEAD
                    </span>
                    <span v-if="transitionContract.selfLoop" class="badge badge-warn">
                        自循环
                    </span>
                    <span v-if="transitionContract.deviation" class="badge badge-deviation">
                        偏离
                    </span>
                </div>
            </header>

            <!-- 诊断警告 -->
            <section v-if="transitionContract.warnings?.length" class="sec">
                <div class="sec-title">
                    诊断警告
                    <span class="cnt">{{ transitionContract.warnings.length }}</span>
                </div>
                <div v-for="(w, i) in transitionContract.warnings" :key="i" class="warning">
                    ⚠ {{ w }}
                </div>
            </section>

            <!-- Guard 条件 -->
            <section v-if="transitionContract.guardExpression" class="sec">
                <div class="sec-title">Guard 条件</div>
                <pre class="code">{{ transitionContract.guardExpression }}</pre>
            </section>

            <!-- Action 表达式 -->
            <section v-if="transitionContract.actionExpression" class="sec">
                <div class="sec-title">Action 表达式</div>
                <pre class="code">{{ transitionContract.actionExpression }}</pre>
            </section>

            <!-- ★ 状态机 effects -->
            <section v-if="(transitionContract as any).effects?.length" class="sec">
                <div class="sec-title">
                    状态机 effects
                    <span class="cnt">{{
                        (transitionContract as any).effects.length
                        }}</span>
                </div>
                <div v-for="(e, i) in (transitionContract as any).effects" :key="i" class="effect-line">
                    <span class="effect-var">{{ e.var }}</span>
                    <span class="effect-eq">=</span>
                    <span class="effect-val">{{ e.value ?? e.valueExpression }}</span>
                </div>
            </section>

            <!-- ★ 状态机 exitReason -->
            <section v-if="(transitionContract as any).exitReason" class="sec">
                <div class="sec-title">状态机 exitReason</div>
                <pre class="code">{{ (transitionContract as any).exitReason }}</pre>
                <div class="exit-hint">
                    ↳ 运行时会写入
                    <code>process.returnToParent</code>
                </div>
            </section>

            <!-- 触发意图 -->
            <section v-if="setToArray(transitionContract.triggeringIntents).length > 0" class="sec">
                <div class="sec-title">
                    触发意图
                    <span class="cnt">{{
                        setToArray(transitionContract.triggeringIntents).length
                        }}</span>
                </div>
                <div class="tag-list">
                    <span v-for="i in setToArray(transitionContract.triggeringIntents)" :key="i"
                        class="tag tag-intent tag-stacked">
                        <span class="tag-code">{{ i }}</span>
                        <span v-if="getIntentNameCn(i)" class="tag-cn">
                            {{ getIntentNameCn(i) }}
                        </span>
                    </span>
                </div>
            </section>

            <!-- 关联 Skill -->
            <section v-if="setToArray(transitionContract.skills).length > 0" class="sec">
                <div class="sec-title">
                    关联 Skill
                    <span class="cnt">{{
                        setToArray(transitionContract.skills).length
                        }}</span>
                </div>
                <div class="tag-list">
                    <span v-for="s in setToArray(transitionContract.skills)" :key="s" class="tag tag-skill">
                        {{ s }}
                    </span>
                </div>
            </section>

            <!-- 读取变量 -->
            <section v-if="setToArray(transitionContract.readVariables).length > 0" class="sec">
                <div class="sec-title">
                    读取变量
                    <span class="cnt">{{
                        setToArray(transitionContract.readVariables).length
                        }}</span>
                </div>
                <div class="tag-list">
                    <span v-for="v in setToArray(transitionContract.readVariables)" :key="v"
                        class="tag tag-read tag-stacked tag-clickable" @click="showVariableDetail(v)">
                        <span class="tag-code">{{ v }}</span>
                        <span v-if="getVariableNameCn(v)" class="tag-cn">
                            {{ getVariableNameCn(v) }}
                        </span>
                    </span>
                </div>
            </section>

            <!-- 写入变量 -->
            <section v-if="setToArray(transitionContract.writtenVariables).length > 0" class="sec">
                <div class="sec-title">
                    写入变量
                    <span class="cnt">{{
                        setToArray(transitionContract.writtenVariables).length
                        }}</span>
                </div>
                <div class="tag-list">
                    <span v-for="v in setToArray(transitionContract.writtenVariables)" :key="v"
                        class="tag tag-write tag-stacked tag-clickable" @click="showVariableDetail(v)">
                        <span class="tag-code">{{ v }}</span>
                        <span v-if="getVariableNameCn(v)" class="tag-cn">
                            {{ getVariableNameCn(v) }}
                        </span>
                    </span>
                </div>
            </section>

            <section class="sec sec-actions">
                <button class="btn" @click="openInVSCode">📄 源文件</button>
            </section>
        </div>

        <!-- ==================== 变量详情弹窗 ==================== -->
        <a-modal v-model:open="variableDetailOpen" :width="900" :footer="null" :destroy-on-close="true"
            wrap-class-name="variable-detail-modal">
            <template #title>
                <div v-if="variableDetail" class="vd-title">
                    <span class="vd-icon">📦</span>
                    <span class="vd-code">{{ variableDetail.varName }}</span>
                    <span v-if="variableDetail.nameCn" class="vd-cn">
                        {{ variableDetail.nameCn }}
                    </span>
                </div>
            </template>

            <div v-if="variableDetail" class="vd-body">
                <!-- 概览统计 -->
                <div class="vd-stats">
                    <div class="vd-stat">
                        <span class="vd-stat-n">{{ variableDetail.readBy.length }}</span>
                        <span class="vd-stat-l">被读取</span>
                    </div>
                    <div class="vd-stat">
                        <span class="vd-stat-n">{{ variableDetail.writtenBy.length }}</span>
                        <span class="vd-stat-l">被写入</span>
                    </div>
                    <div class="vd-stat">
                        <span class="vd-stat-n vd-n-blue">
                            {{ variableDetail.relatedIntents.length }}
                        </span>
                        <span class="vd-stat-l">关联意图</span>
                    </div>
                    <div class="vd-stat">
                        <span class="vd-stat-n vd-n-purple">
                            {{ variableDetail.relatedSkills.length }}
                        </span>
                        <span class="vd-stat-l">关联技能</span>
                    </div>
                </div>

                <!-- 概览：意图 & 技能 -->
                <div v-if="
                    variableDetail.relatedIntents.length > 0 ||
                    variableDetail.relatedSkills.length > 0
                " class="vd-section">
                    <div class="vd-sec-title">概览</div>
                    <div v-if="variableDetail.relatedIntents.length > 0" class="vd-tag-row">
                        <span class="vd-tag-label">🎯 意图</span>
                        <span v-for="it in variableDetail.relatedIntents" :key="it.code" class="vd-tag vd-tag-intent"
                            :title="it.cn">
                            {{ it.code
                            }}<span v-if="it.cn" class="vd-tag-cn">（{{ it.cn }}）</span>
                        </span>
                    </div>
                    <div v-if="variableDetail.relatedSkills.length > 0" class="vd-tag-row">
                        <span class="vd-tag-label">🛠️ 技能</span>
                        <span v-for="s in variableDetail.relatedSkills" :key="s" class="vd-tag vd-tag-skill">
                            {{ s }}
                        </span>
                    </div>
                </div>

                <!-- ★ 写入此变量的转移（按类型分组） -->
                <div class="vd-section">
                    <div class="vd-sec-title">
                        ✏️ 写入此变量的转移
                        <span class="vd-sec-cnt">{{
                            variableDetail.writtenBy.length
                            }}</span>
                    </div>

                    <div v-if="variableDetail.writtenBy.length === 0" class="vd-empty">
                        无转移写入该变量（可能导致读-写缺口）
                    </div>

                    <!-- ① Skill 写入 -->
                    <template v-if="filterWritten('skill').length > 0">
                        <div class="vd-group-title vd-gt-skill">
                            🛠️ Skill 写入
                            <span class="vd-group-cnt">
                                {{ filterWritten('skill').length }}
                            </span>
                        </div>
                        <div v-for="t in filterWritten('skill')" :key="`w-skill-${t.transitionId}`"
                            class="vd-card vd-card-skill" @click="jumpToTransition(t.transitionId)">
                            <div class="vd-card-head">
                                <span class="vd-state-code">{{ t.sourceState }}</span>
                                <span class="vd-arrow">→</span>
                                <span class="vd-state-code">{{ t.targetState }}</span>
                                <span class="vd-prio">P{{ t.priority }}</span>
                            </div>
                            <div class="vd-card-cn">{{ t.sourceCn }} → {{ t.targetCn }}</div>
                            <div v-if="t.intents.length > 0 || t.skills.length > 0" class="vd-card-meta">
                                <span v-for="i in t.intents" :key="i.code" class="vd-mini-tag vd-mini-intent">
                                    🎯 {{ i.code }}<span v-if="i.cn"> · {{ i.cn }}</span>
                                </span>
                                <span v-for="s in t.skills" :key="s" class="vd-mini-tag vd-mini-skill">
                                    🛠️ {{ s }}
                                </span>
                            </div>
                            <div v-if="t.guardExpression" class="vd-card-guard">
                                {{ t.guardExpression }}
                            </div>
                        </div>
                    </template>

                    <!-- ② 状态机 effects 写入 -->
                    <template v-if="filterWritten('state-effect').length > 0">
                        <div class="vd-group-title vd-gt-effect">
                            🚦 状态机 effects 写入
                            <span class="vd-group-cnt">
                                {{ filterWritten('state-effect').length }}
                            </span>
                        </div>
                        <div v-for="t in filterWritten('state-effect')" :key="`w-eff-${t.transitionId}`"
                            class="vd-card vd-card-effect" @click="jumpToTransition(t.transitionId)">
                            <div class="vd-card-head">
                                <span class="vd-state-code">{{ t.sourceState }}</span>
                                <span class="vd-arrow">→</span>
                                <span class="vd-state-code">{{ t.targetState }}</span>
                                <span class="vd-prio">P{{ t.priority }}</span>
                            </div>
                            <div class="vd-card-cn">{{ t.sourceCn }} → {{ t.targetCn }}</div>
                            <div class="vd-card-effect-line">
                                <span class="vd-effect-label">effect</span>
                                <code>{{ variableDetail.varName }} =
                  {{ t.effectValue ?? '?' }}</code>
                            </div>
                            <div v-if="t.guardExpression" class="vd-card-guard">
                                {{ t.guardExpression }}
                            </div>
                        </div>
                    </template>

                    <!-- ③ 状态机 exitReason 写入 -->
                    <template v-if="filterWritten('state-exit').length > 0">
                        <div class="vd-group-title vd-gt-exit">
                            🚪 状态机 exitReason 写入
                            <span class="vd-group-cnt">
                                {{ filterWritten('state-exit').length }}
                            </span>
                        </div>
                        <div v-for="t in filterWritten('state-exit')" :key="`w-exit-${t.transitionId}`"
                            class="vd-card vd-card-exit" @click="jumpToTransition(t.transitionId)">
                            <div class="vd-card-head">
                                <span class="vd-state-code">{{ t.sourceState }}</span>
                                <span class="vd-arrow">→</span>
                                <span class="vd-state-code">{{ t.targetState }}</span>
                                <span class="vd-prio">P{{ t.priority }}</span>
                            </div>
                            <div class="vd-card-cn">{{ t.sourceCn }} → {{ t.targetCn }}</div>
                            <div class="vd-card-effect-line">
                                <span class="vd-effect-label">exitReason</span>
                                <code>{{ t.exitReason }}</code>
                            </div>
                            <div v-if="t.guardExpression" class="vd-card-guard">
                                {{ t.guardExpression }}
                            </div>
                        </div>
                    </template>
                </div>

                <!-- 读取此变量的转移 -->
                <div class="vd-section">
                    <div class="vd-sec-title">
                        👁️ 读取此变量的转移
                        <span class="vd-sec-cnt">{{ variableDetail.readBy.length }}</span>
                    </div>
                    <div v-if="variableDetail.readBy.length === 0" class="vd-empty">
                        无转移读取该变量
                    </div>
                    <div v-for="t in variableDetail.readBy" :key="`r-${t.transitionId}`" class="vd-card vd-card-read"
                        @click="jumpToTransition(t.transitionId)">
                        <div class="vd-card-head">
                            <span class="vd-state-code">{{ t.sourceState }}</span>
                            <span class="vd-arrow">→</span>
                            <span class="vd-state-code">{{ t.targetState }}</span>
                            <span class="vd-prio">P{{ t.priority }}</span>
                        </div>
                        <div class="vd-card-cn">{{ t.sourceCn }} → {{ t.targetCn }}</div>
                        <div v-if="t.intents.length > 0 || t.skills.length > 0" class="vd-card-meta">
                            <span v-for="i in t.intents" :key="i.code" class="vd-mini-tag vd-mini-intent">
                                🎯 {{ i.code }}<span v-if="i.cn"> · {{ i.cn }}</span>
                            </span>
                            <span v-for="s in t.skills" :key="s" class="vd-mini-tag vd-mini-skill">
                                🛠️ {{ s }}
                            </span>
                        </div>
                        <div v-if="t.guardExpression" class="vd-card-guard">
                            {{ t.guardExpression }}
                        </div>
                    </div>
                </div>

                <!-- 底部操作 -->
                <div class="vd-actions">
                    <button class="btn" @click="copyToClipboard(variableDetail.varName, '变量名')">
                        📋 复制变量名
                    </button>
                    <button class="btn" @click="variableDetailOpen = false">关闭</button>
                </div>
            </div>
        </a-modal>
    </aside>
</template>

<style scoped lang="scss">
.inspector {
    background: #fff;
    overflow-y: auto;
    height: 100%;
    font-size: 17px;
    color: #303133;
}

/* ============ 空状态 ============ */
.empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #c0c4cc;

    .icon {
        font-size: 80px;
        opacity: 0.3;
        margin-bottom: 20px;
    }

    .t {
        font-size: 20px;
        font-weight: 600;
        margin-bottom: 12px;
    }

    .h {
        font-size: 17px;
        line-height: 2;
        text-align: center;
    }
}

.body {
    padding: 22px 24px;
}

/* ============ 头部 ============ */
.head {
    padding-bottom: 20px;
    border-bottom: 1px solid #ebeef5;
    margin-bottom: 22px;
}

.head-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    .kind {
        padding: 5px 14px;
        border-radius: 3px;
        font-size: 14px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;

        &.kind-state {
            background: #ecf5ff;
            color: #1a73c9;
        }

        &.kind-edge {
            background: #f0eafc;
            color: #7c3aed;
        }
    }

    .sid {
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 15px;
        color: #909399;
        cursor: pointer;
        word-break: break-all;

        &:hover {
            color: #409eff;
        }
    }
}

.title {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.5;
    margin-bottom: 14px;
    color: #303133;
}

.nav {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 16px;
    flex-wrap: wrap;

    .nav-state {
        padding: 5px 14px;
        background: #f4f8ff;
        border: 1px solid #d9ecff;
        border-radius: 3px;
        color: #1a73c9;
        cursor: pointer;

        &:hover {
            background: #e6f2ff;
        }
    }

    .arrow {
        color: #909399;
        font-weight: 600;
    }
}

.badges {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.badge {
    padding: 5px 14px;
    border-radius: 3px;
    font-size: 14.5px;
    font-weight: 500;

    &.badge-intent {
        background: #e8f4fd;
        color: #1a73c9;
    }

    &.badge-event {
        background: #f0eafc;
        color: #7c3aed;
    }

    &.badge-timer {
        background: #fef3e6;
        color: #d97706;
    }

    &.badge-info {
        background: #f4f4f5;
        color: #606266;
    }

    &.badge-dead {
        background: #fef0f0;
        color: #f56c6c;
    }

    &.badge-warn {
        background: #fdf6ec;
        color: #e6a23c;
    }

    &.badge-deviation {
        background: #fde8ef;
        color: #c2185b;
    }

    &.badge-initial {
        background: #e6f7ff;
        color: #1890ff;
    }

    &.badge-end {
        background: #f6ffed;
        color: #52c41a;
    }
}

/* ============ Section ============ */
.sec {
    margin-bottom: 24px;
}

.sec-actions {
    display: flex;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid #ebeef5;
    margin-top: 20px;
}

.sec-title {
    font-size: 14.5px;
    font-weight: 600;
    color: #909399;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 10px;

    .cnt {
        font-size: 13px;
        background: #f4f4f5;
        padding: 3px 10px;
        border-radius: 8px;
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        color: #909399;
    }
}

.hint {
    font-size: 16px;
    color: #c0c4cc;
    font-style: italic;
    padding: 8px 0;
}

/* ============ 代码块 ============ */
.code {
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 16px;
    background: #f8f9fa;
    padding: 16px 18px;
    border-radius: 5px;
    border: 1px solid #ebeef5;
    border-left: 3px solid #d9ecff;
    color: #303133;
    word-break: break-all;
    white-space: pre-wrap;
    margin: 0;
    line-height: 1.85;
}

/* ============ 状态机 effects / exitReason ============ */
.effect-line {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #fff7e6;
    border-radius: 5px;
    border-left: 3px solid #fa8c16;
    margin-bottom: 8px;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 15px;

    .effect-var {
        color: #1a73c9;
        font-weight: 600;
    }

    .effect-eq {
        color: #909399;
    }

    .effect-val {
        color: #c7254e;
    }
}

.exit-hint {
    margin-top: 8px;
    font-size: 14px;
    color: #909399;
    padding-left: 6px;

    code {
        background: #f4f4f5;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        color: #c7254e;
    }
}

/* ============ Tag 列表 ============ */
.tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.tag {
    padding: 6px 14px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 15.5px;
    word-break: break-all;
    transition: all 0.12s;

    &.tag-intent {
        background: #e8f4fd;
        color: #1a73c9;
    }

    &.tag-read {
        background: #ecf5ff;
        color: #1a73c9;
    }

    &.tag-write {
        background: #f0f9eb;
        color: #2e7d32;
    }

    &.tag-skill {
        background: #f9f0ff;
        color: #722ed1;
    }
}

.tag-clickable {
    cursor: pointer;

    &:hover {
        filter: brightness(0.94);
        box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
        transform: translateY(-1px);
    }

    &:active {
        transform: translateY(0);
    }
}

.tag-stacked {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    padding: 8px 14px;
    line-height: 1.3;

    .tag-code {
        font-size: 15px;
    }

    .tag-cn {
        font-family:
            -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei',
            sans-serif;
        font-size: 13px;
        font-weight: 500;
        opacity: 0.75;
        letter-spacing: 0.3px;
    }
}

/* ============ Edge 卡片 ============ */
.edge {
    padding: 14px 16px;
    border: 1px solid #ebeef5;
    border-radius: 5px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
        border-color: #c6e2ff;
        background: #f0f7ff;
    }

    &.dead {
        border-left: 4px solid #f56c6c;
    }

    &.self {
        border-left: 4px solid #e6a23c;
    }

    &.edge-in {
        background: #fafbfc;
        border-left: 4px solid #d9ecff;
    }

    .edge-row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 10px;

        .tag {
            padding: 4px 11px;
            border-radius: 3px;
            font-size: 13.5px;
            font-weight: 500;
            margin-top: 3px;
            flex-shrink: 0;
            cursor: default;

            &:hover {
                filter: none;
            }
        }

        .tag-intent {
            background: #e8f4fd;
            color: #1a73c9;
        }

        .tag-event {
            background: #f0eafc;
            color: #7c3aed;
        }

        .tag-timer {
            background: #fef3e6;
            color: #d97706;
        }

        .tag-info {
            background: #f4f4f5;
            color: #606266;
        }

        .edge-state-col {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 3px;

            .edge-state-code {
                font-family: 'SF Mono', Monaco, Consolas, monospace;
                font-size: 16px;
                color: #303133;
                word-break: break-all;
                line-height: 1.3;
            }

            .edge-state-cn {
                font-family:
                    -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei',
                    sans-serif;
                font-size: 14px;
                font-weight: 500;
                color: #909399;
                letter-spacing: 0.2px;
                line-height: 1.3;
            }
        }

        .arrow {
            color: #909399;
            font-size: 16px;
            margin-top: 3px;
            flex-shrink: 0;
        }
    }

    .guard {
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 15px;
        color: #909399;
        word-break: break-all;
        line-height: 1.7;
        padding-left: 2px;
    }

    .warn-row {
        margin-top: 10px;
        display: flex;
        gap: 8px;

        .warn-tag {
            font-size: 12.5px;
            padding: 4px 9px;
            background: #fef0f0;
            color: #f56c6c;
            border-radius: 3px;
            font-weight: 600;
        }
    }
}

/* ============ 警告卡片 ============ */
.warning {
    padding: 14px 16px;
    background: #fdf6ec;
    border-left: 4px solid #e6a23c;
    border-radius: 4px;
    font-size: 16px;
    color: #a06000;
    line-height: 1.7;
    margin-bottom: 10px;
}

/* ============ 按钮 ============ */
.btn {
    flex: 1;
    padding: 12px 18px;
    border: 1px solid #dcdfe6;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    color: #606266;
    transition: all 0.15s;

    &:hover {
        border-color: #409eff;
        color: #409eff;
        background: #f5f9ff;
    }

    &:active {
        background: #e6f2ff;
    }
}

/* ============ 滚动条 ============ */
::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: #dcdfe6;
    border-radius: 5px;

    &:hover {
        background: #c0c4cc;
    }
}

/* ==================== 变量详情弹窗 ==================== */
:global(.variable-detail-modal) {
    .ant-modal-body {
        padding: 0;
        max-height: 78vh;
        overflow-y: auto;
    }
}

.vd-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 17px;

    .vd-icon {
        font-size: 22px;
    }

    .vd-code {
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        color: #1a73c9;
        font-weight: 600;
    }

    .vd-cn {
        font-size: 14px;
        color: #909399;
        font-weight: 500;
    }
}

.vd-body {
    padding: 20px 24px 24px;
}

/* 统计 */
.vd-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
}

.vd-stat {
    padding: 14px 16px;
    background: #fafbfc;
    border-radius: 8px;
    text-align: center;
    border: 1px solid #ebeef5;

    .vd-stat-n {
        display: block;
        font-size: 26px;
        font-weight: 700;
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        color: #303133;
        line-height: 1.2;
        margin-bottom: 4px;

        &.vd-n-blue {
            color: #1a73c9;
        }

        &.vd-n-purple {
            color: #722ed1;
        }
    }

    .vd-stat-l {
        font-size: 12.5px;
        color: #909399;
    }
}

/* Section */
.vd-section {
    margin-bottom: 22px;
}

.vd-sec-title {
    font-size: 13.5px;
    font-weight: 600;
    color: #606266;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #ebeef5;
    display: flex;
    align-items: center;
    gap: 8px;

    .vd-sec-cnt {
        font-size: 12px;
        padding: 1px 8px;
        background: #f4f4f5;
        border-radius: 10px;
        color: #909399;
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-weight: 500;
    }
}

.vd-empty {
    padding: 16px;
    text-align: center;
    color: #c0c4cc;
    font-size: 13.5px;
    font-style: italic;
    background: #fafbfc;
    border-radius: 6px;
}

/* 概览 tag 行 */
.vd-tag-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;

    .vd-tag-label {
        font-size: 13px;
        color: #909399;
        margin-right: 4px;
        flex-shrink: 0;
    }
}

.vd-tag {
    padding: 4px 12px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 13.5px;

    .vd-tag-cn {
        font-family:
            -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei',
            sans-serif;
        font-size: 12.5px;
        opacity: 0.75;
    }

    &.vd-tag-intent {
        background: #e8f4fd;
        color: #1a73c9;
    }

    &.vd-tag-skill {
        background: #f9f0ff;
        color: #722ed1;
    }
}

/* 转移卡片 */
.vd-card {
    padding: 14px 16px;
    border: 1px solid #ebeef5;
    border-radius: 6px;
    margin-bottom: 10px;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
        border-color: #c6e2ff;
        background: #f0f7ff;
        transform: translateX(2px);
    }
}

/* 卡片左边框按写入类型 */
.vd-card-skill {
    border-left: 4px solid #52c41a;
}

.vd-card-effect {
    border-left: 4px solid #fa8c16;
}

.vd-card-exit {
    border-left: 4px solid #722ed1;
}

.vd-card-read {
    border-left: 4px solid #409eff;
}

.vd-card-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    flex-wrap: wrap;

    .vd-state-code {
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 14px;
        color: #303133;
        word-break: break-all;
    }

    .vd-arrow {
        color: #909399;
        font-size: 14px;
    }

    .vd-prio {
        font-size: 11.5px;
        padding: 1px 7px;
        background: #f4f4f5;
        color: #909399;
        border-radius: 3px;
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        margin-left: auto;
    }
}

.vd-card-cn {
    font-size: 13px;
    color: #909399;
    margin-bottom: 8px;
    line-height: 1.5;
}

.vd-card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
}

.vd-mini-tag {
    font-size: 12px;
    padding: 3px 9px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    line-height: 1.4;

    &.vd-mini-intent {
        background: #e8f4fd;
        color: #1a73c9;
    }

    &.vd-mini-skill {
        background: #f9f0ff;
        color: #722ed1;
    }
}

.vd-card-guard {
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 12.5px;
    color: #909399;
    background: #f8f9fa;
    padding: 8px 10px;
    border-radius: 4px;
    word-break: break-all;
    line-height: 1.6;
    border-left: 2px solid #d9ecff;
}

/* ★ 写入者分组标题 */
.vd-group-title {
    font-size: 13.5px;
    font-weight: 600;
    color: #303133;
    margin: 16px 0 10px;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 4px;

    .vd-group-cnt {
        font-size: 12px;
        padding: 2px 9px;
        border-radius: 10px;
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-weight: 500;
    }

    &.vd-gt-skill {
        background: linear-gradient(90deg, #f0f9eb, transparent);
        border-left: 3px solid #52c41a;

        .vd-group-cnt {
            background: #e6f7d9;
            color: #2e7d32;
        }
    }

    &.vd-gt-effect {
        background: linear-gradient(90deg, #fff7e6, transparent);
        border-left: 3px solid #fa8c16;

        .vd-group-cnt {
            background: #ffecd0;
            color: #ad4e00;
        }
    }

    &.vd-gt-exit {
        background: linear-gradient(90deg, #f9f0ff, transparent);
        border-left: 3px solid #722ed1;

        .vd-group-cnt {
            background: #efe0ff;
            color: #531dab;
        }
    }
}

/* ★ effect / exitReason 信息行 */
.vd-card-effect-line {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: #fafbfc;
    border-radius: 4px;
    margin-bottom: 8px;

    .vd-effect-label {
        font-size: 12px;
        color: #909399;
        font-weight: 500;
        flex-shrink: 0;
        padding: 2px 8px;
        background: #f4f4f5;
        border-radius: 3px;
    }

    code {
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 13px;
        color: #c7254e;
        background: transparent;
        padding: 0;
    }
}

/* 底部操作 */
.vd-actions {
    display: flex;
    gap: 10px;
    padding-top: 16px;
    border-top: 1px solid #ebeef5;
    margin-top: 20px;
}
</style>
