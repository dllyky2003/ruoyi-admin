<script setup lang="ts">
import type { GraphMode } from '../composables/useContract';

import type { ContractData } from '#/api/ems/types';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { useStateMachine } from '../composables/useStateMachine';

const props = defineProps<{
    contract: ContractData | null;
    error: string;
    loading: boolean;
    mermaidCode: string;
    mode: GraphMode;
    selectedStateId: null | string;
}>();

const emit = defineEmits<{
    (e: 'selectState', stateId: string): void;
    (e: 'modeChange', mode: GraphMode): void;
}>();

const stateMachine = useStateMachine();

const modes: Array<{ icon: string; key: GraphMode; label: string }> = [
    { key: 'default', label: '状态机', icon: '🔄' },
    { key: 'variables', label: '变量', icon: '📦' },
    { key: 'intents', label: '意图', icon: '🎯' },
    { key: 'diagnostics', label: '诊断', icon: '⚠️' },
];

const modeCounts = computed<Record<GraphMode, number>>(() => {
    const c = props.contract;
    if (!c) return { default: 0, variables: 0, intents: 0, diagnostics: 0 };
    return {
        default: 0,
        variables: (c.diagnostics?.unwritableVariables || []).length,
        intents: (c.diagnostics?.emptyIntents || []).length,
        diagnostics:
            (c.diagnostics?.deadTransitions || []).length +
            (c.diagnostics?.selfLoops || []).length +
            (c.diagnostics?.undefinedDerivedVars || []).length,
    };
});

const viewport = ref<HTMLDivElement | null>(null);

function toSafeId(s: string): string {
    return s.replaceAll(/\W/g, '_');
}

function findNode(svg: SVGSVGElement, stateId: string): null | SVGGElement {
    const safeId = toSafeId(stateId);
    let el = svg.querySelector(`[id^="flowchart-${safeId}-"]`);
    if (el) return el as SVGGElement;
    el = svg.querySelector(`[id*="flowchart-${safeId}"]`);
    if (el) return el as SVGGElement;
    const groups = svg.querySelectorAll<SVGGElement>('g[id^="flowchart-"]');
    for (const g of groups) {
        const gid = g.getAttribute('id');
        if (gid && gid.includes(`flowchart-${safeId}`)) return g;
    }
    return null;
}

function bindStateData() {
    if (!viewport.value || !props.contract) return;
    const svg = viewport.value.querySelector('svg');
    if (!svg) return;

    let matched = 0;
    for (const stateId of Object.keys(props.contract.states)) {
        const node = findNode(svg, stateId);
        if (node) {
            node.dataset.state = stateId;
            node.style.cursor = 'pointer';
            matched++;
        }
    }
    console.debug(`[GraphCanvas] 已绑定 ${matched} 个节点`);
}

function applyModeHighlight() {
    if (!viewport.value || !props.contract) return;
    const svg = viewport.value.querySelector('svg');
    if (!svg) return;

    svg
        .querySelectorAll(
            '.mode-gap, .mode-intent, .mode-diagnostic, .mode-selected',
        )
        .forEach((el) => {
            el.classList.remove(
                'mode-gap',
                'mode-intent',
                'mode-diagnostic',
                'mode-selected',
            );
        });

    if (props.selectedStateId) {
        findNode(svg, props.selectedStateId)?.classList.add('mode-selected');
    }

    switch (props.mode) {
        case 'diagnostics': {
            for (const t of Object.values(props.contract.transitions || {})) {
                if (t.dead || t.selfLoop)
                    findNode(svg, t.sourceState)?.classList.add('mode-diagnostic');
            }

            break;
        }
        case 'intents': {
            for (const t of Object.values(props.contract.transitions || {})) {
                if (t.intentCode)
                    findNode(svg, t.sourceState)?.classList.add('mode-intent');
            }

            break;
        }
        case 'variables': {
            const gapVars = new Set(
                props.contract.diagnostics?.unwritableVariables || [],
            );
            for (const t of Object.values(props.contract.transitions || {})) {
                const readVars: string[] = [...((t.readVariables as any) || [])];
                const hasGap = readVars.some((v) =>
                    [...gapVars].some((gv) => v.startsWith(gv) || gv.startsWith(v)),
                );
                if (hasGap) findNode(svg, t.sourceState)?.classList.add('mode-gap');
            }

            break;
        }
        // No default
    }
}

// ★ 同时监听 mermaidCode 和 viewport（弹窗懒渲染，viewport 会延迟挂载）
watch(
    [() => props.mermaidCode, viewport],
    async ([code, el]) => {
        if (!code || !el) return;

        console.log(
            '[GraphCanvas] 开始渲染, viewport 存在, mermaid 长度:',
            code.length,
        );
        console.log(
            '[GraphCanvas] viewport.clientWidth =',
            el.clientWidth,
            ', clientHeight =',
            el.clientHeight,
        );

        stateMachine.mermaidContainer.value = el;
        await nextTick();

        // 防止 viewport 元素在异步过程中被替换
        if (stateMachine.mermaidContainer.value !== el) return;

        await stateMachine.renderMermaid(code);
        await nextTick();

        bindStateData();
        applyModeHighlight();

        console.log(
            '[GraphCanvas] 渲染完成, SVG 元素:',
            el.querySelector('svg') ? '存在' : '不存在',
        );
    },
    { immediate: true, flush: 'post' },
);

watch(() => props.mode, applyModeHighlight);
watch(() => props.selectedStateId, applyModeHighlight);

function onClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const node = target.closest('[data-state]') as HTMLElement | null;
    if (!node) return;
    const sid = node.dataset.state;
    if (sid) emit('selectState', sid);
}

onBeforeUnmount(() => {
    stateMachine.destroy();
});
</script>

<template>
    <div class="graph-canvas">
        <div class="mode-tabs">
            <button v-for="m in modes" :key="m.key" class="mode-tab" :class="{ active: mode === m.key }"
                @click="emit('modeChange', m.key)">
                {{ m.icon }} {{ m.label }}
                <span v-if="modeCounts[m.key] > 0" class="cnt">{{
                    modeCounts[m.key]
                    }}</span>
            </button>
        </div>

        <div v-if="loading" class="overlay">加载中…</div>
        <div v-else-if="error" class="overlay error">{{ error }}</div>

        <div ref="viewport" class="viewport" @click="onClick"></div>

        <div v-if="!loading && !error" class="zoom">
            <button @click="stateMachine.zoomIn()">＋</button>
            <button @click="stateMachine.zoomOut()">－</button>
            <button @click="stateMachine.resetZoom()">⟲</button>
        </div>

        <div v-if="!loading && !error" class="legend">
            <span class="li"><i class="box lb-initial"></i>初始</span>
            <span class="li"><i class="box lb-normal"></i>正常</span>
            <span class="li"><i class="box lb-warn"></i>警告</span>
            <span class="li"><i class="box lb-error"></i>错误</span>
            <span class="li"><i class="box lb-end"></i>终止</span>
        </div>
    </div>
</template>

<style scoped lang="scss">
.graph-canvas {
    position: relative;
    height: 100%;
    overflow: hidden;
    background: #fafbfc;
}

.mode-tabs {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    gap: 0;
    padding: 3px;
    background: #fff;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    z-index: 10;
}

.mode-tab {
    padding: 5px 12px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11.5px;
    color: #606266;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 4px;

    &:hover {
        background: #f5f7fa;
    }

    &.active {
        background: #409eff;
        color: #fff;
    }

    .cnt {
        font-family: monospace;
        font-size: 10px;
        padding: 0 5px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.08);
    }

    &.active .cnt {
        background: rgba(255, 255, 255, 0.25);
    }
}

.viewport {
    width: 100%;
    height: 100%;
    overflow: hidden;

    :deep(svg) {
        display: block;
    }

    :deep(.mode-selected rect),
    :deep(.mode-selected polygon) {
        stroke: #409eff !important;
        stroke-width: 3px !important;
    }

    :deep(.mode-gap rect),
    :deep(.mode-gap polygon) {
        stroke: #f56c6c !important;
        stroke-width: 3px !important;
        filter: drop-shadow(0 0 6px rgba(245, 108, 108, 0.6));
    }

    :deep(.mode-intent rect),
    :deep(.mode-intent polygon) {
        stroke: #1a73c9 !important;
        stroke-width: 2.5px !important;
    }

    :deep(.mode-diagnostic rect),
    :deep(.mode-diagnostic polygon) {
        stroke: #e6a23c !important;
        stroke-width: 2.5px !important;
        stroke-dasharray: 4 3;
    }
}

.overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: #909399;
    background: rgba(255, 255, 255, 0.7);
    z-index: 5;

    &.error {
        color: #f56c6c;
    }
}

.zoom {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    gap: 4px;
    padding: 4px;
    background: #fff;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    z-index: 10;

    button {
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        color: #606266;

        &:hover {
            background: #f5f7fa;
            color: #409eff;
        }
    }
}

.legend {
    position: absolute;
    bottom: 16px;
    left: 16px;
    display: flex;
    gap: 14px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    font-size: 10.5px;
    color: #606266;
    z-index: 10;

    .li {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .box {
        width: 10px;
        height: 10px;
        border-radius: 2px;
        border: 1.5px solid;
        display: inline-block;

        &.lb-initial {
            background: #e6f7ff;
            border-color: #1890ff;
        }

        &.lb-normal {
            background: #fff;
            border-color: #c0c4cc;
        }

        &.lb-warn {
            background: #fff7e6;
            border-color: #fa8c16;
        }

        &.lb-error {
            background: #fff1f0;
            border-color: #ff4d4f;
        }

        &.lb-end {
            background: #f6ffed;
            border-color: #52c41a;
        }
    }
}
</style>
