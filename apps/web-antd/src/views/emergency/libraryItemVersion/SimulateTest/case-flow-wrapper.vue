<script setup lang="ts">
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import CaseFlowView from './caseFlow.vue';

// ==================== 弹窗 API ====================
const [BasicModal, modalApi] = useVbenModal({
    onOpenChange(isOpen: boolean) {
        showContent.value = isOpen;
    },
});

const showContent = ref(false);
const modalData = computed(() =>
    modalApi.getData<{ id?: string; sessionId?: string }>(),
);
const caseId = computed(() => modalData.value?.id || '');
const sessionId = computed(() => modalData.value?.sessionId || '');
</script>

<template>
    <BasicModal title="配置方案" class="h-[800px] w-[1600px]">
        <div v-if="showContent" class="case-flow-container">
            <CaseFlowView :id="caseId" :session-id="sessionId" />
        </div>
    </BasicModal>
</template>

<style scoped>
.case-flow-container {
    width: 100%;
    height: 100%;
    overflow: auto;
}
</style>
