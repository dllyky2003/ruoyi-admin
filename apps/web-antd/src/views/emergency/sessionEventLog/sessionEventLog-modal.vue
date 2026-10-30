<!--
使用 Ant Design Vue 原生 Form 组件生成表单
详细用法参考: https://antdv.com/components/form-cn
注意: 如果 VSCode 配置了自动移除未使用的导入，可能会误删某些组件导入
-->
<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form';
import { computed, ref } from 'vue';

import { Input, Textarea, Select, RadioGroup, CheckboxGroup, DatePicker, Form, FormItem } from 'ant-design-vue';
import { ImageUpload, FileUpload } from '#/components/upload';
import { Tinymce } from '#/components/tinymce';
import { getPopupContainer } from '@vben/utils';
import { pick } from 'lodash-es';


import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { cloneDeep } from '@vben/utils';

import { useVbenForm } from '#/adapter/form';
import { sessionEventLogAdd, sessionEventLogInfo, sessionEventLogUpdate } from '#/api/emergency/sessionEventLog';
import type { SessionEventLogForm } from '#/api/emergency/sessionEventLog/model';

const emit = defineEmits<{ reload: [] }>();

const isUpdate = ref(false);
const title = computed(() => {
  return isUpdate.value ? $t('pages.common.edit') : $t('pages.common.add');
});

/**
 * 定义默认值 用于reset
 */
const defaultValues: Partial<SessionEventLogForm> = {
  id: undefined,
  deptId: undefined,
  userId: undefined,
  orderNum: undefined,
  sessionId: undefined,
  sequenceNo: undefined,
  occurredAt: undefined,
  eventType: undefined,
  sourceType: undefined,
  sourceId: undefined,
  payloadJson: undefined,
  decisionJson: undefined,
  createdAt: undefined
}

/**
 * 表单数据ref
 */
const formData = ref(defaultValues);

type AntdFormRules<T> = Partial<Record<keyof T, RuleObject[]>> & {
  [key: string]: RuleObject[];
};
/**
 * 表单校验规则
 */
const formRules = ref<AntdFormRules<SessionEventLogForm>>({
    sessionId: [
      { required: true, message: "不能为空" }
    ],
    sequenceNo: [
      { required: true, message: "不能为空" }
    ],
    occurredAt: [
      { required: true, message: "不能为空" }
    ],
    eventType: [
      { required: true, message: "不能为空" }
    ],
    sourceType: [
      { required: true, message: "device/user/asr/instructor/rule_engine/system不能为空" }
    ],
    payloadJson: [
      { required: true, message: "不能为空" }
    ],
    createdAt: [
      { required: true, message: "不能为空" }
    ]
});

/**
 * useForm解构出表单方法
 */
const { validate, validateInfos, resetFields } = Form.useForm(
  formData,
  formRules,
);

const [BasicModal, modalApi] = useVbenModal({
  class: 'w-[550px]',
  fullscreenButton: false,
  closeOnClickModal: false,
  onClosed: handleCancel,
  onConfirm: handleConfirm,
  onOpenChange: async (isOpen) => {
    if (!isOpen) {
      return null;
    }
    modalApi.modalLoading(true);

    const { id } = modalApi.getData() as { id?: number | string };
    isUpdate.value = !!id;

    if (isUpdate.value && id) {
      const record = await sessionEventLogInfo(id);
      // 只赋值存在的字段
      const filterRecord = pick(record, Object.keys(defaultValues));
      formData.value = filterRecord;
    }

    modalApi.modalLoading(false);
  },
});

async function handleConfirm() {
  try {
    modalApi.modalLoading(true);
    await validate();
    // 可能会做数据处理 使用cloneDeep深拷贝
    const data = cloneDeep(formData.value);
    await (isUpdate.value ? sessionEventLogUpdate(data) : sessionEventLogAdd(data));
    emit('reload');
    await handleCancel();
  } catch (error) {
    console.error(error);
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
    <Form :label-col="{ span: 4 }">
      <FormItem label="部门id" v-bind="validateInfos.deptId">
        <Input v-model:value="formData.deptId" :placeholder="$t('ui.formRules.required')" />
      </FormItem>
      <FormItem label="用户id" v-bind="validateInfos.userId">
        <Input v-model:value="formData.userId" :placeholder="$t('ui.formRules.required')" />
      </FormItem>
      <FormItem label="排序号" v-bind="validateInfos.orderNum">
        <Input v-model:value="formData.orderNum" :placeholder="$t('ui.formRules.required')" />
      </FormItem>
      <FormItem label="" v-bind="validateInfos.sessionId">
        <Input v-model:value="formData.sessionId" :placeholder="$t('ui.formRules.required')" />
      </FormItem>
      <FormItem label="" v-bind="validateInfos.sequenceNo">
        <Input v-model:value="formData.sequenceNo" :placeholder="$t('ui.formRules.required')" />
      </FormItem>
      <FormItem label="" v-bind="validateInfos.occurredAt">
        <!-- 日期时间选择器，可根据需求调整 format/valueFormat/showTime 等参数 -->
        <DatePicker
          v-model:value="formData.occurredAt"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="YYYY-MM-DD HH:mm:ss"
        />
      </FormItem>
      <FormItem label="" v-bind="validateInfos.sourceId">
        <Input v-model:value="formData.sourceId" :placeholder="$t('ui.formRules.required')" />
      </FormItem>
      <FormItem label="" v-bind="validateInfos.createdAt">
        <!-- 日期时间选择器，可根据需求调整 format/valueFormat/showTime 等参数 -->
        <DatePicker
          v-model:value="formData.createdAt"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="YYYY-MM-DD HH:mm:ss"
        />
      </FormItem>
    </Form>
  </BasicModal>
</template>

