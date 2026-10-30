<script setup lang="ts">
import { onMounted } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import GraphCanvas from './components/GraphCanvas.vue';
import Inspector from './components/Inspector.vue';
import IssuesBar from './components/IssuesBar.vue';
import { useContract } from './composables/useContract';

// ==================== 契约数据 ====================
const {
    caseId,
    contract,
    mermaidCode,
    loading,
    error,
    selectedStateId,
    selectedTransitionId,
    mode,
    loadContract,
    reloadAll,
} = useContract();

// ==================== Modal ====================
const [BasicModal, modalApi] = useVbenModal({
    onOpenChange(isOpen) {
        if (!isOpen) return;
        const data = modalApi.getData<{ caseId?: string; id?: string }>();
        const next = data?.caseId || data?.id || 'stable_narrow';
        console.log('[SimulateTest] 弹窗打开, caseId =', next);
        caseId.value = next;
        loadContract();
    },
});

// ==================== 事件处理 ====================
function selectState(sid: string) {
    selectedStateId.value = sid;
    selectedTransitionId.value = null;
}

function selectTransition(tid: string) {
    selectedTransitionId.value = tid;
    selectedStateId.value = null;
}

async function onReload() {
    const ok = await reloadAll();
    message[ok ? 'success' : 'error'](ok ? '✅ 已重载' : '重载失败');
}

function onFilter(f: 'diagnostics' | 'intents' | 'variables') {
    mode.value = f;
}

onMounted(() => {
    if (!contract.value && !loading.value) {
        loadContract();
    }
});
</script>

<template>
    <BasicModal title="案例流程 - 契约维护" class="h-[85vh] w-[1600px]" :footer="false" :fullscreen-button="true">
        <div class="contract-modal">
            <!-- 顶部工具栏 -->
            <header class="toolbar">
                <div class="case-info">
                    <span class="label">案例</span>
                    <span class="cid">{{ caseId }}</span>
                    <span v-if="contract?.caseName" class="name">
                        {{ contract.caseName }}
                    </span>
                    <span v-if="contract?.version" class="version">
                        v{{ contract.version }}
                    </span>
                </div>

                <!-- 图例 -->
                <div class="legend-inline">
                    <span class="lg-item">
                        <i class="lg-dot lg-global"></i>全局继承 [G]
                    </span>
                    <span class="lg-item">
                        <i class="lg-dot lg-case"></i>案例自有 [C]
                    </span>
                </div>

                <div class="actions">
                    <button class="tb-btn" @click="onReload">🔄 热重载</button>
                </div>
            </header>

            <!-- 两栏主体 -->
            <div class="body">
                <GraphCanvas :contract="contract" :mermaid-code="mermaidCode" :mode="mode"
                    :selected-state-id="selectedStateId" :loading="loading" :error="error" @select-state="selectState"
                    @mode-change="mode = $event" />

                <Inspector :contract="contract" :case-id="caseId" :state-id="selectedStateId"
                    :transition-id="selectedTransitionId" @select-state="selectState"
                    @select-transition="selectTransition" />
            </div>

            <IssuesBar :contract="contract" @filter="onFilter" />
        </div>
    </BasicModal>
</template>

<style scoped lang="scss">
.contract-modal {
    display: grid;
    grid-template-rows: 44px 1fr 36px;
    height: 100%;
    gap: 1px;
    background: #e4e7ed;
    margin: -16px;
}

/* ============ 顶部工具栏 ============ */
.toolbar {
    display: flex;
    align-items: center;
    padding: 0 16px;
    background: #fff;
    gap: 16px;

    .case-info {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;

        .label {
            color: #909399;
        }

        .cid {
            color: #1a73c9;
            font-weight: 600;
            font-family: 'SF Mono', Monaco, monospace;
            padding: 2px 8px;
            background: #f4f8ff;
            border: 1px solid #d9ecff;
            border-radius: 4px;
        }

        .name {
            color: #303133;
            font-weight: 500;
            margin-left: 4px;
        }

        .version {
            color: #909399;
            font-family: monospace;
            font-size: 11px;
            padding: 1px 6px;
            background: #f4f4f5;
            border-radius: 8px;
        }
    }

    /* ★ 图例 */
    .legend-inline {
        display: flex;
        gap: 14px;
        font-size: 12px;
        color: #606266;

        .lg-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .lg-dot {
            width: 12px;
            height: 12px;
            border-radius: 3px;
            border: 2px solid;

            &.lg-global {
                background: #f0f4f8;
                border-color: #7a8ba3;
            }

            &.lg-case {
                background: #e8f7f4;
                border-color: #189a86;
            }
        }
    }

    .actions {
        margin-left: auto;
        display: flex;
        gap: 8px;
    }
}

/* ============ 主体两栏 ============ */
.body {
    display: grid;
    /* 左：图 1fr  右：Inspector 560px */
    grid-template-columns: 1fr 560px;
    gap: 1px;
    overflow: hidden;
    background: #e4e7ed;
}

/* ============ 按钮 ============ */
.tb-btn {
    padding: 5px 12px;
    background: #fff;
    border: 1px solid #e4e7ed;
    border-radius: 5px;
    cursor: pointer;
    font-size: 12px;
    color: #606266;
    transition: all 0.15s;

    &:hover {
        border-color: #409eff;
        color: #409eff;
    }
}
</style>
