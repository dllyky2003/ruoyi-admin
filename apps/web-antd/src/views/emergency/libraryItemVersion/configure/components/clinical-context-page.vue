<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { DictEnum } from '@vben/constants';

import { getDictOptions } from '#/utils/dict';

import { get } from '../../../../../utils/request';
// ==================== Props ====================
const props = defineProps<{ data?: any }>();
const emit = defineEmits<{
  dataChange: [data: any];
  'update:version': [data: any];
}>();

type TabKey = 'ai-draft' | 'initial' | 'labs' | 'vitals';
type MonitorKey =
  | 'etco2'
  | 'gcs'
  | 'hr'
  | 'ibp'
  | 'nibp'
  | 'pain'
  | 'rr'
  | 'spo2'
  | 'temp'
  | string;
type LabVisibility =
  | 'after-order'
  | 'condition'
  | 'delayed'
  | 'initial'
  | 'instructor';

interface LabResult {
  id: string;
  category: string;
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: '偏低' | '偏高' | '危急' | '正常';
  visibility: LabVisibility;
  delaySeconds: number;
  releaseCondition: string;
  note: string;
  locked: boolean;
}

interface MonitorItem {
  key: MonitorKey;
  item: string;
  value: string;
  unit: string;
  hint: string;
  locked: boolean;
}

interface Preset {
  id: string;
  title: string;
  description: string;
  versionNo: string;
  schemaVersion: string;
  status: string;
  caseId?: string;
  orderNum?: string;
  difficulty?: string;
  phasesCount?: number;
  duration?: number;
  guidelineProfile?: string;
  changeSummary?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  publishedBy?: string;
  publishedAt?: number;
  definitionHash?: string;
  state: {
    airway: string;
    appearance: string[];
    breathing: string;
    circulation: string;
    consciousness: string;
    ecg: string;
  };
  monitors: Partial<Record<MonitorKey, string>>;
}

// ==================== 数据加载状态 ====================
const isLoaded = computed(() => {
  return props.data && props.data.id && props.data.id > 0;
});

// ==================== 页面状态 ====================
const activeTab = ref<TabKey>('initial');
const aiLoading = ref(false);
const presetLibraryOpen = ref(false);
const savedMessage = ref('');

// ==================== 预设数据 ====================
const presets = ref<Preset[]>([]);
const presetsLoading = ref(false);
const selectedPresetTitle = ref<string>('');
const presetPreview = ref<null | Preset>(null);

// ==================== 页面数据 ====================
const initialState = ref({
  consciousness: '清醒，可完整对答',
  airway: '气道通畅',
  breathing: '呼吸困难，呼吸增快',
  circulation: '有脉，血流动力学相对稳定',
  ecg: '监护导联：窦性心动过速；疑似 ST 段抬高',
  appearance: [] as string[],
});

const monitors = ref<MonitorItem[]>([
  {
    key: 'hr',
    item: 'HR / 心律',
    value: '105，窦速/ST↑',
    unit: '次/分',
    hint: '疑似急性冠脉事件',
    locked: true,
  },
  {
    key: 'nibp',
    item: 'NIBP / MAP',
    value: '156/94；115',
    unit: 'mmHg',
    hint: '首页显示',
    locked: true,
  },
  {
    key: 'ibp',
    item: 'IBP (有创)',
    value: '—',
    unit: 'mmHg',
    hint: '如有动脉置管',
    locked: false,
  },
  {
    key: 'spo2',
    item: 'SpO₂',
    value: '96',
    unit: '%',
    hint: '室内空气',
    locked: false,
  },
  {
    key: 'rr',
    item: 'RR',
    value: '22',
    unit: '次/分',
    hint: '首页显示',
    locked: false,
  },
  {
    key: 'temp',
    item: 'Temp',
    value: '36.8',
    unit: '℃',
    hint: '腋温/耳温',
    locked: false,
  },
  {
    key: 'pain',
    item: 'Pain',
    value: '8/10',
    unit: 'NRS',
    hint: '疼痛评分',
    locked: false,
  },
  {
    key: 'etco2',
    item: 'ETCO₂',
    value: '—',
    unit: 'mmHg',
    hint: '通气/灌注指标',
    locked: false,
  },
  {
    key: 'gcs',
    item: 'GCS',
    value: '—',
    unit: '分',
    hint: '3-15',
    locked: false,
  },
]);

const labResults = ref<LabResult[]>([
  {
    id: 'lab-glucose',
    category: '床旁检查',
    name: '血糖',
    value: '6.8',
    unit: 'mmol/L',
    referenceRange: '3.9–11.1',
    flag: '正常',
    visibility: 'initial',
    delaySeconds: 0,
    releaseCondition: '',
    note: '初始床旁检测，团队可直接查看。',
    locked: true,
  },
]);

// ==================== 选项数据 ====================
const ecgOptions = [
  '监护导联：窦性心动过速；疑似 ST 段抬高',
  '窦性心律',
  '频发室性早搏；ST 段抬高',
  '室性心动过速',
  '室颤 / 无脉性室速',
  '无脉电活动 / 心静止',
];

const consciousnessOptions = getDictOptions(DictEnum.EMERGENCY_CONSCIOUSNESS);
const airwayOptions = getDictOptions(DictEnum.EMS_AIRWAY_PATENCY);
const breathingOptions = getDictOptions(DictEnum.EMS_RESP_PATTERN);
const circulationOptions = getDictOptions(DictEnum.EMS_CIRC_HEMODYNAMICS);
const appearanceOptions = getDictOptions(DictEnum.EMS_EXAM_SKIN);

// ==================== 从 data 映射数据到页面控件 ====================
function mapDataToForm() {
  if (!props.data || !props.data.id) return;
  const def = props.data.definitionJson || {};
  const clinical = def.clinical || {};

  const initialStateData = clinical.initialState || {};
  initialState.value = {
    consciousness: initialStateData.consciousness || '清醒，可完整对答',
    airway: initialStateData.airway || '气道通畅',
    breathing: initialStateData.breathing || '呼吸困难，呼吸增快',
    circulation: initialStateData.circulation || '有脉，血流动力学相对稳定',
    ecg: initialStateData.ecg || '监护导联：窦性心动过速；疑似 ST 段抬高',
    appearance: initialStateData.appearance || [],
  };

  const monitorsData = clinical.monitors || [];
  if (Array.isArray(monitorsData) && monitorsData.length > 0) {
    monitors.value = monitorsData.map((item: any) => ({
      key: item.key || '',
      item: item.item || '',
      value: item.value || '',
      unit: item.unit || '',
      hint: item.hint || '',
      locked: item.locked ?? false,
    }));
  }

  const labResultsData = clinical.labResults || [];
  if (Array.isArray(labResultsData) && labResultsData.length > 0) {
    labResults.value = labResultsData.map((item: any) => ({
      id: item.id || `lab-${Date.now()}`,
      category: item.category || '',
      name: item.name || '',
      value: item.value || '',
      unit: item.unit || '',
      referenceRange: item.referenceRange || '',
      flag: item.flag || '正常',
      visibility: item.visibility || 'after-order',
      delaySeconds: item.delaySeconds || 0,
      releaseCondition: item.releaseCondition || '',
      note: item.note || '',
      locked: item.locked ?? false,
    }));
  }
}

// ==================== 监听数据变化 ====================
watch(
  () => props.data?.id,
  (newId) => {
    if (newId && newId > 0) {
      mapDataToForm();
      fetchPresets();
    }
  },
  { immediate: true },
);

// ==================== 获取预设数据（使用 get，自动携带认证头） ====================
async function fetchPresets() {
  if (!props.data?.id) {
    presets.value = [];
    return;
  }

  presetsLoading.value = true;
  try {
    const result = await get<{ code: number; data: any[]; msg: string }>(
      '/emergency/teachingCaseVersion/listAll',
      { status: 'published' },
      {
        showError: true,
        autoHandle401: true,
      },
    );

    if (result.code !== 200) {
      throw new Error(result.msg || '获取预设数据失败');
    }

    presets.value = (result.data || []).map((item: any) => {
      const def = item.definitionJson || {};
      const ctx = def.clinicalContext || {};
      const latent = ctx.initialState?.override?.latentState || {};
      const observation = ctx.initialState?.override?.observationState || {};
      const rhythmMap: Record<string, string> = {
        VF: '室颤 / 无脉性室速',
        pVT: '室性心动过速',
        VT: '室性心动过速',
        sinus: '窦性心律',
        sinus_tachy: '监护导联：窦性心动过速；疑似 ST 段抬高',
        asystole: '无脉电活动 / 心静止',
        PEA: '无脉电活动 / 心静止',
      };
      const ecgDisplay = rhythmMap[latent.nativeRhythm || ''] || '窦性心律';
      const appearance: string[] = [];
      const skin = observation.skin;
      switch (skin) {
        case 'cyanotic': {
          appearance.push('发绀');
          break;
        }
        case 'diaphoretic': {
          appearance.push('大汗');
          break;
        }
        case 'pale': {
          appearance.push('面色苍白');
          break;
        }
        case 'pale_cyanotic': {
          appearance.push('面色苍白', '发绀');
          break;
        }
        default: {
          appearance.push('大汗', '面色苍白');
        }
      }

      return {
        id: item.id,
        title: item.title || '未命名案例',
        description: item.description || '',
        versionNo: item.versionNo || '',
        schemaVersion: item.schemaVersion,
        status: item.status || 'draft',
        caseId: item.caseId,
        orderNum: item.orderNum,
        difficulty: item.difficulty,
        phasesCount: item.phasesCount,
        duration: item.duration,
        guidelineProfile: item.guidelineProfile,
        changeSummary: item.changeSummary,
        reviewedBy: item.reviewedBy,
        reviewedAt: item.reviewedAt,
        publishedBy: item.publishedBy,
        publishedAt: item.publishedAt,
        definitionHash: item.definitionHash,
        state: {
          consciousness: latent.consciousness || '清醒，可完整对答',
          airway: latent.airway || '气道通畅',
          breathing: latent.respiratoryRate ? '呼吸困难，呼吸增快' : '呼吸平稳',
          circulation: latent.rosc
            ? '有脉，血流动力学相对稳定'
            : '有脉，末梢灌注下降',
          ecg: ecgDisplay,
          appearance,
        },
        monitors: {
          hr: latent.heartRate ? `${latent.heartRate}，${ecgDisplay}` : '—',
          nibp:
            latent.systolicBp && latent.diastolicBp
              ? `${latent.systolicBp}/${latent.diastolicBp}；${latent.mapBp || '—'}`
              : '—',
          spo2: latent.spo2 ? `${latent.spo2}` : '—',
          rr: latent.respiratoryRate ? `${latent.respiratoryRate}` : '—',
          temp: latent.coreTemperatureC ? `${latent.coreTemperatureC}` : '36.8',
          pain: latent.painScore ? `${latent.painScore}/10` : '—',
        },
      };
    });
  } catch (error) {
    console.error('获取预设数据失败:', error);
    presets.value = [];
  } finally {
    presetsLoading.value = false;
  }
}

// ==================== 操作方法 ====================
function showMessage(msg: string) {
  savedMessage.value = msg;
  window.setTimeout(() => {
    savedMessage.value = '';
  }, 2600);
}

function generateAiDraft() {
  aiLoading.value = true;
  setTimeout(() => {
    aiDraft.value = {
      generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      summary:
        '候选初始情境：活动后突发胸痛，伴大汗与呼吸急促。建议以"疑似急性冠脉综合征，存在恶性心律失常风险"作为教学情境起点。',
      suggestions: [
        '建议保留 HR 105 次/分与 NIBP 156/94 mmHg 作为初始已确认数据。',
        '建议设置"获取 12 导联心电图"作为早期关键事件。',
        '建议在后续阶段配置心律恶化与 CPR 路径，不直接由 AI 改写患者状态。',
      ],
    };
    activeTab.value = 'ai-draft';
    aiLoading.value = false;
    showMessage('已生成候选初始情境，请人工核对后采纳。');
  }, 700);
}

function handlePresetSelect(event: Event) {
  const target = event.target as HTMLSelectElement;
  const title = target.value;
  if (!title) {
    presetPreview.value = null;
    selectedPresetTitle.value = '';
    return;
  }
  const preset = presets.value.find((p) => p.title === title);
  if (preset) {
    presetPreview.value = preset;
    selectedPresetTitle.value = title;
  }
  target.value = '';
}

function applyPresetPreview() {
  if (!presetPreview.value) return;

  const preset = presetPreview.value;
  const skippedFields: string[] = [];

  initialState.value = {
    ...preset.state,
    appearance: [...preset.state.appearance],
  };

  monitors.value.forEach((monitor) => {
    const presetValue = preset.monitors[monitor.key];
    if (presetValue !== undefined) {
      if (monitor.locked) {
        skippedFields.push(monitor.item);
      } else {
        monitor.value = presetValue;
      }
    }
  });

  presetPreview.value = null;
  selectedPresetTitle.value = '';

  const logMsg = `✅ 已套用"${preset.title}"预设。${skippedFields.length > 0
      ? `注意：${skippedFields.join('、')}（已锁定）未更新。`
      : ''
    }`;
  showMessage(logMsg);
}

function cancelPresetPreview() {
  presetPreview.value = null;
  selectedPresetTitle.value = '';
}

const aiDraft = ref({
  generatedAt: '尚未生成',
  summary:
    '点击"AI 生成初始情境"后，将生成候选内容；所有字段均须由教师人工核对并采纳。',
  suggestions: [
    '根据病例主诉补充典型症状与发病时间。',
    '对 ECG、生命体征及患者表现设置明确的初始值。',
    '锁定已确认字段，避免后续草稿自动覆盖。',
  ],
});

function adoptAiDraft() {
  activeTab.value = 'initial';
  if (!initialState.value.ecg.includes('疑似')) {
    initialState.value.ecg = '监护导联：窦性心动过速；疑似 ST 段抬高';
  }
  showMessage('已采纳 AI 草稿中的候选描述，请继续确认监护参数。');
}

function addLabResult() {
  labResults.value.push({
    id: `lab-${Date.now()}`,
    category: '自定义检查',
    name: '未命名项目',
    value: '',
    unit: '',
    referenceRange: '',
    flag: '正常',
    visibility: 'after-order',
    delaySeconds: 0,
    releaseCondition: '提交检查申请',
    note: '',
    locked: false,
  });
}

function visibilityText(visibility: LabVisibility) {
  return {
    initial: '初始即已知',
    'after-order': '提交检查后返回',
    delayed: '延迟返回',
    condition: '满足条件后返回',
    instructor: '导师手动下发',
  }[visibility];
}

function addMonitor() {
  monitors.value.push({
    key: `custom-${Date.now()}`,
    item: '自定义监护参数',
    value: '',
    unit: '',
    hint: '待填写',
    locked: false,
  });
}

function getData() {
  return {
    initialState: initialState.value,
    monitors: monitors.value,
    labResults: labResults.value,
  };
}

const lockedCount = computed(
  () => monitors.value.filter((item) => item.locked).length,
);

defineExpose({ getData });
</script>

<template>
  <section class="space-y-5">
    <!-- 加载状态 -->
    <div v-if="!isLoaded" class="flex justify-center py-10">
      <span class="text-muted-foreground">加载中...</span>
    </div>

    <!-- 内容 -->
    <template v-else>
      <div class="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-start">
        <div>
          <h2 class="text-lg font-semibold text-slate-800">
            临床情境与初始状态
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            系统根据当前情境和初始状态生成建议体征；所有数值均可人工修改或锁定。
          </p>
        </div>
        <button type="button"
          class="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          :disabled="aiLoading" @click="generateAiDraft">
          {{ aiLoading ? 'AI 正在生成…' : '✦ AI 生成初始情境草稿' }}
        </button>
      </div>

      <!-- 导航 -->
      <div class="flex gap-5 overflow-x-auto border-b border-slate-200">
        <button v-for="tab in [
          { key: 'initial', label: '初始患者状态' },
          { key: 'vitals', label: '初始监护' },
          { key: 'labs', label: '化验与检查' },
          { key: 'ai-draft', label: 'AI 草稿与采纳记录' },
        ]" :key="tab.key" type="button" class="shrink-0 border-b-2 px-1 py-3 text-sm transition" :class="activeTab === tab.key
              ? 'border-blue-600 font-medium text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
            " @click="activeTab = tab.key as TabKey">
          {{ tab.label }}
        </button>
      </div>

      <!-- ========== 初始患者状态 ========== -->
      <div v-if="activeTab === 'initial'" class="space-y-5">
        <!-- 预设加载区域 -->
        <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div class="flex flex-wrap items-center gap-3">
            <span class="text-sm font-medium text-slate-700">📋 快速预设：</span>
            <select class="field max-w-xs !py-1.5" :disabled="presetsLoading" @change="handlePresetSelect($event)">
              <option value="">
                {{ presetsLoading ? '加载预设中...' : '-- 选择预设组合 --' }}
              </option>
              <option v-for="p in presets" :key="p.id" :value="p.title">
                {{ p.title }}（{{ p.state?.consciousness || '—' }}）
              </option>
            </select>
            <button @click="presetLibraryOpen = true">📂 预设库</button>
            <span class="text-xs text-slate-400">选择后预览，确认后手动应用</span>
            <span v-if="presetsLoading" class="text-xs text-slate-400">
              <span
                class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></span>
            </span>
          </div>

          <!-- 预览卡片 -->
          <div v-if="presetPreview" class="mt-3 rounded-lg border border-blue-300 bg-white p-4 shadow-sm transition">
            <div class="flex items-start justify-between">
              <div>
                <h4 class="font-semibold text-slate-800">
                  {{ presetPreview.title }}
                </h4>
                <p class="text-sm text-slate-500">
                  {{ presetPreview.description }}
                </p>
              </div>
              <div class="flex gap-2">
                <button type="button"
                  class="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                  @click="applyPresetPreview">
                  应用此预设
                </button>
                <button type="button"
                  class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  @click="cancelPresetPreview">
                  取消
                </button>
              </div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-4">
              <div>
                <span class="text-slate-500">HR：</span>
                <span class="font-medium">{{
                  presetPreview.monitors?.hr || '—'
                }}</span>
              </div>
              <div>
                <span class="text-slate-500">NIBP：</span>
                <span class="font-medium">{{
                  presetPreview.monitors?.nibp || '—'
                }}</span>
              </div>
              <div>
                <span class="text-slate-500">SpO₂：</span>
                <span class="font-medium">{{
                  presetPreview.monitors?.spo2 || '—'
                }}</span>
              </div>
              <div>
                <span class="text-slate-500">RR/Temp/Pain：</span>
                <span class="font-medium">{{ presetPreview.monitors?.rr || '—' }}/{{
                  presetPreview.monitors?.temp || '—'
                }}/{{ presetPreview.monitors?.pain || '—' }}</span>
              </div>
              <div class="col-span-2 md:col-span-4">
                <span class="text-slate-500">节律：</span>
                <span class="font-medium">{{
                  presetPreview.state?.ecg || '—'
                }}</span>
              </div>
              <div class="col-span-2 md:col-span-4">
                <span class="text-slate-500">体表表现：</span>
                <span class="font-medium">{{
                  (presetPreview.state?.appearance || []).join('、')
                }}</span>
              </div>
            </div>
            <p class="mt-2 text-xs text-amber-600">
              ⚠️ 应用后将覆盖所有<span class="font-semibold">未锁定</span>的监护字段，锁定字段将被保留。
            </p>
          </div>
        </div>

        <!-- 状态字段 -->
        <div class="grid gap-x-5 gap-y-4 md:grid-cols-2">
          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-slate-700">意识状态</span>
            <select v-model="initialState.consciousness" class="field">
              <option v-for="opt in consciousnessOptions" :key="opt.dictCode" :value="opt.dictValue">
                {{ opt.dictLabel }}
              </option>
            </select>
          </label>

          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-slate-700">气道状态</span>
            <select v-model="initialState.airway" class="field">
              <option v-for="opt in airwayOptions" :key="opt.dictCode" :value="opt.dictValue">
                {{ opt.dictLabel }}
              </option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-slate-700">呼吸状态</span>
            <select v-model="initialState.breathing" class="field">
              <option v-for="opt in breathingOptions" :key="opt.dictCode" :value="opt.dictValue">
                {{ opt.dictLabel }}
              </option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-slate-700">循环状态</span>
            <select v-model="initialState.circulation" class="field">
              <option v-for="opt in circulationOptions" :key="opt.dictCode" :value="opt.dictValue">
                {{ opt.dictLabel }}
              </option>
            </select>
          </label>
        </div>

        <!-- 体表与关键表现 -->
        <div>
          <span class="mb-1.5 block text-sm font-medium text-slate-700">体表与关键表现</span>
          <div
            class="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-slate-200 px-3 py-2">
            <label v-for="opt in appearanceOptions" :key="opt.dictCode"
              class="inline-flex items-center gap-1.5 text-sm text-slate-700">
              <input v-model="initialState.appearance" class="h-4 w-4 accent-blue-600" type="checkbox"
                :value="opt.dictValue" />
              {{ opt.dictLabel }}
            </label>
          </div>
        </div>
      </div>

      <!-- ========== 初始体征与监护 ========== -->
      <div v-if="activeTab === 'vitals'" class="space-y-5">
        <div class="rounded-xl border border-blue-100 bg-blue-50 p-4 md:p-5">
          <div class="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <h3 class="font-semibold text-slate-800">初始体征与监护</h3>
              <p class="mt-1 text-sm text-slate-500">
                页面监护区默认显示 HR、NIBP、SpO₂、RR、Temp。已锁定字段不会被 AI
                或预设覆盖。
              </p>
            </div>
            <div class="flex gap-2">
              <button type="button" class="secondary-button" :disabled="aiLoading" @click="generateAiDraft">
                ✦ AI 重新生成
              </button>
            </div>
          </div>

          <!-- 初始心电图类型 / 节律 -->
          <div class="mt-4">
            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-slate-700">初始心电图类型 / 节律</span>
              <select v-model="initialState.ecg" class="field">
                <option v-for="item in ecgOptions" :key="item">
                  {{ item }}
                </option>
              </select>
            </label>
          </div>

          <!-- 监护卡片网格 -->
          <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div v-for="monitor in monitors" :key="monitor.key"
              class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div class="flex items-start justify-between">
                <span class="font-medium text-slate-800">{{
                  monitor.item
                }}</span>
                <button type="button" class="text-xs text-blue-600 hover:text-blue-800"
                  @click="monitor.locked = !monitor.locked">
                  {{ monitor.locked ? '解锁' : '锁定' }}
                </button>
              </div>
              <div class="mt-1 flex items-center gap-2">
                <input v-model="monitor.value"
                  class="flex-1 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50"
                  :disabled="monitor.locked" />
                <span class="whitespace-nowrap text-sm text-slate-500">{{
                  monitor.unit || '—'
                }}</span>
              </div>
              <div class="mt-1 text-xs text-slate-400">{{ monitor.hint }}</div>
            </div>
          </div>

          <button type="button" class="mt-3 text-sm text-blue-600 hover:text-blue-800" @click="addMonitor">
            ＋ 添加监护参数（ETCO₂、血糖、GCS 等）
          </button>
        </div>
      </div>

      <!-- ========== 化验与检查 ========== -->
      <div v-if="activeTab === 'labs'" class="space-y-5">
        <div
          class="flex flex-col justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 md:flex-row md:items-center">
          <div>
            <h3 class="font-semibold text-slate-800">化验与检查结果</h3>
            <p class="mt-1 text-sm text-slate-600">
              结果应配置返回时机和可复核触发条件；运行时由规则引擎根据检查申请、计时或导师确认决定是否显示。
            </p>
          </div>
          <button type="button" class="primary-button shrink-0" @click="addLabResult">
            ＋ 添加检查结果
          </button>
        </div>

        <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table class="w-full min-w-[1180px] text-left text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th class="px-3 py-3 font-medium">检查类别 / 项目</th>
                <th class="px-3 py-3 font-medium">结果</th>
                <th class="px-3 py-3 font-medium">参考范围</th>
                <th class="px-3 py-3 font-medium">异常</th>
                <th class="px-3 py-3 font-medium">结果可见时机</th>
                <th class="px-3 py-3 font-medium">触发条件 / 延迟</th>
                <th class="px-3 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              <tr v-for="lab in labResults" :key="lab.id">
                <td class="px-3 py-2 align-top">
                  <input v-model="lab.category" class="table-input mb-1" :disabled="lab.locked" placeholder="检查类别" />
                  <input v-model="lab.name" class="table-input" :disabled="lab.locked" placeholder="项目名称" />
                </td>
                <td class="px-3 py-2 align-top">
                  <div class="flex gap-1">
                    <input v-model="lab.value" class="table-input" :disabled="lab.locked" placeholder="数值" />
                    <input v-model="lab.unit" class="table-input w-24" :disabled="lab.locked" placeholder="单位" />
                  </div>
                </td>
                <td class="px-3 py-2 align-top">
                  <input v-model="lab.referenceRange" class="table-input" :disabled="lab.locked" placeholder="参考范围" />
                </td>
                <td class="px-3 py-2 align-top">
                  <select v-model="lab.flag" class="table-input" :disabled="lab.locked">
                    <option>正常</option>
                    <option>偏低</option>
                    <option>偏高</option>
                    <option>危急</option>
                  </select>
                </td>
                <td class="px-3 py-2 align-top">
                  <select v-model="lab.visibility" class="table-input" :disabled="lab.locked">
                    <option value="initial">初始即已知</option>
                    <option value="after-order">提交检查后返回</option>
                    <option value="delayed">延迟返回</option>
                    <option value="condition">满足条件后返回</option>
                    <option value="instructor">导师手动下发</option>
                  </select>
                </td>
                <td class="px-3 py-2 align-top">
                  <input v-if="lab.visibility === 'delayed'" v-model.number="lab.delaySeconds" class="table-input"
                    :disabled="lab.locked" type="number" min="0" placeholder="延迟秒数" />
                  <input v-else v-model="lab.releaseCondition" class="table-input" :disabled="lab.locked"
                    :placeholder="visibilityText(lab.visibility)" />
                </td>
                <td class="whitespace-nowrap px-3 py-2 align-top">
                  <button type="button" class="text-blue-600 hover:text-blue-800" @click="lab.locked = !lab.locked">
                    {{ lab.locked ? '解锁' : '锁定' }}
                  </button>
                  <button type="button" class="ml-3 text-red-600 hover:text-red-800" @click="
                    labResults = labResults.filter(
                      (item) => item.id !== lab.id,
                    )
                    ">
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <b>规则引用示例：</b>当 <code>K⁺ &gt; 6.5 mmol/L</code> 且
          <code>已完成钙剂给药 = 否</code> 超过 180
          秒，则记录未处理致命性高钾血症、扣分并进入相应教学路径。化验数值不能由
          AI 单独确认。
        </div>
      </div>

      <!-- ========== AI 草稿 ========== -->
      <div v-if="activeTab === 'ai-draft'" class="rounded-lg border border-amber-200 bg-amber-50 p-5">
        <div class="flex flex-col justify-between gap-4 md:flex-row">
          <div>
            <h3 class="font-semibold text-slate-800">AI 候选草稿</h3>
            <p class="mt-1 text-xs text-slate-500">
              生成时间：{{ aiDraft.generatedAt }}
            </p>
          </div>
          <button type="button" class="primary-button" @click="adoptAiDraft">
            人工核对后采纳
          </button>
        </div>
        <p class="mt-4 rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
          {{ aiDraft.summary }}
        </p>
        <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li v-for="suggestion in aiDraft.suggestions" :key="suggestion">
            {{ suggestion }}
          </li>
        </ul>
        <p class="mt-4 text-xs text-amber-700">
          说明：AI
          仅生成候选内容，不能自动写入锁定字段，也不能作为患者状态或考核结果的最终依据。
        </p>
      </div>
    </template>

    <!-- 消息提示 -->
    <p v-if="savedMessage"
      class="fixed bottom-5 right-5 z-50 rounded-md bg-slate-800 px-4 py-2 text-sm text-white shadow-lg">
      {{ savedMessage }}
    </p>

    <!-- ====== 预设库弹窗 ====== -->
    <Teleport to="body">
      <div v-if="presetLibraryOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
        @click.self="presetLibraryOpen = false">
        <div class="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-800">📂 预设库</h3>
            <button class="text-xl text-slate-400 hover:text-slate-700" @click="presetLibraryOpen = false">
              ×
            </button>
          </div>
          <p class="mt-1 text-sm text-slate-500">
            {{
              presetsLoading
                ? '加载预设数据...'
                : '浏览所有预设的完整详情，点击"预览并套用"将展示预览并等待确认。'
            }}
          </p>

          <!-- 加载状态 -->
          <div v-if="presetsLoading" class="mt-6 flex justify-center py-8">
            <span
              class="inline-block h-6 w-6 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></span>
            <span class="ml-3 text-sm text-slate-500">加载预设中...</span>
          </div>

          <!-- 预设列表 -->
          <div v-else class="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
            <div v-for="preset in presets" :key="preset.id"
              class="rounded-lg border border-slate-200 p-4 transition hover:border-blue-300">
              <div class="flex items-start justify-between">
                <div>
                  <h4 class="font-semibold text-slate-800">
                    {{ preset.title }}
                  </h4>
                  <p class="text-sm text-slate-500">{{ preset.description }}</p>
                </div>
                <button type="button" class="secondary-button shrink-0" @click="
                  presetPreview = preset;
                selectedPresetTitle = preset.title;
                presetLibraryOpen = false;
                setTimeout(() => {
                  document
                    .querySelector('.border-blue-200.bg-blue-50')
                    ?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                    });
                }, 100);
                ">
                  预览并套用
                </button>
              </div>
              <div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm md:grid-cols-4">
                <div>
                  <span class="text-slate-500">HR：</span>
                  <span class="font-medium">{{
                    preset.monitors?.hr || '—'
                  }}</span>
                </div>
                <div>
                  <span class="text-slate-500">NIBP：</span>
                  <span class="font-medium">{{
                    preset.monitors?.nibp || '—'
                  }}</span>
                </div>
                <div>
                  <span class="text-slate-500">SpO₂：</span>
                  <span class="font-medium">{{
                    preset.monitors?.spo2 || '—'
                  }}</span>
                </div>
                <div>
                  <span class="text-slate-500">RR/Temp/Pain：</span>
                  <span class="font-medium">{{ preset.monitors?.rr || '—' }}/{{
                    preset.monitors?.temp || '—'
                  }}/{{ preset.monitors?.pain || '—' }}</span>
                </div>
                <div class="col-span-2">
                  <span class="text-slate-500">节律：</span>
                  <span class="font-medium">{{
                    preset.state?.ecg || '—'
                  }}</span>
                </div>
                <div class="col-span-2">
                  <span class="text-slate-500">体表表现：</span>
                  <span class="font-medium">{{
                    (preset.state?.appearance || []).join('、')
                  }}</span>
                </div>
              </div>
            </div>

            <!-- 空状态 -->
            <div v-if="presets.length === 0 && !presetsLoading" class="py-8 text-center text-slate-400">
              <p>暂无预设数据</p>
              <p class="mt-1 text-xs">导师可手动配置所有字段</p>
            </div>
          </div>

          <div class="mt-4 flex justify-end">
            <button class="btn-secondary" @click="presetLibraryOpen = false">
              关闭
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.field {
  @apply w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100;
}

.primary-button {
  @apply rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700;
}

.secondary-button {
  @apply rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-600 transition hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60;
}

.table-input {
  @apply w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50;
}

.btn-secondary {
  @apply rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50;
}
</style>
