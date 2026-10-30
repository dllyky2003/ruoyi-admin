<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form';
import { computed, reactive, ref } from 'vue';

import {
  Button,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import { cloneDeep } from '@vben/utils';
import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { pick } from 'lodash-es';

import { teachingCaseVersionAdd, teachingCaseVersionInfo, teachingCaseVersionUpdate } from '#/api/emergency/teachingCaseVersion';
import type { TeachingCaseVersionForm } from '#/api/emergency/teachingCaseVersion/model';

const props = defineProps<{
  /** 作为“父”病例的版本对象：编辑时为 versionId；新建时为空 */
  id?: number | string;
  /** 新建时：所属 caseId */
  caseId?: number | string;
}>();

const emit = defineEmits<{
  reload: [];
  success: [payload: { id?: number | string }];
}>();

type StageItem = {
  stageId: string;
  stageName: string;
  sequenceNo: number;
  maxDurationSec?: number;
};

type RuleItem = {
  ruleId: string;
  stageId?: string;
  ruleName: string;
  priorityNo: number;
  enabled: boolean;
};

type ScoreItem = {
  metricConfigId: string;
  libraryItemId: number;
  libraryVersionId: number;
  weight: number;
  enabled: boolean;
};

type LibraryRefItem = {
  libraryItemId: number;
  libraryVersionId: number;
  refType: string;
  jsonPath: string;
};

type ResourceRefItem = {
  resourceConfigId: string;
  libraryItemId: number;
  libraryVersionId: number;
  resourceType: string;
  enabled: boolean;
};

const isUpdate = ref(false);
const loading = ref(false);

const defaultValues: Partial<TeachingCaseVersionForm> = {
  id: undefined,
  deptId: undefined,
  userId: undefined,
  orderNum: undefined,
  caseId: props.caseId ? Number(props.caseId) : undefined,
  versionNo: undefined,
  schemaVersion: undefined,
  status: undefined,
  definitionJson: undefined,
  definitionHash: undefined,
  basedOnVersionId: undefined,
  changeSummary: undefined,
  reviewedBy: undefined,
  reviewedAt: undefined,
  publishedBy: undefined,
  publishedAt: undefined,
};

const formData = reactive<Partial<TeachingCaseVersionForm>>(cloneDeep(defaultValues));

// ========= 父子关联：把导师配置（子配置）落到 definitionJson =========
const stageItems = reactive<StageItem[]>([]);
const ruleItems = reactive<RuleItem[]>([]);
const scoreItems = reactive<ScoreItem[]>([]);
const libraryRefs = reactive<LibraryRefItem[]>([]);
const resourceRefs = reactive<ResourceRefItem[]>([]);

function safeNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const definitionJsonPreview = computed(() => {
  // 注意：真实后端字段结构以你们定义为准；这里提供一个“可配置 + 可回填”的组织方式
  return {
    stages: stageItems.map((s) => ({
      stageId: s.stageId,
      stageName: s.stageName,
      sequenceNo: s.sequenceNo,
      maxDurationSec: s.maxDurationSec ?? null,
    })),
    rules: ruleItems.map((r) => ({
      ruleId: r.ruleId,
      stageId: r.stageId ?? null,
      ruleName: r.ruleName,
      priorityNo: r.priorityNo,
      enabled: r.enabled,
    })),
    scoreIndex: scoreItems.map((x) => ({
      metricConfigId: x.metricConfigId,
      libraryItemId: x.libraryItemId,
      libraryVersionId: x.libraryVersionId,
      weight: x.weight,
      enabled: x.enabled,
    })),
    libraryRefs: libraryRefs.map((lr) => ({
      libraryItemId: lr.libraryItemId,
      libraryVersionId: lr.libraryVersionId,
      refType: lr.refType,
      jsonPath: lr.jsonPath,
    })),
    resourceRefs: resourceRefs.map((rr) => ({
      resourceConfigId: rr.resourceConfigId,
      libraryItemId: rr.libraryItemId,
      libraryVersionId: rr.libraryVersionId,
      resourceType: rr.resourceType,
      enabled: rr.enabled,
    })),
  };
});

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
  const bytes = new Uint8Array(hashBuffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ========= 表单校验（父字段） =========
const formRules = ref<Record<string, RuleObject[]>>({
  caseId: [{ required: true, message: '不能为空' }],
  versionNo: [{ required: true, message: '不能为空' }],
  schemaVersion: [{ required: true, message: '不能为空' }],
  status: [{ required: true, message: 'draft/reviewing/published/archived不能为空' }],
  changeSummary: [{ required: true, message: '不能为空' }],
});

const { validate, validateInfos, resetFields } = Form.useForm(formData as any, formRules as any);

// ========= 编辑/添加子项的弹窗 =========
const [StageModal, stageModalApi] = useVbenModal({
  class: 'w-[650px]',
  fullscreenButton: false,
  closeOnClickModal: false,
});

const stageEditState = reactive<{ mode: 'add' | 'edit'; index: number; form: StageItem }>({
  mode: 'add',
  index: -1,
  form: { stageId: '', stageName: '', sequenceNo: 1, maxDurationSec: undefined },
});

function openStageAdd() {
  stageEditState.mode = 'add';
  stageEditState.index = -1;
  stageEditState.form = { stageId: '', stageName: '', sequenceNo: 1, maxDurationSec: undefined };
  stageModalApi.open();
}

function openStageEdit(index: number) {
  stageEditState.mode = 'edit';
  stageEditState.index = index;
  stageEditState.form = cloneDeep(stageItems[index]);
  stageModalApi.open();
}

function stageUpsert() {
  const f = cloneDeep(stageEditState.form);
  if (!f.stageId || !f.stageName) {
    Modal.warning({ title: '校验失败', content: 'stageId 和 stageName 不能为空' });
    return;
  }
  if (stageEditState.mode === 'add') {
    stageItems.push({
      stageId: f.stageId,
      stageName: f.stageName,
      sequenceNo: safeNumber(f.sequenceNo),
      maxDurationSec: f.maxDurationSec === undefined ? undefined : safeNumber(f.maxDurationSec),
    });
  } else {
    stageItems.splice(stageEditState.index, 1, {
      stageId: f.stageId,
      stageName: f.stageName,
      sequenceNo: safeNumber(f.sequenceNo),
      maxDurationSec: f.maxDurationSec === undefined ? undefined : safeNumber(f.maxDurationSec),
    });
  }
  stageModalApi.close();
}

const [RuleModal, ruleModalApi] = useVbenModal({
  class: 'w-[650px]',
  fullscreenButton: false,
  closeOnClickModal: false,
});

const ruleEditState = reactive<{ mode: 'add' | 'edit'; index: number; form: RuleItem }>({
  mode: 'add',
  index: -1,
  form: { ruleId: '', stageId: undefined, ruleName: '', priorityNo: 1, enabled: true },
});

function openRuleAdd() {
  ruleEditState.mode = 'add';
  ruleEditState.index = -1;
  ruleEditState.form = { ruleId: '', stageId: undefined, ruleName: '', priorityNo: 1, enabled: true };
  ruleModalApi.open();
}

function openRuleEdit(index: number) {
  ruleEditState.mode = 'edit';
  ruleEditState.index = index;
  ruleEditState.form = cloneDeep(ruleItems[index]);
  ruleModalApi.open();
}

function ruleUpsert() {
  const f = cloneDeep(ruleEditState.form);
  if (!f.ruleId || !f.ruleName) {
    Modal.warning({ title: '校验失败', content: 'ruleId 和 ruleName 不能为空' });
    return;
  }
  const payload: RuleItem = {
    ruleId: f.ruleId,
    stageId: f.stageId ? f.stageId : undefined,
    ruleName: f.ruleName,
    priorityNo: safeNumber(f.priorityNo),
    enabled: !!f.enabled,
  };
  if (ruleEditState.mode === 'add') ruleItems.push(payload);
  else ruleItems.splice(ruleEditState.index, 1, payload);

  ruleModalApi.close();
}

const [ScoreModal, scoreModalApi] = useVbenModal({
  class: 'w-[720px]',
  fullscreenButton: false,
  closeOnClickModal: false,
});

const scoreEditState = reactive<{ mode: 'add' | 'edit'; index: number; form: ScoreItem }>({
  mode: 'add',
  index: -1,
  form: { metricConfigId: '', libraryItemId: 0, libraryVersionId: 0, weight: 1, enabled: true },
});

function openScoreAdd() {
  scoreEditState.mode = 'add';
  scoreEditState.index = -1;
  scoreEditState.form = { metricConfigId: '', libraryItemId: 0, libraryVersionId: 0, weight: 1, enabled: true };
  scoreModalApi.open();
}

function openScoreEdit(index: number) {
  scoreEditState.mode = 'edit';
  scoreEditState.index = index;
  scoreEditState.form = cloneDeep(scoreItems[index]);
  scoreModalApi.open();
}

function scoreUpsert() {
  const f = cloneDeep(scoreEditState.form);
  if (!f.metricConfigId) {
    Modal.warning({ title: '校验失败', content: 'metricConfigId 不能为空' });
    return;
  }
  const payload: ScoreItem = {
    metricConfigId: f.metricConfigId,
    libraryItemId: safeNumber(f.libraryItemId),
    libraryVersionId: safeNumber(f.libraryVersionId),
    weight: Number(f.weight),
    enabled: !!f.enabled,
  };

  if (scoreEditState.mode === 'add') scoreItems.push(payload);
  else scoreItems.splice(scoreEditState.index, 1, payload);

  scoreModalApi.close();
}

const [LibraryRefModal, libraryRefModalApi] = useVbenModal({
  class: 'w-[720px]',
  fullscreenButton: false,
  closeOnClickModal: false,
});

const libraryRefEditState = reactive<{ mode: 'add' | 'edit'; index: number; form: LibraryRefItem }>({
  mode: 'add',
  index: -1,
  form: { libraryItemId: 0, libraryVersionId: 0, refType: '', jsonPath: '' },
});

function openLibraryRefAdd() {
  libraryRefEditState.mode = 'add';
  libraryRefEditState.index = -1;
  libraryRefEditState.form = { libraryItemId: 0, libraryVersionId: 0, refType: '', jsonPath: '' };
  libraryRefModalApi.open();
}

function openLibraryRefEdit(index: number) {
  libraryRefEditState.mode = 'edit';
  libraryRefEditState.index = index;
  libraryRefEditState.form = cloneDeep(libraryRefs[index]);
  libraryRefModalApi.open();
}

function libraryRefUpsert() {
  const f = cloneDeep(libraryRefEditState.form);
  if (!f.refType || !f.jsonPath) {
    Modal.warning({ title: '校验失败', content: 'refType 和 jsonPath 不能为空' });
    return;
  }
  const payload: LibraryRefItem = {
    libraryItemId: safeNumber(f.libraryItemId),
    libraryVersionId: safeNumber(f.libraryVersionId),
    refType: f.refType,
    jsonPath: f.jsonPath,
  };
  if (libraryRefEditState.mode === 'add') libraryRefs.push(payload);
  else libraryRefs.splice(libraryRefEditState.index, 1, payload);
  libraryRefModalApi.close();
}

const [ResourceRefModal, resourceRefModalApi] = useVbenModal({
  class: 'w-[780px]',
  fullscreenButton: false,
  closeOnClickModal: false,
});

const resourceRefEditState = reactive<{ mode: 'add' | 'edit'; index: number; form: ResourceRefItem }>({
  mode: 'add',
  index: -1,
  form: { resourceConfigId: '', libraryItemId: 0, libraryVersionId: 0, resourceType: '', enabled: true },
});

function openResourceRefAdd() {
  resourceRefEditState.mode = 'add';
  resourceRefEditState.index = -1;
  resourceRefEditState.form = { resourceConfigId: '', libraryItemId: 0, libraryVersionId: 0, resourceType: '', enabled: true };
  resourceRefModalApi.open();
}

function openResourceRefEdit(index: number) {
  resourceRefEditState.mode = 'edit';
  resourceRefEditState.index = index;
  resourceRefEditState.form = cloneDeep(resourceRefs[index]);
  resourceRefModalApi.open();
}

function resourceRefUpsert() {
  const f = cloneDeep(resourceRefEditState.form);
  if (!f.resourceConfigId || !f.resourceType) {
    Modal.warning({ title: '校验失败', content: 'resourceConfigId 和 resourceType 不能为空' });
    return;
  }
  const payload: ResourceRefItem = {
    resourceConfigId: f.resourceConfigId,
    libraryItemId: safeNumber(f.libraryItemId),
    libraryVersionId: safeNumber(f.libraryVersionId),
    resourceType: f.resourceType,
    enabled: !!f.enabled,
  };
  if (resourceRefEditState.mode === 'add') resourceRefs.push(payload);
  else resourceRefs.splice(resourceRefEditState.index, 1, payload);
  resourceRefModalApi.close();
}

// ========= 通过 definitionJson 回填子项（编辑时） =========
function fillFromDefinitionJson(def: any) {
  // 允许 def 为空或格式不匹配
  stageItems.splice(0, stageItems.length);
  ruleItems.splice(0, ruleItems.length);
  scoreItems.splice(0, scoreItems.length);
  libraryRefs.splice(0, libraryRefs.length);
  resourceRefs.splice(0, resourceRefs.length);

  const stages = Array.isArray(def?.stages) ? def.stages : [];
  for (const s of stages) {
    stageItems.push({
      stageId: String(s?.stageId ?? ''),
      stageName: String(s?.stageName ?? ''),
      sequenceNo: safeNumber(s?.sequenceNo),
      maxDurationSec: s?.maxDurationSec === null || s?.maxDurationSec === undefined ? undefined : safeNumber(s?.maxDurationSec),
    });
  }

  const rules = Array.isArray(def?.rules) ? def.rules : [];
  for (const r of rules) {
    ruleItems.push({
      ruleId: String(r?.ruleId ?? ''),
      stageId: r?.stageId ? String(r.stageId) : undefined,
      ruleName: String(r?.ruleName ?? ''),
      priorityNo: safeNumber(r?.priorityNo),
      enabled: !!r?.enabled,
    });
  }

  const scoreIndex = Array.isArray(def?.scoreIndex) ? def.scoreIndex : [];
  for (const x of scoreIndex) {
    scoreItems.push({
      metricConfigId: String(x?.metricConfigId ?? ''),
      libraryItemId: safeNumber(x?.libraryItemId),
      libraryVersionId: safeNumber(x?.libraryVersionId),
      weight: Number(x?.weight ?? 1),
      enabled: !!x?.enabled,
    });
  }

  const lrefs = Array.isArray(def?.libraryRefs) ? def.libraryRefs : [];
  for (const lr of lrefs) {
    libraryRefs.push({
      libraryItemId: safeNumber(lr?.libraryItemId),
      libraryVersionId: safeNumber(lr?.libraryVersionId),
      refType: String(lr?.refType ?? ''),
      jsonPath: String(lr?.jsonPath ?? ''),
    });
  }

  const rrefs = Array.isArray(def?.resourceRefs) ? def.resourceRefs : [];
  for (const rr of rrefs) {
    resourceRefs.push({
      resourceConfigId: String(rr?.resourceConfigId ?? ''),
      libraryItemId: safeNumber(rr?.libraryItemId),
      libraryVersionId: safeNumber(rr?.libraryVersionId),
      resourceType: String(rr?.resourceType ?? ''),
      enabled: !!rr?.enabled,
    });
  }
}

async function init() {
  if (!props.id) return;
  isUpdate.value = true;
  loading.value = true;
  try {
    const record = await teachingCaseVersionInfo(props.id);
    const filterRecord = pick(record, Object.keys(defaultValues));
    Object.assign(formData, filterRecord);

    // 回填子项（definitionJson 是 json 类型）
    const def = (record as any)?.definitionJson;
    if (def) {
      // 有些后端可能把 json 作为字符串返回，这里做兼容
      const json = typeof def === 'string' ? JSON.parse(def) : def;
      fillFromDefinitionJson(json);
    }
  } finally {
    loading.value = false;
  }
}

init();

function removeStage(i: number) {
  stageItems.splice(i, 1);
}
function removeRule(i: number) {
  ruleItems.splice(i, 1);
}
function removeScore(i: number) {
  scoreItems.splice(i, 1);
}
function removeLibraryRef(i: number) {
  libraryRefs.splice(i, 1);
}
function removeResourceRef(i: number) {
  resourceRefs.splice(i, 1);
}

// ========= 保存：把子项重新组装到父的 definitionJson + definitionHash =========
async function handleSubmit() {
  try {
    loading.value = true;
    const data = cloneDeep(formData) as Partial<TeachingCaseVersionForm>;

    await validate();

    // 组装 definitionJson
    const definitionJson = cloneDeep(definitionJsonPreview.value);
    data.definitionJson = definitionJson as any;

    // 计算哈希
    const jsonStr = JSON.stringify(definitionJson);
    const hash = await sha256Hex(jsonStr);
    data.definitionHash = hash as any;

    // 兜底：新建时使用 props.caseId
    if (!data.caseId && props.caseId) data.caseId = Number(props.caseId);

    const res = isUpdate.value ? await teachingCaseVersionUpdate(data) : await teachingCaseVersionAdd(data);

    emit('reload');
    emit('success', { id: (res as any)?.id ?? data.id });
    Modal.success({ title: '保存成功', content: '病例版本及其子配置已更新' });
  } catch (e: any) {
    Modal.error({ title: '保存失败', content: e?.message || '未知错误' });
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function formatEnabled(enabled: boolean) {
  return enabled ? '启用' : '禁用';
}
</script>

<template>
  <div class="w-full p-4">
    <div class="flex items-center justify-between mb-4">
      <div>
        <div class="text-lg font-semibold">病例版本配置（父子关联配置视图）</div>
        <div class="text-sm text-gray-500">通过编辑“子配置”自动回写到病例版本的 definitionJson（并计算 definitionHash）。</div>
      </div>
      <Space>
        <Button type="primary" :loading="loading" @click="handleSubmit">
          {{ isUpdate ? '保存更新' : '保存新增' }}
        </Button>
      </Space>
    </div>

    <Collapse :default-active-key="['parent', 'stages', 'rules', 'scores', 'libs', 'resources']">
      <template #expandIconPosition>
        <span />
      </template>

      <Collapse.Panel key="parent" header="父级：病例版本（TeachingCaseVersion）">
        <Form :label-col="{ span: 4 }" :wrapper-col="{ span: 18 }">
          <FormItem label="deptId" v-bind="validateInfos.deptId">
            <Input v-model:value="formData.deptId" :placeholder="$t('ui.formRules.required')" />
          </FormItem>
          <FormItem label="userId" v-bind="validateInfos.userId">
            <Input v-model:value="formData.userId" :placeholder="$t('ui.formRules.required')" />
          </FormItem>
          <FormItem label="orderNum" v-bind="validateInfos.orderNum">
            <InputNumber v-model:value="formData.orderNum" style="width: 100%" />
          </FormItem>
          <FormItem label="caseId" v-bind="validateInfos.caseId">
            <Input v-model:value="formData.caseId" :disabled="!!props.id || !!props.caseId" />
          </FormItem>
          <FormItem label="versionNo" v-bind="validateInfos.versionNo">
            <Input v-model:value="formData.versionNo" />
          </FormItem>
          <FormItem label="schemaVersion" v-bind="validateInfos.schemaVersion">
            <Input v-model:value="formData.schemaVersion" />
          </FormItem>
          <FormItem label="status" v-bind="validateInfos.status">
            <Input v-model:value="formData.status" placeholder="draft/reviewing/published/archived" />
          </FormItem>
          <FormItem label="basedOnVersionId">
            <Input v-model:value="formData.basedOnVersionId" />
          </FormItem>
          <FormItem label="changeSummary" v-bind="validateInfos.changeSummary">
            <Input.TextArea v-model:value="formData.changeSummary" :rows="4" />
          </FormItem>
          <FormItem label="reviewedBy">
            <Input v-model:value="formData.reviewedBy" />
          </FormItem>
          <FormItem label="reviewedAt">
            <Input v-model:value="formData.reviewedAt" />
          </FormItem>
          <FormItem label="publishedBy">
            <Input v-model:value="formData.publishedBy" />
          </FormItem>
          <FormItem label="publishedAt">
            <Input v-model:value="formData.publishedAt" />
          </FormItem>

          <div class="mt-3">
            <div class="text-sm font-medium">definitionJson 预览（由下面各子配置自动生成）</div>
            <div class="mt-2 max-h-48 overflow-auto rounded border p-2 text-xs bg-gray-50">
              {{ JSON.stringify(definitionJsonPreview, null, 2) }}
            </div>
          </div>
        </Form>
      </Collapse.Panel>

      <Collapse.Panel key="stages" header="子级：阶段阶段索引（Stage Index）">
        <div class="flex justify-between items-center mb-2">
          <div class="text-sm text-gray-600">配置病例版本的阶段编排（sequence_no、max_duration_sec 等）。</div>
          <Button @click="openStageAdd">新增阶段</Button>
        </div>

        <Table :data-source="stageItems" row-key="stageId" :pagination="false">
          <template #columns>
            <Table.Column title="stageId" data-index="stageId" />
            <Table.Column title="stageName" data-index="stageName" />
            <Table.Column title="sequenceNo" data-index="sequenceNo" />
            <Table.Column title="maxDurationSec" data-index="maxDurationSec">
              <template #default="{ text }">{{ text ?? '-' }}</template>
            </Table.Column>
            <Table.Column title="enabled" data-index="stageId">
              <template #default> <Tag color="blue">固定</Tag> </template>
            </Table.Column>
            <Table.Column title="操作" key="actions">
              <template #default="_, __, index">
                <Space>
                  <Button size="small" @click="openStageEdit(index)">编辑</Button>
                  <Button size="small" danger @click="removeStage(index)">删除</Button>
                </Space>
              </template>
            </Table.Column>
          </template>
        </Table>
      </Collapse.Panel>

      <Collapse.Panel key="rules" header="子级：规则索引（Rule Index）">
        <div class="flex justify-between items-center mb-2">
          <div class="text-sm text-gray-600">配置规则、关联阶段（可选）、以及优先级/启用开关。</div>
          <Button @click="openRuleAdd">新增规则</Button>
        </div>

        <Table :data-source="ruleItems" row-key="ruleId" :pagination="false">
          <template #columns>
            <Table.Column title="ruleId" data-index="ruleId" />
            <Table.Column title="ruleName" data-index="ruleName" />
            <Table.Column title="stageId">
              <template #default="{ stageId }">{{ stageId ?? '-' }}</template>
            </Table.Column>
            <Table.Column title="priorityNo" data-index="priorityNo" />
            <Table.Column title="enabled">
              <template #default="{ enabled }">
                <Tag :color="enabled ? 'green' : 'red'">{{ formatEnabled(enabled) }}</Tag>
              </template>
            </Table.Column>
            <Table.Column title="操作" key="actions">
              <template #default="_, __, index">
                <Space>
                  <Button size="small" @click="openRuleEdit(index)">编辑</Button>
                  <Button size="small" danger @click="removeRule(index)">删除</Button>
                </Space>
              </template>
            </Table.Column>
          </template>
        </Table>
      </Collapse.Panel>

      <Collapse.Panel key="scores" header="子级：评分项索引（Score Index）">
        <div class="flex justify-between items-center mb-2">
          <div class="text-sm text-gray-600">配置指标来源（library_item/library_version）与权重。</div>
          <Button @click="openScoreAdd">新增评分项</Button>
        </div>

        <Table :data-source="scoreItems" row-key="metricConfigId" :pagination="false">
          <template #columns>
            <Table.Column title="metricConfigId" data-index="metricConfigId" />
            <Table.Column title="libraryItemId" data-index="libraryItemId" />
            <Table.Column title="libraryVersionId" data-index="libraryVersionId" />
            <Table.Column title="weight" data-index="weight" />
            <Table.Column title="enabled">
              <template #default="{ enabled }">
                <Tag :color="enabled ? 'green' : 'red'">{{ formatEnabled(enabled) }}</Tag>
              </template>
            </Table.Column>
            <Table.Column title="操作" key="actions">
              <template #default="_, __, index">
                <Space>
                  <Button size="small" @click="openScoreEdit(index)">编辑</Button>
                  <Button size="small" danger @click="removeScore(index)">删除</Button>
                </Space>
              </template>
            </Table.Column>
          </template>
        </Table>
      </Collapse.Panel>

      <Collapse.Panel key="libs" header="子级：公共库引用（Library Refs）">
        <div class="flex justify-between items-center mb-2">
          <div class="text-sm text-gray-600">配置病例版本引用哪些公共库版本（用于影响分析/发布校验）。</div>
          <Button @click="openLibraryRefAdd">新增引用</Button>
        </div>

        <Table :data-source="libraryRefs" row-key="jsonPath" :pagination="false">
          <template #columns>
            <Table.Column title="libraryItemId" data-index="libraryItemId" />
            <Table.Column title="libraryVersionId" data-index="libraryVersionId" />
            <Table.Column title="refType" data-index="refType" />
            <Table.Column title="jsonPath" data-index="jsonPath" />
            <Table.Column title="操作" key="actions">
              <template #default="_, __, index">
                <Space>
                  <Button size="small" @click="openLibraryRefEdit(index)">编辑</Button>
                  <Button size="small" danger @click="removeLibraryRef(index)">删除</Button>
                </Space>
              </template>
            </Table.Column>
          </template>
        </Table>
      </Collapse.Panel>

      <Collapse.Panel key="resources" header="子级：资源配置映射（Resource Refs）">
        <div class="flex justify-between items-center mb-2">
          <div class="text-sm text-gray-600">配置病例版本需要的资源配置与公共库版本映射。</div>
          <Button @click="openResourceRefAdd">新增资源映射</Button>
        </div>

        <Table :data-source="resourceRefs" row-key="resourceConfigId" :pagination="false">
          <template #columns>
            <Table.Column title="resourceConfigId" data-index="resourceConfigId" />
            <Table.Column title="resourceType" data-index="resourceType" />
            <Table.Column title="libraryItemId" data-index="libraryItemId" />
            <Table.Column title="libraryVersionId" data-index="libraryVersionId" />
            <Table.Column title="enabled">
              <template #default="{ enabled }">
                <Tag :color="enabled ? 'green' : 'red'">{{ formatEnabled(enabled) }}</Tag>
              </template>
            </Table.Column>
            <Table.Column title="操作" key="actions">
              <template #default="_, __, index">
                <Space>
                  <Button size="small" @click="openResourceRefEdit(index)">编辑</Button>
                  <Button size="small" danger @click="removeResourceRef(index)">删除</Button>
                </Space>
              </template>
            </Table.Column>
          </template>
        </Table>
      </Collapse.Panel>
    </Collapse>

    <!-- Stage Modal -->
    <StageModal title="编辑阶段" @confirm="stageUpsert" @cancel="stageModalApi.close">
      <div class="space-y-3">
        <Form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
          <FormItem label="stageId">
            <Input v-model:value="stageEditState.form.stageId" />
          </FormItem>
          <FormItem label="stageName">
            <Input v-model:value="stageEditState.form.stageName" />
          </FormItem>
          <FormItem label="sequenceNo">
            <InputNumber v-model:value="stageEditState.form.sequenceNo" style="width: 100%" />
          </FormItem>
          <FormItem label="maxDurationSec">
            <InputNumber v-model:value="stageEditState.form.maxDurationSec" style="width: 100%" />
          </FormItem>
        </Form>
      </div>
    </StageModal>

    <!-- Rule Modal -->
    <RuleModal title="编辑规则" @confirm="ruleUpsert" @cancel="ruleModalApi.close">
      <Form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
        <FormItem label="ruleId">
          <Input v-model:value="ruleEditState.form.ruleId" />
        </FormItem>
        <FormItem label="ruleName">
          <Input v-model:value="ruleEditState.form.ruleName" />
        </FormItem>
        <FormItem label="stageId">
          <Input v-model:value="ruleEditState.form.stageId" placeholder="可为空表示全局规则" />
        </FormItem>
        <FormItem label="priorityNo">
          <InputNumber v-model:value="ruleEditState.form.priorityNo" style="width: 100%" />
        </FormItem>
        <FormItem label="enabled">
          <Switch v-model:checked="ruleEditState.form.enabled" />
        </FormItem>
      </Form>
    </RuleModal>

    <!-- Score Modal -->
    <ScoreModal title="编辑评分项" @confirm="scoreUpsert" @cancel="scoreModalApi.close">
      <Form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }">
        <FormItem label="metricConfigId">
          <Input v-model:value="scoreEditState.form.metricConfigId" />
        </FormItem>
        <FormItem label="libraryItemId">
          <InputNumber v-model:value="scoreEditState.form.libraryItemId" style="width: 100%" />
        </FormItem>
        <FormItem label="libraryVersionId">
          <InputNumber v-model:value="scoreEditState.form.libraryVersionId" style="width: 100%" />
        </FormItem>
        <FormItem label="weight">
          <InputNumber v-model:value="scoreEditState.form.weight" :step="0.1" style="width: 100%" />
        </FormItem>
        <FormItem label="enabled">
          <Switch v-model:checked="scoreEditState.form.enabled" />
        </FormItem>
      </Form>
    </ScoreModal>

    <!-- LibraryRef Modal -->
    <LibraryRefModal title="编辑公共库引用" @confirm="libraryRefUpsert" @cancel="libraryRefModalApi.close">
      <Form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }">
        <FormItem label="libraryItemId">
          <InputNumber v-model:value="libraryRefEditState.form.libraryItemId" style="width: 100%" />
        </FormItem>
        <FormItem label="libraryVersionId">
          <InputNumber v-model:value="libraryRefEditState.form.libraryVersionId" style="width: 100%" />
        </FormItem>
        <FormItem label="refType">
          <Input v-model:value="libraryRefEditState.form.refType" />
        </FormItem>
        <FormItem label="jsonPath">
          <Input v-model:value="libraryRefEditState.form.jsonPath" placeholder="例如 $.rules[0]" />
        </FormItem>
      </Form>
    </LibraryRefModal>

    <!-- ResourceRef Modal -->
    <ResourceRefModal title="编辑资源映射" @confirm="resourceRefUpsert" @cancel="resourceRefModalApi.close">
      <Form :label-col="{ span: 10 }" :wrapper-col="{ span: 14 }">
        <FormItem label="resourceConfigId">
          <Input v-model:value="resourceRefEditState.form.resourceConfigId" />
        </FormItem>
        <FormItem label="resourceType">
          <Input v-model:value="resourceRefEditState.form.resourceType" />
        </FormItem>
        <FormItem label="libraryItemId">
          <InputNumber v-model:value="resourceRefEditState.form.libraryItemId" style="width: 100%" />
        </FormItem>
        <FormItem label="libraryVersionId">
          <InputNumber v-model:value="resourceRefEditState.form.libraryVersionId" style="width: 100%" />
        </FormItem>
        <FormItem label="enabled">
          <Switch v-model:checked="resourceRefEditState.form.enabled" />
        </FormItem>
      </Form>
    </ResourceRefModal>
  </div>
</template>
