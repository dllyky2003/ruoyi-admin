<script setup lang="ts">
import type { ContractData } from '#/api/ems/types';

import { computed } from 'vue';

const props = defineProps<{
    caseId: string;
    contract: ContractData | null;
    selectedStateId: null | string;
}>();

const emit = defineEmits<{
    (e: 'select', stateId: string): void;
}>();

interface TreeItem {
    stateId: string;
    warn: boolean;
    err: boolean;
}
interface TreeGroup {
    key: string;
    label: string;
    items: TreeItem[];
}

const groups = computed<TreeGroup[]>(() => {
    if (!props.contract) return [];
    const stateMap = props.contract.stateContracts || {};
    const own: TreeGroup = { key: 'own', label: '[C] 案例自有', items: [] };
    const inherited: TreeGroup = {
        key: 'inherited',
        label: '[G] 全局继承',
        items: [],
    };

    for (const stateId of Object.keys(stateMap)) {
        const st = stateMap[stateId];
        if (!st) continue;
        const transitions = st.transitions || [];
        const warn = transitions.some((t) => t.dead || t.selfLoop);
        const err = transitions.some((t) => t.dead);
        const item: TreeItem = { stateId, warn, err };

        if (stateId.startsWith('F-000')) inherited.items.push(item);
        else own.items.push(item);
    }
    return [own, inherited];
});

function dotClass(item: TreeItem) {
    if (item.err) return 'err';
    if (item.warn) return 'warn';
    return 'ok';
}
</script>

<template>
    <aside class="state-tree">
        <div class="tree-header">
            <span>状态机</span>
            <span class="pill">{{ Object.keys(contract?.states || {}).length }}</span>
        </div>

        <div v-for="g in groups" :key="g.key" class="tree-group">
            <div class="tree-group-title">
                <span>{{ g.label }}</span>
                <span class="cnt">{{ g.items.length }}</span>
            </div>
            <div v-for="item in g.items" :key="item.stateId" class="tree-item"
                :class="{ active: selectedStateId === item.stateId }" @click="emit('select', item.stateId)">
                <span class="dot" :class="dotClass(item)"></span>
                <span class="sid">{{ item.stateId }}</span>
            </div>
        </div>
    </aside>
</template>

<style scoped lang="scss">
.state-tree {
    background: #fff;
    overflow-y: auto;
    height: 100%;
    font-size: 12px;
}

.tree-header {
    padding: 12px 16px;
    /* 加大 padding */
    font-size: 12px;
    /* 10px → 12px */
    font-weight: 600;
    color: #909399;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    justify-content: space-between;
    position: sticky;
    top: 0;
    background: #fff;
    z-index: 2;

    .pill {
        font-size: 11px;
        /* 9px → 11px */
        padding: 0 8px;
        background: #f4f4f5;
        color: #909399;
        border-radius: 8px;
        font-family: monospace;
    }
}

.tree-group {
    padding: 4px 0 8px;
}

.tree-group-title {
    padding: 8px 16px;
    font-size: 11px;
    /* 9.5px → 11px */
    color: #909399;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
    display: flex;
    justify-content: space-between;

    .cnt {
        font-family: monospace;
        font-weight: 400;
    }
}

.tree-item {
    padding: 8px 16px 8px 20px;
    /* 上下 padding 加大 */
    font-family: monospace;
    font-size: 13px;
    /* 11.5px → 13px */
    color: #606266;
    cursor: pointer;
    border-left: 2px solid transparent;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.12s;

    &:hover {
        background: #f5f7fa;
        color: #303133;
    }

    &.active {
        background: #ecf5ff;
        color: #409eff;
        border-left-color: #409eff;
        font-weight: 600;
    }

    .dot {
        width: 8px;
        /* 6px → 8px */
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;

        &.ok {
            background: #67c23a;
        }

        &.warn {
            background: #e6a23c;
        }

        &.err {
            background: #f56c6c;
        }
    }

    .sid {
        word-break: break-all;
    }
}
</style>
