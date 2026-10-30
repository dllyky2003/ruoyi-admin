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
import { teachingCaseAdd, teachingCaseInfo, teachingCaseUpdate } from '#/api/emergency/teachingCase';
import type { TeachingCaseForm } from '#/api/emergency/teachingCase/model';

const emit = defineEmits<{ reload: [] }>();

const isUpdate = ref(false);
const title = computed(() => {
  return isUpdate.value ? $t('pages.common.edit') : $t('pages.common.add');
});

/**
 * 定义默认值 用于reset
 */
const defaultValues: Partial<TeachingCaseForm> = {
  id: undefined,
  deptId: undefined,
  userId: undefined,
  orderNum: undefined,
  caseCode: undefined,
  organizationId: undefined,
  name: undefined,
  status: undefined,
  currentPublishedVersionId: undefined
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
const formRules = ref<AntdFormRules<TeachingCaseForm>>({
    caseCode: [
      { required: true, message: "不能为空" }
    ],
    organizationId: [
      { required: true, message: "机构/单位隔离维度不能为空" }
    ],
    name: [
      { required: true, message: "不能为空" }
    ],
    status: [
      { required: true, message: "不能为空" }
    ],
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
      const record = await teachingCaseInfo(id);
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
    await (isUpdate.value ? teachingCaseUpdate(data) : teachingCaseAdd(data));
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
      <FormItem label="" v-bind="validateInfos.caseCode">
        <Input v-model:value="formData.caseCode" :placeholder="$t('ui.formRules.required')" />
      </FormItem>
      <FormItem label="机构/单位隔离维度" v-bind="validateInfos.organizationId">
        <Input v-model:value="formData.organizationId" :placeholder="$t('ui.formRules.required')" />
      </FormItem>
      <FormItem label="" v-bind="validateInfos.name">
        <Input v-model:value="formData.name" :placeholder="$t('ui.formRules.required')" />
      </FormItem>
      <FormItem label="" v-bind="validateInfos.currentPublishedVersionId">
        <Input v-model:value="formData.currentPublishedVersionId" :placeholder="$t('ui.formRules.required')" />
      </FormItem>
    </Form>
  </BasicModal>
</template>

