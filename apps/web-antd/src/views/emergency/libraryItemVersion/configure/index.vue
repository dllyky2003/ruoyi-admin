<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

// ==================== 导入子组件 ====================
import BasicInfoPage from './components/basic-info-page.vue';
import ClinicalContextPage from './components/clinical-context-page.vue';
import InterviewModulesPage from './components/interview-modules-page.vue';
import MedicationHistoryPage from './components/medication-history-page.vue';
import PhysicalExamPage from './components/physical-exam-page.vue';
import RescueResourcesPage from './components/rescue-resources-page.vue';
import StagePage from './components/stage-events-page.vue';
import ValidationPublishPage from './components/validation-publish-page.vue';
// ==================== 数据加载 Composable ====================
import {
  emergencyLibraryItemVersionInfo,
  loadLibraryItemVersionInfo,
  saveLibraryItemVersionInfo,
} from './composables/LoadLibraryItemVersionData';
import { doGenerateDraft } from './composables/useAIGenerate';

// ==================== ★ 用 useVbenModal 替代 defineProps/defineEmits ====================
const [BasicModal, modalApi] = useVbenModal({
  // 弹窗打开时触发，从 modalApi.getData() 拿父组件传入的 id
  onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData<{ id?: number | string }>();
    if (data?.id) {
      versionId.value = String(data.id);
      loadData();
    } else {
      message.warning('缺少版本ID参数');
    }
  },

  // 点击底部"确定"按钮时触发，绑定到保存草稿
  async onConfirm() {
    await saveDraft();
  },

  // 点击底部"取消"按钮时触发
  onCancel() {
    modalApi.close();
  },
});

// ==================== 版本ID（原来来自 props.id，现在改为本地 ref） ====================
const versionId = ref('');

// 加载状态
const loading = ref(false);

// 提取数据对象（从数组中取第一个）
const dataRaw = computed(() => {
  return emergencyLibraryItemVersionInfo.value[0] || null;
});

// 加载数据
const loadData = async () => {
  const id = versionId.value;
  if (!id) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    await loadLibraryItemVersionInfo(id);
  } catch (error) {
    console.error('加载失败:', error);
    message.error('加载方案详情失败');
  } finally {
    loading.value = false;
  }
};

// ==================== 生命周期 & 监听 ====================
onMounted(() => {
  // 加载逻辑已移至 onOpenChange，此处不再主动加载
});

// 监听 id 变化，重新加载（兜底）
watch(versionId, (newId) => {
  if (newId && emergencyLibraryItemVersionInfo.value.length === 0) {
    loadData();
  }
});

// ==================== 页面状态 ====================
const activeStep = ref<CaseStep>('basic');
const saveStatus = ref('已保存 14:32');
const showPreview = ref(false);
const showPublishConfirm = ref(false);

// AI 生成加载遮罩状态
const showAILoading = ref(false);

// ==================== 导航配置 ====================
type CaseStep =
  | 'basic'
  | 'clinical'
  | 'interview'
  | 'medicationHistoryPage'
  | 'physical'
  | 'resources'
  | 'stages'
  | 'validation';

const steps: Array<{ key: CaseStep; label: string; number: number }> = [
  { key: 'basic', label: '基本信息', number: 1 },
  { key: 'clinical', label: '临床情境与初始状态', number: 2 },
  { key: 'physical', label: '重点查体·心肺血管', number: 3 },
  { key: 'medicationHistoryPage', label: '药物与过敏史', number: 4 },
  { key: 'interview', label: '问诊模块与角色', number: 5 },
  { key: 'stages', label: '阶段与事件', number: 6 },
  { key: 'resources', label: '抢救资源与医嘱', number: 7 },
  { key: 'validation', label: '校验与发布', number: 8 },
];

// ==================== 子组件 refs ====================
const basicRef = ref<InstanceType<typeof BasicInfoPage>>();
const clinicalRef = ref<InstanceType<typeof ClinicalContextPage>>();
const physicalRef = ref<InstanceType<typeof PhysicalExamPage>>();
const medicationRef = ref<InstanceType<typeof MedicationHistoryPage>>();
const interviewRef = ref<InstanceType<typeof InterviewModulesPage>>();
const resourcesRef = ref<InstanceType<typeof RescueResourcesPage>>();
const stageRef = ref<InstanceType<typeof StagePage>>();
const validationRef = ref<InstanceType<typeof ValidationPublishPage>>();

// ==================== 公共 props ====================
const pageProps = computed(() => ({ data: dataRaw.value }));

// ==================== 收集所有页面数据 ====================
function collectAllData() {
  const basicData = basicRef.value?.getData?.() || {};
  const clinicalData = clinicalRef.value?.getData?.() || {};
  const physicalData = physicalRef.value?.getData?.() || {};
  const medicationData = medicationRef.value?.getData?.() || {};
  const interviewData = interviewRef.value?.getData?.() || {};
  const resourcesData = resourcesRef.value?.getData?.() || {};
  const stageData = stageRef.value?.getData?.() || {};
  const validationData = validationRef.value?.getData?.() || {};

  return {
    basic: basicData,
    clinical: clinicalData,
    physical: physicalData,
    medication: medicationData,
    interview: interviewData,
    resources: resourcesData,
    stages: stageData,
    validation: validationData,
  };
}

async function saveDraft() {
  // 1. 校验版本ID
  const id = Number(versionId.value);
  if (Number.isNaN(id) || id <= 0) {
    message.error('无效的版本ID，请重新加载页面');
    return;
  }

  // 2. 收集所有子组件数据
  const payload = collectAllData();
  const basic = payload.basic || {};
  const current = dataRaw.value;

  // 3. 构建完整的请求对象
  const fullPayload: EmergencyLibraryItemVersion = {
    id,
    name: basic.name ?? current?.name,
    workflowType: basic.workflowType ?? current?.workflowType,
    mode: basic.mode ?? current?.mode,
    tags: basic.tags ?? current?.tags,
    sex: basic.sex ?? current?.sex,
    age: basic.age ?? current?.age,
    difficultyLevel: basic.difficultyLevel ?? current?.difficultyLevel,
    estimatedDurationMinutes:
      basic.estimatedDurationMinutes ?? current?.estimatedDurationMinutes,
    teachingplanTypeOptions: basic?.teachingplanTypeOptions,
    learningObjectives: basic?.learningObjectives,
    definitionJson: payload.definitionJson ?? payload,
  };

  // 4. 清理 undefined
  Object.keys(fullPayload).forEach((key) => {
    const k = key as keyof EmergencyLibraryItemVersion;
    if (fullPayload[k] === undefined) {
      delete fullPayload[k];
    }
  });

  // 5. 调试：打印提交数据
  console.log('提交数据：', JSON.stringify(fullPayload, null, 2));

  // 6. 调用保存接口
  saveStatus.value = '正在保存…';
  try {
    await saveLibraryItemVersionInfo(fullPayload);
    message.success('保存成功');
    saveStatus.value = '已保存';

    // ★ 用 modalApi.emit 通知父组件刷新
    modalApi.emit('reload', { success: true });
  } catch (error: any) {
    console.error('保存失败详情:', error);
    const errMsg =
      error?.message || error?.msg || '保存失败，请检查控制台错误信息';
    message.error(errMsg);
    saveStatus.value = '保存失败';
  }
}

// ==================== AI 生成事件处理 ====================
const handleAIGenerate = async () => {
  showAILoading.value = true;
  try {
    const currentBasicData = dataRaw.value;
    const caseName = currentBasicData?.name;
    const sex = currentBasicData?.sex;
    const age = currentBasicData?.age;
    const mainFlowType = currentBasicData?.workflowType;
    const difficultyLevel = currentBasicData?.difficultyLevel;
    const estimatedDurationMinutes = currentBasicData?.estimatedDurationMinutes;
    const learningObjectives = currentBasicData?.learningObjectives;
    const modelName = 'qwen2.5:latest';

    const draftData = await doGenerateDraft({
      caseName,
      sex,
      age,
      mainFlowType,
      difficultyLevel,
      estimatedDurationMinutes,
      learningObjectives,
      modelName,
    });

    if (draftData) {
      if (emergencyLibraryItemVersionInfo.value.length > 0) {
        emergencyLibraryItemVersionInfo.value[0] = {
          ...emergencyLibraryItemVersionInfo.value[0],
          ...draftData,
        };
      } else {
        emergencyLibraryItemVersionInfo.value = [draftData];
      }
      saveStatus.value = 'AI 生成成功';
      activeStep.value = 'basic';
      message.success('AI 案例草稿生成成功！');
    } else {
      saveStatus.value = '生成失败';
    }
  } catch (error) {
    console.error('AI 生成异常:', error);
    saveStatus.value = '生成异常';
    message.error('AI 生成过程发生异常，请重试');
  } finally {
    showAILoading.value = false;
  }
};

// ==================== 辅助函数 ====================
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

// ==================== 暴露方法（可选） ====================
defineExpose({
  loadData,
  reload: loadData,
  collectAllData,
});
</script>

<template>
  <!-- ★ 用 BasicModal 包裹，弹窗宽度 1200px，内容区自动滚动 -->
  <BasicModal title="配置方案" class="w-[1600px]" ">
    <div class=" configure-dialog-container">
    <!-- 顶部标题栏与操作按钮 -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
      <div class="flex items-center gap-3">
        <span class="text-lg font-semibold">
          {{ dataRaw ? dataRaw.title || '未命名' : '加载中...' }}
        </span>
        <span v-if="dataRaw?.status" class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
          :class="getStatusColor(dataRaw.status)">
          {{ getStatusLabel(dataRaw.status) }} · v{{
            dataRaw.versionNo || 1
          }}.0
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-emerald-600">● {{ saveStatus }}</span>
        <button class="btn-secondary" @click="saveDraft">保存草稿</button>
        <button class="btn-outline" @click="showPreview = true">预览</button>
        <button class="btn-primary" @click="showPublishConfirm = true">
          发布版本
        </button>
      </div>
    </div>

    <!-- 主体布局 -->
    <div class="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside class="bg-card ring-border h-fit rounded-lg p-3 shadow-sm ring-1">
        <div class="border-border border-b px-3 pb-4 pt-2">
          <p class="text-foreground font-semibold">
            {{ dataRaw?.title || '未命名方案' }}
          </p>
          <span v-if="dataRaw?.status" class="mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
            :class="getStatusColor(dataRaw.status)">
            {{ getStatusLabel(dataRaw.status) }} · v{{
              dataRaw.versionNo || 1
            }}.0
          </span>
          <span v-else class="mt-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            加载中...
          </span>
        </div>
        <nav class="mt-3 space-y-1" aria-label="病例配置步骤">
          <button v-for="step in steps" :key="step.key" class="step-nav"
            :class="{ 'step-nav-active': activeStep === step.key }" @click="activeStep = step.key">
            <span class="text-muted-foreground w-5 text-xs">{{
              step.number
            }}</span>
            {{ step.label }}
          </button>
        </nav>
        <div class="border-border mt-4 grid gap-1 border-t px-2 pt-4 text-sm">
          <button class="side-action text-primary" @click="handleAIGenerate">
            ✦ AI 生成病例草稿
          </button>
          <button class="side-action text-primary" @click="() => { }">
            📂预设库
          </button>
          <button class="side-action" @click="saveDraft">⇩ 导出 JSON</button>
          <button class="side-action">▣ 保存为模板</button>
        </div>
      </aside>

      <main class="min-w-0">
        <BasicInfoPage v-show="activeStep === 'basic'" ref="basicRef" v-bind="pageProps"
          @ai-generate="handleAIGenerate" />
        <ClinicalContextPage v-show="activeStep === 'clinical'" ref="clinicalRef" v-bind="pageProps" />
        <PhysicalExamPage v-show="activeStep === 'physical'" ref="physicalRef" v-bind="pageProps" />
        <MedicationHistoryPage v-show="activeStep === 'medicationHistoryPage'" ref="medicationRef" v-bind="pageProps" />
        <InterviewModulesPage v-show="activeStep === 'interview'" ref="interviewRef" v-bind="pageProps" />
        <RescueResourcesPage v-show="activeStep === 'resources'" ref="resourcesRef" v-bind="pageProps" />
        <StagePage v-show="activeStep === 'stages'" ref="stageRef" :data="dataRaw" />
        <ValidationPublishPage v-show="activeStep === 'validation'" ref="validationRef" v-bind="pageProps" />
      </main>
    </div>

    <!-- AI 生成遮罩（z-index 高于 BasicModal） -->
    <Teleport to="body">
      <div v-if="showAILoading" class="modal-backdrop" style="z-index: 9999">
        <div class="ai-loading-panel">
          <div class="ai-loading-spinner">
            <svg class="text-primary h-12 w-12 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none"
              viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p class="text-foreground mt-4 text-lg font-semibold">
            AI 正在生成案例草稿...
          </p>
          <p class="text-muted-foreground mt-1 text-sm">
            请稍候，这可能需要几秒钟
          </p>
          <div class="mt-4 flex items-center justify-center gap-1">
            <span class="bg-primary/60 h-2 w-2 animate-pulse rounded-full"></span>
            <span class="bg-primary/40 h-2 w-2 animate-pulse rounded-full" style="animation-delay: 0.2s"></span>
            <span class="bg-primary/20 h-2 w-2 animate-pulse rounded-full" style="animation-delay: 0.4s"></span>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 预览弹窗（z-index 高于 BasicModal） -->
    <Teleport to="body">
      <div v-if="showPreview" class="modal-backdrop" style="z-index: 9999" @click.self="showPreview = false">
        <section class="modal-panel max-w-2xl">
          <header class="border-border flex items-center justify-between border-b pb-4">
            <h2 class="text-lg font-semibold">仿真运行预览</h2>
            <button @click="showPreview = false">✕</button>
          </header>
          <div class="mt-5 rounded-xl bg-slate-950 p-6 text-white">
            <div class="flex justify-between text-sm">
              <span>患者监护</span>
              <span class="text-emerald-400">● 运行中</span>
            </div>
            <div class="mt-6 grid grid-cols-3 gap-4 text-center">
              <div>
                <b class="text-3xl text-emerald-400">88</b>
                <p class="text-xs text-slate-400">HR / min</p>
              </div>
              <div>
                <b class="text-3xl text-amber-300">138/84</b>
                <p class="text-xs text-slate-400">NIBP mmHg</p>
              </div>
              <div>
                <b class="text-3xl text-cyan-300">94</b>
                <p class="text-xs text-slate-400">SpO₂ %</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Teleport>

    <!-- 发布确认弹窗（z-index 高于 BasicModal） -->
    <Teleport to="body">
      <div v-if="showPublishConfirm" class="modal-backdrop" style="z-index: 9999"
        @click.self="showPublishConfirm = false">
        <section class="modal-panel max-w-md">
          <h2 class="text-lg font-semibold">发布病例版本？</h2>
          <p class="text-muted-foreground mt-2 text-sm leading-6">
            发布后将冻结病例版本、模块引用、规则、音频以及指南 / SOP
            依据版本。
          </p>
          <footer class="mt-6 flex justify-end gap-2">
            <button class="btn-secondary" @click="showPublishConfirm = false">
              取消
            </button>
            <button class="btn-primary" @click="showPublishConfirm = false">
              提交发布
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
    </div>
  </BasicModal>
</template>

<style scoped>
/* 容器样式：让内容自适应弹窗高度 */
.configure-dialog-container {
  width: 100%;
}

.btn-primary {
  @apply bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium transition hover:opacity-90;
}

.btn-secondary {
  @apply border-border bg-card text-foreground hover:bg-muted rounded-md border px-3 py-2 text-sm font-medium transition;
}

.btn-outline {
  @apply border-primary text-primary hover:bg-primary/10 rounded-md border px-3 py-2 text-sm font-medium transition;
}

.step-nav {
  @apply hover:bg-muted flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm transition;
}

.step-nav-active {
  @apply bg-primary/10 text-primary font-medium;
}

.side-action {
  @apply text-muted-foreground hover:bg-muted rounded-md px-2 py-2 text-left transition;
}

.ai-loading-panel {
  @apply bg-card ring-border/50 flex flex-col items-center rounded-2xl px-12 py-10 shadow-2xl ring-1;
  min-width: 280px;
}

.ai-loading-spinner {
  @apply flex items-center justify-center;
}
</style>

<!-- 全局样式：BasicModal 的 modal-backdrop / modal-panel（因为 Teleport 到 body，scoped 不生效） -->
<style>
.modal-backdrop {
  @apply fixed inset-0 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm;
}

.modal-panel {
  @apply bg-card w-full rounded-xl p-5 shadow-xl;
}
</style>
