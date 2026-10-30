<script setup lang="ts">
import type { ContractData } from '#/api/ems/types';

import { computed } from 'vue';

const props = defineProps<{
    contract: ContractData | null;
}>();

const emit = defineEmits<{
    (e: 'filter', mode: 'diagnostics' | 'intents' | 'variables'): void;
}>();

const counts = computed(() => {
    const d = props.contract?.diagnostics;
    if (!d) return { gaps: 0, empty: 0, dead: 0, self: 0, hasAny: false };
    const gaps = d.unwritableVariables?.length || 0;
    const empty = d.emptyIntents?.length || 0;
    const dead = d.deadTransitions?.length || 0;
    const self = d.selfLoops?.length || 0;
    return { gaps, empty, dead, self, hasAny: gaps + empty + dead + self > 0 };
});
</script>

<template>
    <footer class="issues-bar">
        <span class="label">问题</span>

        <span v-if="counts.gaps > 0" class="chip p0" @click="emit('filter', 'variables')">
            <span class="n">{{ counts.gaps }}</span>
            <span class="t">读-写缺口</span>
        </span>
        <span v-if="counts.empty > 0" class="chip p1" @click="emit('filter', 'intents')">
            <span class="n">{{ counts.empty }}</span>
            <span class="t">未匹配意图</span>
        </span>
        <span v-if="counts.dead > 0" class="chip p1" @click="emit('filter', 'diagnostics')">
            <span class="n">{{ counts.dead }}</span>
            <span class="t">死转移</span>
        </span>
        <span v-if="counts.self > 0" class="chip p1" @click="emit('filter', 'diagnostics')">
            <span class="n">{{ counts.self }}</span>
            <span class="t">自循环</span>
        </span>
        <span v-if="!counts.hasAny" class="ok">✓ 无问题</span>

        <div class="right">
            <span class="stat"><i class="dot s1"></i>{{ Object.keys(contract?.states || {}).length }} 状态</span>
            <span class="stat"><i class="dot s2"></i>{{ Object.keys(contract?.transitions || {}).length }} 转移</span>
            <span class="stat"><i class="dot s3"></i>{{ Object.keys(contract?.variables || {}).length }} 变量</span>
        </div>
    </footer>
</template>

<style scoped lang="scss">
.issues-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 18px;
    background: #fff;
    border-top: 1px solid #e4e7ed;
    font-size: 12px;
    height: 100%;
}

.label {
    font-size: 10px;
    font-weight: 600;
    color: #909399;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: #fef0f0;
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid transparent;
    white-space: nowrap;

    &:hover {
        border-color: #fbc4c4;
    }

    &.p1 {
        background: #fdf6ec;

        &:hover {
            border-color: #f5dab1;
        }
    }

    &.p1 .n {
        color: #e6a23c;
    }

    .n {
        font-family: monospace;
        font-weight: 700;
        font-size: 11px;
        color: #f56c6c;
    }

    .t {
        font-size: 11px;
        color: #606266;
    }
}

.ok {
    font-size: 12px;
    color: #67c23a;
}

.right {
    margin-left: auto;
    display: flex;
    gap: 14px;
    font-family: monospace;
    font-size: 11px;
    color: #909399;

    .stat {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;

        &.s1 {
            background: #67c23a;
        }

        &.s2 {
            background: #409eff;
        }

        &.s3 {
            background: #e6a23c;
        }
    }
}
</style>
