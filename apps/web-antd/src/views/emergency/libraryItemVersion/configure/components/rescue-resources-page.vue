<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

// ==================== Props ====================
const props = defineProps<{
  data?: any;
}>();

const emit = defineEmits<{
  'update:version': [data: any];
  'dataChange': [data: any];
}>();

// ==================== 判断数据是否已加载 ====================
const isLoaded = computed(() => {
  return props.data && props.data.id && props.data.id > 0;
});

type ResourceKind = '药品' | '设备' | '耗材';
type ResourceStatus = '可用' | '待准备' | '缺失' | '故障' | '已连接';

interface RescueResource {
  id: string;
  kind: ResourceKind;
  name: string;
  specification: string;
  initialStatus: ResourceStatus;
  quantity: number;
  unit: string;
  prerequisites: string[];
  usageLimit: string[];
  locked: boolean;
}

// ==================== 标签页状态 ====================
const activeTab = ref<'drugs' | 'devices' | 'consumables' | 'runtime'>('drugs');
const toastMessage = ref('');
let toastTimer: ReturnType<typeof setTimeout> | null = null;

// ==================== 预设标签选项 ====================
const prerequisiteOptions = ['CPR进行中', '已建立IV/IO', '收缩压>90', '无禁忌症'];
const limitOptions = ['每3-5分钟1mg', '首剂300mg', '最大剂量<3mg', '仅限难治性心律'];

// ==================== 默认资源数据 ====================
const defaultResources: RescueResource[] = [
  {
    id: 'med-epinephrine',
    kind: '药品',
    name: '肾上腺素',
    specification: '1 mg/1 mL',
    initialStatus: '可用',
    quantity: 4,
    unit: '支',
    prerequisites: ['CPR进行中', '已建立IV/IO'],
    usageLimit: ['每3-5分钟1mg'],
    locked: false,
  },
  {
    id: 'med-amiodarone',
    kind: '药品',
    name: '胺碘酮',
    specification: '150 mg/3 mL',
    initialStatus: '可用',
    quantity: 2,
    unit: '支',
    prerequisites: ['无禁忌症'],
    usageLimit: ['首剂300mg', '仅限难治性心律'],
    locked: false,
  },
  {
    id: 'device-defibrillator',
    kind: '设备',
    name: '除颤监护仪',
    specification: '双相波除颤 / 监护 / 起搏',
    initialStatus: '已连接',
    quantity: 1,
    unit: '台',
    prerequisites: [],
    usageLimit: [],
    locked: true,
  },
  {
    id: 'device-io',
    kind: '设备',
    name: 'IO 建立装置',
    specification: '骨内通路钻',
    initialStatus: '待准备',
    quantity: 1,
    unit: '套',
    prerequisites: ['已建立IV/IO'],
    usageLimit: [],
    locked: false,
  },
];

// ==================== 响应式数据 ====================
const resources = ref<RescueResource[]>([...defaultResources]);

// ==================== 安全横幅信息 ====================
const safetyBanner = computed(() => {
  const medHistory = props.data?.definitionJson?.medicationHistory || {};
  const allergy = medHistory.allergy || {};
  const homeMed = medHistory.homeMed || {};

  const parts: string[] = [];

  if (allergy.hasAllergy === '有') {
    const category = allergy.drugCategory || '未知过敏原';
    const severity = allergy.severity ? `（${allergy.severity}）` : '';
    parts.push(`过敏：${category}${severity}`);
  } else if (allergy.hasAllergy === '无') {
    parts.push('否认过敏');
  } else {
    parts.push('过敏史不详');
  }

  const anticoagulant = homeMed.anticoagulant || '未服用';
  if (anticoagulant !== '未服用' && anticoagulant !== '不详') {
    parts.push(`服用抗凝药（${anticoagulant}）`);
  } else if (anticoagulant === '未服用') {
    parts.push('否认华法林');
  }

  const pde5 = homeMed.pde5 || '未服用';
  if (pde5.includes('24小时内')) {
    parts.push('24小时内服用PDE5抑制剂');
  } else if (pde5 === '未服用') {
    parts.push('否认西地那非');
  }

  const renal = medHistory.history?.renal || '无';
  if (renal === '有（透析）') {
    parts.push('透析患者');
  }

  const giBleed = medHistory.history?.giBleed || '无';
  if (giBleed === '有') {
    parts.push('消化道出血史');
  }

  let text = '基于"药物与过敏史"模块，当前患者：';
  if (parts.length === 0) {
    text += '信息未配置，请前往药物与过敏史模块设置。';
  } else {
    text += parts.join('；');
  }

  const allergySevere = allergy.severity === '过敏性休克（重度）';
  const pde5Contra = pde5 === '是，24小时内服用';
  let actionHint = '';
  if (!allergySevere && !pde5Contra) {
    actionHint = '✅ 系统已自动解锁硝酸甘油';
  } else {
    actionHint = '⚠️ 系统已自动锁定硝酸甘油';
  }
  if (allergy.drugCategory === '青霉素类') {
    actionHint += '，锁定青霉素类抗生素';
  }
  if (actionHint) {
    text += `。${actionHint}`;
  }

  return text;
});

// ==================== 计算属性：按当前 Tab 过滤资源 ====================
const filteredResources = computed(() => {
  const kindMap: Record<string, ResourceKind> = {
    drugs: '药品',
    devices: '设备',
    consumables: '耗材',
  };
  const targetKind = kindMap[activeTab.value];
  if (!targetKind) return [];
  return resources.value.filter((r) => r.kind === targetKind);
});

// ==================== 当前 Tab 的标签（用于添加按钮） ====================
const currentKindLabel = computed(() => {
  const map: Record<string, string> = {
    drugs: '药品',
    devices: '设备',
    consumables: '耗材',
  };
  return map[activeTab.value] || '';
});

// ==================== 映射数据 ====================
function mapDataToForm() {
  if (!props.data || !props.data.id) return;
  // 可扩展
}

watch(
  () => props.data?.id,
  (newId) => {
    if (newId && newId > 0) {
      mapDataToForm();
    }
  },
  { immediate: true }
);

watch(
  () => props.data,
  (newData) => {
    if (newData && newData.id && newData.id > 0) {
      mapDataToForm();
    }
  },
  { deep: true }
);

// ==================== 操作方法 ====================
const availableCount = computed(
  () => resources.value.filter((item) => item.initialStatus === '可用' || item.initialStatus === '已连接').length,
);

function showToast(text: string) {
  if (toastTimer) clearTimeout(toastTimer);
  toastMessage.value = text;
  toastTimer = setTimeout(() => {
    toastMessage.value = '';
    toastTimer = null;
  }, 2400);
}

function addResource() {
  const kind = currentKindLabel.value as ResourceKind;
  if (!kind) return;
  resources.value.push({
    id: `resource-${Date.now()}`,
    kind,
    name: `未命名${kind}`,
    specification: '',
    initialStatus: '待准备',
    quantity: 1,
    unit: kind === '药品' ? '支' : '个',
    prerequisites: [],
    usageLimit: [],
    locked: false,
  });
  showToast(`已添加${kind}`);
}

function removeResource(id: string) {
  resources.value = resources.value.filter((item) => item.id !== id);
  showToast('已删除资源');
}

function toggleLock(id: string) {
  const item = resources.value.find((r) => r.id === id);
  if (item) {
    item.locked = !item.locked;
    showToast(item.locked ? '已锁定' : '已解锁');
  }
}

function fillAclsSpecs() {
  const specsMap: Record<string, string> = {
    '肾上腺素': '1 mg/1 mL',
    '胺碘酮': '150 mg/3 mL',
    '阿托品': '1 mg/10 mL',
    '利多卡因': '100 mg/5 mL',
    '碳酸氢钠': '50 mEq/50 mL',
    '氯化钙': '1 g/10 mL',
    '多巴胺': '400 mg/250 mL',
    '硝酸甘油': '0.4 mg/片',
  };
  let filledCount = 0;
  resources.value.forEach((item) => {
    if (item.kind === '药品') {
      const spec = specsMap[item.name.trim()];
      if (spec && item.specification !== spec) {
        item.specification = spec;
        filledCount++;
      }
    }
  });
  showToast(`已填充 ${filledCount} 项药品规格`);
}

function getData() {
  return { resources: resources.value };
}

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
      <!-- 顶栏区域 -->
      <div class="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-start">
        <div>
          <h2 class="text-lg font-semibold text-slate-800">抢救资源与医嘱</h2>
          <p class="mt-1 text-sm text-slate-500">
            配置病例运行时可用的药品、设备、耗材和流程授权。阶段规则仅引用资源状态与有效完成证据。
          </p>
        </div>
        <span class="rounded-full bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700">
          可用 / 已连接：{{ availableCount }} 项
        </span>
      </div>

      <!-- 安全横幅 -->
      <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-3">
        <span class="text-lg">⚠️</span>
        <div class="flex-1">
          <p>{{ safetyBanner }}</p>
        </div>
      </div>

      <!-- Tab 导航 -->
      <div class="flex gap-5 overflow-x-auto border-b border-slate-200">
        <button
          type="button"
          class="tab-button"
          :class="{ active: activeTab === 'drugs' }"
          @click="activeTab = 'drugs'"
        >
          药品
        </button>
        <button
          type="button"
          class="tab-button"
          :class="{ active: activeTab === 'devices' }"
          @click="activeTab = 'devices'"
        >
          设备
        </button>
        <button
          type="button"
          class="tab-button"
          :class="{ active: activeTab === 'consumables' }"
          @click="activeTab = 'consumables'"
        >
          耗材
        </button>
        <button
          type="button"
          class="tab-button"
          :class="{ active: activeTab === 'runtime' }"
          @click="activeTab = 'runtime'"
        >
          运行时判定说明
        </button>
      </div>

      <!-- 运行时判定说明 Tab -->
      <template v-if="activeTab === 'runtime'">
        <div class="space-y-4">
          <div class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            <b>确定性判定：</b>药品是否"已给药"、设备操作是否"有效完成"，必须根据设备接口记录、结构化操作事件或导师确认判断；AI / ASR 仅可作为候选意图。
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 font-mono">
            <b>规则引用示例：</b><br />
            <code>除颤监护仪 = 已连接</code><br />
            <code>电极片 = 已贴放</code><br />
            <code>有效除颤完成 = 否</code><br />
            <code>肾上腺素给药次数 &lt; 1</code><br />
            <span class="text-xs text-slate-500">资源本身在本页维护，阶段与事件页仅配置引用条件、时限、后果、评分和路径。</span>
          </div>
        </div>
      </template>

      <!-- 药品/设备/耗材 Tab（共用表格结构，数据由 filteredResources 提供） -->
      <template v-else>
        <!-- 工具栏 -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <button type="button" class="secondary-button" @click="addResource">
            ＋ 添加{{ currentKindLabel }}
          </button>
          <button v-if="activeTab === 'drugs'" type="button" class="primary-button" @click="fillAclsSpecs">
            ⚡ 一键填充ACLS标准规格
          </button>
        </div>

        <!-- 资源表格 -->
        <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table class="min-w-[1200px] w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th class="px-3 py-3 font-medium">类型 / 名称</th>
                <th class="px-3 py-3 font-medium">规格</th>
                <th class="px-3 py-3 font-medium">初始状态 / 数量</th>
                <th class="px-3 py-3 font-medium">前置条件</th>
                <th class="px-3 py-3 font-medium">使用限制</th>
                <th class="px-3 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="item in filteredResources"
                :key="item.id"
                :class="{ 'opacity-60': item.locked }"
              >
                <!-- 类型 / 名称 -->
                <td class="px-3 py-2 align-top">
                  <select v-model="item.kind" class="table-input mb-1" :disabled="item.locked">
                    <option>药品</option><option>设备</option><option>耗材</option>
                  </select>
                  <input v-model="item.name" class="table-input" :disabled="item.locked" placeholder="名称" />
                </td>
                <!-- 规格 -->
                <td class="px-3 py-2 align-top">
                  <input v-model="item.specification" class="table-input" :disabled="item.locked" placeholder="如 1mg/1mL" />
                </td>
                <!-- 初始状态 / 数量 -->
                <td class="px-3 py-2 align-top">
                  <select v-model="item.initialStatus" class="table-input mb-1" :disabled="item.locked">
                    <option>可用</option><option>待准备</option><option>缺失</option><option>故障</option><option>已连接</option>
                  </select>
                  <div class="flex gap-1">
                    <input
                      v-model.number="item.quantity"
                      class="table-input"
                      :disabled="item.locked"
                      min="0"
                      type="number"
                      style="width:60px;"
                    />
                    <input
                      v-model="item.unit"
                      class="table-input"
                      :disabled="item.locked"
                      placeholder="单位"
                      style="width:60px;"
                    />
                  </div>
                </td>
                <!-- 前置条件（标签复选框） -->
                <td class="px-3 py-2 align-top">
                  <div class="flex flex-wrap gap-1">
                    <label
                      v-for="opt in prerequisiteOptions"
                      :key="opt"
                      class="inline-flex items-center gap-1 text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        :value="opt"
                        v-model="item.prerequisites"
                        :disabled="item.locked"
                        class="h-3.5 w-3.5 accent-blue-600"
                      />
                      <span
                        class="px-2 py-0.5 rounded-full text-xs"
                        :class="
                          item.prerequisites.includes(opt)
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        "
                      >
                        {{ opt }}
                      </span>
                    </label>
                  </div>
                </td>
                <!-- 使用限制（标签复选框） -->
                <td class="px-3 py-2 align-top">
                  <div class="flex flex-wrap gap-1">
                    <label
                      v-for="opt in limitOptions"
                      :key="opt"
                      class="inline-flex items-center gap-1 text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        :value="opt"
                        v-model="item.usageLimit"
                        :disabled="item.locked"
                        class="h-3.5 w-3.5 accent-blue-600"
                      />
                      <span
                        class="px-2 py-0.5 rounded-full text-xs"
                        :class="
                          item.usageLimit.includes(opt)
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        "
                      >
                        {{ opt }}
                      </span>
                    </label>
                  </div>
                </td>
                <!-- 操作 -->
                <td class="whitespace-nowrap px-3 py-2 align-top">
                  <button type="button" class="text-blue-600 hover:text-blue-800" @click="toggleLock(item.id)">
                    {{ item.locked ? '解锁' : '锁定' }}
                  </button>
                  <button type="button" class="ml-3 text-red-600 hover:text-red-800" @click="removeResource(item.id)">
                    删除
                  </button>
                </td>
              </tr>
              <!-- 空状态 -->
              <tr v-if="filteredResources.length === 0">
                <td colspan="6" class="px-3 py-8 text-center text-sm text-slate-400">
                  暂无 {{ currentKindLabel }}，点击上方「＋ 添加{{ currentKindLabel }}」创建
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>

    <!-- Toast 浮层 -->
    <p
      v-if="toastMessage"
      class="fixed bottom-5 right-5 z-50 rounded-md bg-slate-800 px-4 py-2 text-sm text-white shadow-lg transition-opacity"
    >
      {{ toastMessage }}
    </p>
  </section>
</template>

<style scoped>
.tab-button {
  @apply shrink-0 border-b-2 border-transparent px-1 py-3 text-sm text-slate-500 transition hover:text-slate-700;
}
.tab-button.active {
  @apply border-blue-600 font-medium text-blue-600;
}
.primary-button {
  @apply rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700;
}
.secondary-button {
  @apply rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-600 transition hover:border-blue-500 hover:bg-blue-50;
}
.table-input {
  @apply w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50;
}
</style>