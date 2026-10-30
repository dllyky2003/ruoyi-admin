<!-- TestModal.vue -->
<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form';

import type { LibraryItemVersionForm } from '#/api/emergency/libraryItemVersion/model';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { cloneDeep } from '@vben/utils';

import { Form, FormItem, Input, Select } from 'ant-design-vue';
import { pick } from 'lodash-es';

// ★ 导入真实接口
import {
    libraryItemVersionAdd,
    libraryItemVersionInfo,
    libraryItemVersionUpdate,
} from '#/api/emergency/libraryItemVersion';

const emit = defineEmits<{ reload: [] }>();

// 默认值（根据实际表单字段调整）
const defaultValues: Partial<LibraryItemVersionForm> = {
    id: undefined,
    name: '',
    workflowType: undefined,
    mode: undefined,
    tags: '',
    status: 'draft', // 默认草稿
    // definitionJson 等复杂字段在加载时由接口返回
};

const formData = ref<Partial<LibraryItemVersionForm>>(cloneDeep(defaultValues));
const isUpdate = ref(false);
const title = computed(() => (isUpdate.value ? '测试编辑' : '测试新增'));

// 校验规则（按需调整）
const formRules = ref<Record<string, RuleObject[]>>({
    name: [{ required: true, message: '请输入方案名称' }],
    workflowType: [{ required: true, message: '请选择流程类型' }],
});

const { validate, validateInfos, resetFields } = Form.useForm(
    formData,
    formRules,
);

const [BasicModal, modalApi] = useVbenModal({
    class: 'w-[600px]',
    fullscreenButton: false,
    closeOnClickModal: false,
    onClosed: handleCancel,
    onConfirm: handleConfirm,
    onOpenChange: async (isOpen) => {
        if (!isOpen) return;
        modalApi.modalLoading(true);

        // 获取父组件传递的数据 { id }
        const { id } = modalApi.getData() as { id?: string };
        isUpdate.value = !!id;

        if (isUpdate.value && id) {
            try {
                // ★ 调用真实接口加载详情
                const record = await libraryItemVersionInfo(id);
                // 只取表单中需要的字段（防止多余字段干扰）
                const filterRecord = pick(record, Object.keys(defaultValues));
                formData.value = filterRecord;
                console.log('加载数据成功:', filterRecord);
            } catch (error) {
                console.error('加载数据失败', error);
                // 可弹窗提示用户
            }
        } else {
            // 新增模式：重置为默认值
            formData.value = cloneDeep(defaultValues);
        }

        modalApi.modalLoading(false);
    },
});

async function handleConfirm() {
    try {
        modalApi.modalLoading(true);
        await validate();
        const data = cloneDeep(formData.value);

        // ★ 调用新增或更新接口
        await (isUpdate.value
            ? libraryItemVersionUpdate(data)
            : libraryItemVersionAdd(data));

        // 通知父组件刷新表格
        emit('reload');
        await handleCancel();
    } catch (error) {
        console.error('提交失败', error);
    } finally {
        modalApi.modalLoading(false);
    }
}

async function handleCancel() {
    modalApi.close();
    formData.value = cloneDeep(defaultValues);
    resetFields();
}
</script>

<template>
    <BasicModal :title="title">
        <Form :label-col="{ span: 5 }" :wrapper-col="{ span: 17 }">
            <FormItem label="方案名称" v-bind="validateInfos.name">
                <Input v-model:value="formData.name" placeholder="请输入方案名称" />
            </FormItem>

            <FormItem label="流程类型" v-bind="validateInfos.workflowType">
                <Select v-model:value="formData.workflowType" placeholder="请选择流程类型" :options="[
                    { label: '急诊流程', value: 'emergency' },
                    { label: '门诊流程', value: 'outpatient' },
                    { label: '住院流程', value: 'inpatient' },
                ]" />
            </FormItem>

            <FormItem label="模式">
                <Select v-model:value="formData.mode" placeholder="请选择模式" :options="[
                    { label: '标准模式', value: 'standard' },
                    { label: '高级模式', value: 'advanced' },
                ]" />
            </FormItem>

            <FormItem label="标签">
                <Input v-model:value="formData.tags" placeholder="请输入标签，多个用逗号分隔" />
            </FormItem>

            <!-- 状态字段（编辑时显示，新增时默认草稿） -->
            <FormItem label="状态" v-if="isUpdate">
                <Select v-model:value="formData.status" placeholder="请选择状态" :options="[
                    { label: '草稿', value: 'draft' },
                    { label: '审核中', value: 'reviewing' },
                    { label: '已发布', value: 'published' },
                    { label: '已归档', value: 'archived' },
                ]" />
            </FormItem>
        </Form>
    </BasicModal>
</template>
