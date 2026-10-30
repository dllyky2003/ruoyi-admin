<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { AnalysisChartCard } from '@vben/common-ui';
import { DictEnum } from '@vben/constants';

import { getDictOptions } from '#/utils/dict';

const props = defineProps<{
  data?: any;
}>();

const emit = defineEmits<{
  (e: 'ai-generate'): void;
}>();

// ==================== 表单数据 ====================
const form = ref({
  name: '',
  workflowType: '',
  mode: '',
  tags: '',
  summary: '', // 对应 description
  guideline: '', // 仅用于显示，不存储
  status: '',
  versionNo: 0,
  sourceGuideline: '',
  sourceVersion: '',
  sopRef: '',
  guidelineVersion: '',
  sex: '男',
  age: 18,
  learningObjectives: '',
  estimatedDurationMinutes: 20,
  difficultyLevel: '',
});

// ==================== 选项数据 ====================
const difficultyOptions = ['初级', '中级', '高级'];
const teachingplanTypeOptions = getDictOptions(DictEnum.EMS_TEACHING_PLAN_TYPE);

// ==================== 判断数据是否已加载 ====================
const isLoaded = computed(() => {
  return props.data && props.data.id && props.data.id > 0;
});

// ==================== 数据映射（初始化表单） ====================
function mapDataToForm() {
  if (!props.data || !props.data.id) return;

  const def = props.data.definitionJson || {};
  const caseMeta = def.caseMeta || {};
  const basic = def.basic || {};

  form.value = {
    name: props.data.name || '',
    workflowType: props.data.workflowType || '',
    mode: props.data.mode || '',
    tags: props.data.tags || '',
    status: props.data.status || 'draft',
    versionNo: props.data.versionNo || 0,
    sourceGuideline: props.data.sourceGuideline || '',
    sourceVersion: props.data.sourceVersion || '',
    sex: props.data.sex || caseMeta.sex || basic.sex || '',
    age: props.data.age ?? caseMeta.age ?? basic.age ?? 0,
    difficultyLevel: props.data.difficultyLevel,
    estimatedDurationMinutes: props.data.estimatedDurationMinutes,
    learningObjectives: props.data.learningObjectives,
    sopRef: props.data.sopRef || caseMeta.sopRef || basic.sopRef || '',
    guidelineVersion:
      props.data.guidelineVersion ||
      caseMeta.guidelineVersion ||
      basic.guidelineVersion ||
      '',
    summary: props.data.description || '',
    guideline:
      props.data.sourceGuideline && props.data.sourceVersion
        ? `${props.data.sourceGuideline} · ${props.data.sourceVersion}`
        : '未配置',
  };
}

// ==================== 监听 ID 变化重新初始化 ====================
watch(
  () => props.data?.id,
  (newId, oldId) => {
    if (newId && newId > 0 && newId !== oldId) {
      mapDataToForm();
    }
  },
  { immediate: true },
);

// ==================== 暴露 getData 给父组件 ====================
function getData() {
  return {
    id: props.data?.id,
    name: form.value.name,
    workflowType: form.value.workflowType,
    mode: form.value.mode,
    tags: form.value.tags,
    status: form.value.status,
    versionNo: form.value.versionNo,
    sourceGuideline: form.value.sourceGuideline,
    sourceVersion: form.value.sourceVersion,
    description: form.value.summary,
    learningObjectives: form.value.learningObjectives,
    difficultyLevel: form.value.difficultyLevel,
    estimatedDurationMinutes: form.value.estimatedDurationMinutes,
    sex: form.value.sex,
    age: form.value.age,
    sopRef: form.value.sopRef,
    guidelineVersion: form.value.guidelineVersion,
  };
}

defineExpose({ getData });

// ==================== 状态标签辅助 ====================
const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    draft: '草稿',
    reviewing: '审核中',
    published: '已发布',
    archived: '已归档',
  };
  return map[status] || status;
};

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-700',
    reviewing: 'bg-blue-100 text-blue-700',
    published: 'bg-emerald-100 text-emerald-700',
    archived: 'bg-gray-100 text-gray-700',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
};

const handleAIGenerate = () => {
  emit('ai-generate');
};
</script>

<template>
  <div class="basic-info-page">
    <!-- 页面标题 + AI 按钮 -->
    <div class="mb-5 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">基本信息</h2>
        <p class="text-muted-foreground mt-1 text-sm">
          定义病例用途、适用范围及发布时需要冻结的临床依据。
        </p>
      </div>
      <button @click="handleAIGenerate"
        class="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary/50 rounded-lg px-6 py-2.5 text-sm font-semibold shadow-md transition focus:outline-none focus:ring-2">
        <span class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path
              d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            <circle cx="12" cy="12" r="4" />
          </svg>
          AI 生成案例草稿
        </span>
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="!isLoaded" class="flex justify-center py-10">
      <span class="text-muted-foreground">加载中...</span>
    </div>

    <!-- 内容 -->
    <template v-else>
      <!-- 版本状态信息 -->
      <div class="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm">
        <span class="font-medium">版本状态：</span>
        <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="getStatusColor(form.status)">
          {{ getStatusLabel(form.status) }}
        </span>
        <span class="text-muted-foreground">|</span>
        <span class="font-medium">版本号：</span>
        <span>V{{ form.versionNo }}.0</span>
        <span class="text-muted-foreground">|</span>
        <span class="font-medium">预计时长：</span>
        <span>{{ form.estimatedDurationMinutes }} 分钟</span>
      </div>

      <!-- 病例标识与教学定位 -->
      <AnalysisChartCard title="病例标识与教学定位">
        <div class="grid gap-5 md:grid-cols-1">
          <label class="field">
            病例名称
            <input v-model="form.name" placeholder="请输入病例名称" />
          </label>
        </div>
        <div class="mt-4 grid gap-5 md:grid-cols-4">
          <label class="field">
            患者性别
            <div class="flex flex-wrap gap-3 pt-1">
              <label class="flex items-center gap-1.5 text-sm font-normal">
                <input type="radio" value="男" v-model="form.sex" class="accent-primary h-4 w-4" />
                男
              </label>
              <label class="flex items-center gap-1.5 text-sm font-normal">
                <input type="radio" value="女" v-model="form.sex" class="accent-primary h-4 w-4" />
                女
              </label>
            </div>
          </label>

          <label class="field">
            患者年龄（岁）
            <input v-model.number="form.age" type="number" min="0" max="120" placeholder="请输入年龄" />
          </label>

          <label class="field">
            主流程类型
            <select v-model="form.workflowType">
              <option v-for="opt in teachingplanTypeOptions" :key="opt.dictCode" :value="opt.dictValue">
                {{ opt.dictLabel }}
              </option>
            </select>
          </label>

          <label class="field">
            难度等级
            <select v-model="form.difficultyLevel">
              <option value="">请选择</option>
              <option v-for="opt in difficultyOptions" :key="opt" :value="opt">
                {{ opt }}
              </option>
            </select>
          </label>

          <label class="field">
            预计时长（分钟）
            <input v-model.number="form.estimatedDurationMinutes" type="number" min="0" placeholder="请输入分钟数" />
          </label>

          <label class="field">
            适用模式
            <input v-model="form.mode" placeholder="如：团队仿真 + 导师复盘" />
          </label>

          <label class="field">
            教学标签
            <input v-model="form.tags" placeholder="用逗号分隔，如：STEMI, VF/pVT, 除颤" />
          </label>

          <label class="field md:col-span-4">
            学习目标
            <textarea v-model="form.learningObjectives" rows="4" placeholder="请输入学习目标描述"></textarea>
          </label>
        </div>
      </AnalysisChartCard>

      <!-- 指南与 SOP 冻结信息 -->
      <AnalysisChartCard class="mt-5" title="指南与 SOP 冻结信息">
        <div class="grid gap-5 md:grid-cols-4">
          <label class="field">
            依据指南
            <input v-model="form.sourceGuideline" placeholder="如：AHA ACLS 2025" />
          </label>

          <label class="field">
            指南版本
            <input v-model="form.guidelineVersion" placeholder="如：2025.1" />
          </label>

          <label class="field">
            SOP 引用
            <input v-model="form.sopRef" placeholder="如：ems_arrest_sop_2025" />
          </label>

          <label class="field">
            来源版本
            <input v-model="form.sourceVersion" placeholder="请输入来源版本" />
          </label>
        </div>

        <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <b>发布锁定：</b>
          {{ form.guideline || '未配置指南' }}。 发布后本版本不可被模块库或 AI
          草稿自动覆盖。
        </div>
      </AnalysisChartCard>
    </template>
  </div>
</template>

<style scoped>
.field {
  @apply text-foreground grid gap-1.5 text-sm font-medium;
}

.field input,
.field select,
.field textarea {
  @apply border-border bg-background focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 text-sm font-normal outline-none transition-colors focus:ring-1;
}
</style>
