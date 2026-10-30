```vue
<script setup lang="ts">
import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import WorkflowDesigner from './index.vue';

// 当前选中的案例 ID
const currentCaseId = ref<string>('');

// 注册 Vben 弹窗
const [Modal, modalApi] = useVbenModal({
    title: '案例状态机工作流设计器',
    class: 'w-[95vw]',
    fullscreen: true,
    footer: false,

    onOpenChange(isOpen: boolean) {
        if (isOpen) {
            // 获取列表页面传递的案例 ID
            const data = modalApi.getData<{ caseId?: string }>();

            currentCaseId.value = data?.caseId || '';

            console.log(
                '[LogicFlowModal] 打开案例:',
                currentCaseId.value,
            );
        } else {
            // 关闭弹窗时清理状态
            currentCaseId.value = '';
        }
    },
});
</script>

<template>
    <Modal>
        <div class="logicflow-modal-content">
            <WorkflowDesigner v-if="currentCaseId" :key="currentCaseId" :case-id="currentCaseId" />

            <div v-else class="empty-message">
                未指定案例 ID
            </div>
        </div>
    </Modal>
</template>

<style scoped>
.logicflow-modal-content {
    width: 100%;
    height: calc(100vh - 150px);
    min-height: 550px;
    overflow: hidden;
}

.empty-message {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #999;
    font-size: 14px;
}
</style>
