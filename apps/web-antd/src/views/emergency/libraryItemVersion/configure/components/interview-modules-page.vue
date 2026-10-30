<script lang="ts" setup>
import type { EmergencyLibraryItemVersion } from '@/composables/LoadLibraryItemVersionData';

import { computed, defineEmits, defineExpose, ref, watch } from 'vue';

// ======================== Props ========================
const props = defineProps<{
  data?: EmergencyLibraryItemVersion; // 接收整个版本对象
}>();

// ======================== Emits ========================
const emit = defineEmits<{
  (
    e: 'update:data',
    data: { case_tag: string; case_type_id: string; messages: any[] },
  ): void;
}>();

// ======================== 类型定义 ========================
type DialogueConfig = {
  familyResponse?: string;
  patientResponse: string;
  physicalSign?: string;
  triggers: string[];
  voice?: string;
};

type ScoreConfig = {
  bonusRules?: { bonus: number; condition: string; description: string }[];
  deductionRules: {
    condition: string;
    deduction: number;
    description: string;
  }[];
  isCritical: boolean;
  maxScore: number;
};

type ExamModule = {
  dialogue: DialogueConfig;
  displayName: string;
  id: string;
  physiologicalTrigger?: string;
  raw: Record<string, any>;
  role: string;
  scoreConfig: ScoreConfig;
  source: '标准模块' | '病例数据' | '病例新增' | '病例覆写';
  timeoutPenalty?: number;
};

// ======================== 默认样例数据 ========================
const defaultCaseData = {
  case_type_id: '默认',
  case_tag: '默认问诊案例',
  messages: [
    {
      turn_index: 1,
      speaker_role: '学员',
      delegation: '',
      simulator_role: 'virtual_family',
      question_q_id: 'q0002',
      time_window: '起病时间',
      parallel_operation: '无需',
      question_text:
        '家属：从开始不舒服/异常到现在大概多久了？有没有“最后正常是什么时候”？',
      model_answer:
        '大概在（几分钟/几小时）前开始的。最后一次确认他/她是正常的在（具体时间或大概时间）左右。',
      keywords_hit: [
        '家属：从开始不舒服/异常到现在大概多久了？有没有“最后正常是什么时候”？',
        '开始不舒服',
        '大概多久',
        '最后正常',
      ],
      keywords_miss: [],
      medical_consistency_flag: true,
      score: 10,
    },
  ],
};

// ======================== 数据源 ========================
const dataSource = computed(() => {
  const interview = props.data?.definitionJson?.interview;
  if (interview?.messages?.length) {
    return {
      case_type_id: interview.case_type_id || '',
      case_tag: interview.case_tag || '',
      messages: interview.messages,
    };
  }
  return defaultCaseData;
});

// ======================== 状态 ========================
const assembled = ref<ExamModule[]>([]);
const selectedIndex = ref<number>(0);
const searchQuery = ref('');
const tempTrigger = ref('');
const caseInfo = ref<null | { case_tag: string; case_type_id: string }>(null);

// ======================== 转换函数 ========================
function convertMessagesToModules(messages: any[]): ExamModule[] {
  return messages.map((msg, idx) => {
    const isPatient = msg.simulator_role === 'virtual_patient';
    const isFamily = msg.simulator_role === 'virtual_family';
    const role = isPatient ? '患者' : (isFamily ? '家属' : '其他');
    const triggers = [msg.question_text];
    if (msg.keywords_hit && msg.keywords_hit.length > 0) {
      msg.keywords_hit.forEach((kw: string) => {
        if (!triggers.includes(kw)) triggers.push(kw);
      });
    }
    const displayName = msg.question_text || `节点${idx + 1}`;
    let patientResponse = '';
    let familyResponse = '';
    if (isPatient) patientResponse = msg.model_answer || '';
    if (isFamily) familyResponse = msg.model_answer || '';

    return {
      id: `node-${idx}`,
      displayName,
      source: '病例数据',
      role,
      dialogue: {
        triggers,
        patientResponse,
        familyResponse,
        voice: '默认女声',
        physicalSign: '',
      },
      scoreConfig: {
        maxScore: msg.score || 0,
        isCritical: false,
        deductionRules: [
          { condition: 'missed', deduction: 0, description: '未触发扣分' },
        ],
        bonusRules: [
          { condition: 'extra_asked', bonus: 0, description: '额外追问加分' },
        ],
      },
      timeoutPenalty: 0,
      raw: { ...msg },
    };
  });
}

// ======================== 创建默认模块（新增） ========================
function createDefaultModule(role: '家属' | '患者' = '患者'): ExamModule {
  const id = `node-${Date.now()}`;
  // 修改点1: displayName 置空，triggers 为空数组
  const displayName = '';
  const triggers: string[] = [];
  const patientResponse = role === '患者' ? '请输入患者应答' : '';
  const familyResponse = role === '家属' ? '请输入家属应答' : '';
  return {
    id,
    displayName,
    source: '病例新增',
    role,
    dialogue: {
      triggers,
      patientResponse,
      familyResponse,
      voice: '默认女声',
      physicalSign: '',
    },
    scoreConfig: {
      maxScore: 10,
      isCritical: false,
      deductionRules: [
        { condition: 'missed', deduction: 0, description: '未触发扣分' },
      ],
      bonusRules: [
        { condition: 'extra_asked', bonus: 0, description: '额外追问加分' },
      ],
    },
    timeoutPenalty: 0,
    raw: {},
  };
}

// ======================== 导出 ========================
function getData() {
  if (!caseInfo.value) return null;
  const messages = assembled.value.map((mod) => {
    const newMsg = { ...mod.raw };
    if (!newMsg.turn_index) {
      newMsg.turn_index = assembled.value.indexOf(mod) + 1;
      newMsg.speaker_role = '学员';
      newMsg.delegation = '';
      newMsg.simulator_role =
        mod.role === '患者'
          ? 'virtual_patient'
          : (mod.role === '家属'
            ? 'virtual_family'
            : '');
      newMsg.question_q_id = `q${String(newMsg.turn_index).padStart(4, '0')}`;
      newMsg.time_window = '';
      newMsg.parallel_operation = '无需';
      newMsg.question_text = mod.displayName || mod.dialogue.triggers[0] || '';
      newMsg.keywords_hit = mod.dialogue.triggers;
      newMsg.keywords_miss = [];
      newMsg.medical_consistency_flag = true;
      newMsg.score = mod.scoreConfig.maxScore;
    }
    if (mod.role === '患者') {
      newMsg.model_answer = mod.dialogue.patientResponse || '';
    } else if (mod.role === '家属') {
      newMsg.model_answer = mod.dialogue.familyResponse || '';
    }
    newMsg.score = mod.scoreConfig.maxScore;
    const triggers = mod.dialogue.triggers.filter((t) => t.trim() !== '');
    newMsg.keywords_hit = [...new Set(triggers)];
    return newMsg;
  });

  return {
    case_type_id: caseInfo.value.case_type_id,
    case_tag: caseInfo.value.case_tag,
    messages,
  };
}

defineExpose({ getData });

watch(
  assembled,
  () => {
    const data = getData();
    if (data) emit('update:data', data);
  },
  { deep: true },
);

function handleExport() {
  const data = getData();
  if (data) {
    console.log('导出的 JSON:', JSON.stringify(data, null, 2));
    alert('已导出 JSON，请查看控制台输出');
  }
}

// ======================== 初始化 ========================
function initData() {
  const data = dataSource.value;
  if (data && data.messages) {
    caseInfo.value = {
      case_type_id: data.case_type_id,
      case_tag: data.case_tag,
    };
    assembled.value = convertMessagesToModules(data.messages);
    selectedIndex.value = assembled.value.length > 0 ? 0 : -1;
  } else {
    assembled.value = [];
    selectedIndex.value = -1;
    caseInfo.value = null;
  }
}

watch(
  () => props.data,
  () => {
    initData();
  },
  { immediate: true, deep: true },
);

// ======================== 计算属性 ========================
const filteredList = computed(() => {
  if (!searchQuery.value) return assembled.value;
  const q = searchQuery.value.toLowerCase();
  return assembled.value.filter(
    (item) =>
      item.displayName.toLowerCase().includes(q) ||
      item.dialogue.triggers.some((t) => t.toLowerCase().includes(q)) ||
      item.dialogue.patientResponse.toLowerCase().includes(q) ||
      (item.dialogue.familyResponse || '').toLowerCase().includes(q) ||
      JSON.stringify(item.raw).toLowerCase().includes(q),
  );
});

const selectedModule = computed(() => {
  if (
    selectedIndex.value >= 0 &&
    selectedIndex.value < assembled.value.length
  ) {
    return assembled.value[selectedIndex.value];
  }
  return null;
});

const totalScore = computed(() => {
  return assembled.value.reduce(
    (acc, cur) => acc + (cur.scoreConfig?.maxScore || 0),
    0,
  );
});

// ======================== 操作方法 ========================
function moveUp(index: number) {
  if (index <= 0) return;
  [assembled.value[index - 1], assembled.value[index]] = [
    assembled.value[index],
    assembled.value[index - 1],
  ];
  selectedIndex.value = index - 1;
}

function moveDown(index: number) {
  if (index >= assembled.value.length - 1) return;
  [assembled.value[index], assembled.value[index + 1]] = [
    assembled.value[index + 1],
    assembled.value[index],
  ];
  selectedIndex.value = index + 1;
}

function addTrigger(index: number) {
  const val = tempTrigger.value?.trim();
  if (!val) return;
  const module = assembled.value[index];
  if (!module.dialogue.triggers.includes(val)) {
    module.dialogue.triggers.push(val);
  }
  tempTrigger.value = '';
}

function removeTrigger(index: number, idx: number) {
  assembled.value[index].dialogue.triggers.splice(idx, 1);
}

function addNode() {
  const newModule = createDefaultModule('患者');
  const insertIndex =
    selectedIndex.value >= 0 ? selectedIndex.value + 1 : assembled.value.length;
  assembled.value.splice(insertIndex, 0, newModule);
  selectedIndex.value = insertIndex;
}

function duplicateNode(index: number) {
  const source = assembled.value[index];
  if (!source) return;
  const copy = JSON.parse(JSON.stringify(source));
  copy.id = `node-${Date.now()}-copy`;
  copy.displayName = `${source.displayName || source.dialogue.triggers[0] || '未命名'}（副本）`;
  copy.source = '病例新增';
  assembled.value.splice(index + 1, 0, copy);
  selectedIndex.value = index + 1;
}

function deleteNode(index: number) {
  if (assembled.value.length <= 1) {
    alert('至少保留一个节点');
    return;
  }
  assembled.value.splice(index, 1);
  if (selectedIndex.value >= assembled.value.length) {
    selectedIndex.value = assembled.value.length - 1;
  } else if (selectedIndex.value === index && index > 0) {
    selectedIndex.value = index - 1;
  } else if (selectedIndex.value === index) {
    selectedIndex.value = 0;
  }
}
</script>

<template>
  <div class="flex h-full gap-6 p-6">
    <!-- 左侧列表 -->
    <div class="border-border bg-card w-96 shrink-0 rounded-xl border p-4 shadow-sm">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="font-semibold">📋 对话节点（{{ assembled.length }}）</h3>
        <div class="flex gap-1">
          <button @click="addNode"
            class="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-2 py-1 text-xs font-medium">
            ＋ 添加
          </button>
          <button @click="
            () => {
              if (confirm('确认清空所有节点？')) {
                assembled.value = [];
                selectedIndex.value = -1;
              }
            }
          " class="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-40"
            :disabled="assembled.length === 0">
            清空
          </button>
        </div>
      </div>
      <div class="mb-3">
        <input v-model="searchQuery" type="text" placeholder="搜索节点内容..."
          class="border-input bg-background w-full rounded-lg border px-3 py-1.5 text-sm" />
      </div>
      <div class="max-h-[calc(100vh-240px)] space-y-2 overflow-y-auto pr-1">
        <div v-for="(item, index) in filteredList" :key="item.id"
          class="hover:border-primary/40 group cursor-pointer rounded-lg border p-3 transition-all" :class="[
            selectedIndex === index
              ? 'border-primary bg-primary/5'
              : 'border-border bg-background',
          ]" @click="selectedIndex = index">
          <div class="flex items-start justify-between">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="bg-muted flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold">
                  {{ index + 1 }}
                </span>
                <!-- 修改点2: 优先显示触发词 -->
                <span class="truncate text-sm font-medium">
                  {{
                    item.dialogue.triggers[0] || item.displayName || '未命名'
                  }}
                </span>
              </div>
              <div class="text-muted-foreground mt-1 flex flex-wrap items-center gap-1 text-xs">
                <span>👤 {{ item.role }}</span>
                <span class="mx-1">·</span>
                <span class="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">
                  🎯 {{ item.dialogue.triggers.length }} 个触发词
                </span>
                <span class="ml-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-600">
                  ⭐ {{ item.scoreConfig.maxScore }} 分
                </span>
                <span v-if="item.raw?.medical_consistency_flag !== undefined" class="ml-1">
                  <span v-if="item.raw.medical_consistency_flag" class="text-green-600">✅ 一致</span>
                  <span v-else class="text-red-600">❌ 不一致</span>
                </span>
              </div>
            </div>
            <div class="flex items-center gap-0.5">
              <button @click.stop="moveUp(index)" :disabled="index === 0"
                class="hover:bg-muted rounded p-1 disabled:opacity-30" title="上移">
                ↑
              </button>
              <button @click.stop="moveDown(index)" :disabled="index === assembled.length - 1"
                class="hover:bg-muted rounded p-1 disabled:opacity-30" title="下移">
                ↓
              </button>
              <button @click.stop="duplicateNode(index)" class="hover:bg-muted rounded p-1" title="复制节点">
                📋
              </button>
              <button @click.stop="deleteNode(index)" class="hover:bg-muted rounded p-1 text-red-500 hover:text-red-700"
                title="删除节点">
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧编辑区（内容未变，省略重复，仅保留结构） -->
    <div class="min-w-0 flex-1">
      <!-- 头部 -->
      <div class="bg-card mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 shadow-sm">
        <div>
          <h2 class="text-lg font-semibold">
            🧩 问诊对话流程编排
            <span v-if="caseInfo" class="text-muted-foreground ml-2 text-sm font-normal">
              {{ caseInfo.case_type_id }} · {{ caseInfo.case_tag }}
            </span>
          </h2>
          <p class="text-muted-foreground text-sm">
            点击左侧节点编辑关键字段，下方可查看该节点的完整原始数据
          </p>
        </div>
        <div class="flex items-center gap-4">
          <div class="rounded-lg bg-purple-50 px-4 py-2 text-center dark:bg-purple-950/30">
            <div class="text-muted-foreground text-xs">对话节点</div>
            <div class="text-xl font-bold text-purple-600">
              {{ assembled.length }}
            </div>
          </div>
          <div class="rounded-lg bg-blue-50 px-5 py-2 text-center dark:bg-blue-950/30">
            <div class="text-muted-foreground text-xs">总分上限</div>
            <div class="text-2xl font-bold text-blue-600">
              {{ totalScore }}<span class="text-sm font-normal">分</span>
            </div>
          </div>
          <button @click="handleExport"
            class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium">
            📤 导出 JSON
          </button>
        </div>
      </div>

      <!-- 选中节点编辑（完全沿用之前的单列布局，此处省略完整复制，以免赘述） -->
      <div v-if="selectedModule" class="border-border bg-card rounded-xl border p-4 shadow-sm">
        <!-- 编辑区内容与上一次提供的一致，未做改动，请保留之前的完整编辑面板 -->
        <!-- 为了简洁，此处仅展示占位，实际请使用上一次的完整编辑面板代码 -->
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <span class="font-semibold">节点 #{{ selectedIndex + 1 }}</span>
            <span class="bg-muted rounded-full px-2 py-0.5 text-xs">{{
              selectedModule.source
            }}</span>
            <span class="text-muted-foreground text-sm">👤 {{ selectedModule.role }}</span>
            <span v-if="selectedModule.scoreConfig.isCritical"
              class="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">一票否决</span>
          </div>
          <div class="space-y-3">
            <div>
              <label class="text-muted-foreground block text-xs font-medium">🎤 医生触发词</label>
              <div class="mt-1 flex flex-wrap items-center gap-1.5">
                <span v-for="(trigger, tIdx) in selectedModule.dialogue.triggers" :key="tIdx"
                  class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                  “{{ trigger }}”
                  <button @click="removeTrigger(selectedIndex, tIdx)" class="ml-1 text-blue-400 hover:text-red-500">
                    ×
                  </button>
                </span>
                <input v-model="tempTrigger" type="text" placeholder="例如：胸痛位置"
                  class="border-input bg-background focus:border-primary ml-1 w-32 rounded-md border px-2 py-1 text-sm focus:outline-none"
                  @keyup.enter="addTrigger(selectedIndex)" />
                <span class="text-muted-foreground text-[10px]">（医生说出任意词即触发此节点）</span>
              </div>
            </div>
            <div class="space-y-3">
              <div>
                <label class="text-muted-foreground block text-xs font-medium">💬 虚拟病人应答</label>
                <textarea v-model="selectedModule.dialogue.patientResponse" rows="2" placeholder="输入虚拟病人的回答..."
                  class="border-input bg-background focus:border-primary mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none"></textarea>
                <div class="text-muted-foreground mt-0.5 flex gap-2 text-[10px]">
                  <span>🎵 音色：{{
                    selectedModule.dialogue.voice || '默认女声'
                  }}</span>
                  <span>😷 体征：{{
                    selectedModule.dialogue.physicalSign || '未设置'
                  }}</span>
                </div>
              </div>
              <div>
                <label class="text-muted-foreground block text-xs font-medium">👨‍👩‍👦 仿真家属补充回答（可选）</label>
                <textarea v-model="selectedModule.dialogue.familyResponse" rows="2" placeholder="例如家属补充信息..."
                  class="border-input bg-background focus:border-primary mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none"></textarea>
              </div>
            </div>
            <div class="bg-muted/30 rounded-lg p-3">
              <div class="grid grid-cols-2 gap-3">
                <!-- 基础满分 -->
                <div>
                  <label class="text-muted-foreground block text-xs font-medium">基础满分</label>
                  <input v-model.number="selectedModule.scoreConfig.maxScore" type="number" step="0.5" min="0"
                    class="border-input bg-background mt-1 w-full rounded border px-2 py-1 text-sm" />
                </div>
                <!-- 遗漏扣分 -->
                <div>
                  <label class="text-muted-foreground block text-xs font-medium">遗漏扣分（未问及）</label>
                  <input v-model.number="selectedModule.scoreConfig.deductionRules[0].deduction
                    " type="number" step="0.5" min="0"
                    class="border-input bg-background mt-1 w-full rounded border px-2 py-1 text-sm" />
                  <div class="text-muted-foreground text-[10px]">
                    触发词未匹配时自动扣
                  </div>
                </div>
                <!-- 追问加分 -->
                <div>
                  <label class="text-muted-foreground block text-xs font-medium">追问加分（深度探索）</label>
                  <input v-model.number="selectedModule.scoreConfig.bonusRules[0].bonus
                    " type="number" step="0.5" min="0"
                    class="border-input bg-background mt-1 w-full rounded border px-2 py-1 text-sm" />
                  <div class="text-muted-foreground text-[10px]">
                    额外问及放射痛/诱因
                  </div>
                </div>
                <!-- 超时惩罚 -->
                <div>
                  <label class="text-muted-foreground block text-xs font-medium">超时惩罚（秒）</label>
                  <input v-model.number="selectedModule.timeoutPenalty" type="number" step="5" min="0"
                    class="border-input bg-background mt-1 w-full rounded border px-2 py-1 text-sm" />
                  <div class="text-muted-foreground text-[10px]">
                    超过此时间未触发，虚拟人自动催促
                  </div>
                </div>
              </div>
            </div>
            <div v-if="selectedModule.physiologicalTrigger"
              class="flex items-center gap-2 rounded border border-yellow-200 bg-yellow-50/50 px-3 py-1.5 text-xs dark:border-yellow-900 dark:bg-yellow-950/20">
              <span class="font-medium text-yellow-700">⚡ 生理联动：</span>
              <span>若此节点应答，虚拟人将触发 →
                <span class="font-mono font-bold">{{
                  selectedModule.physiologicalTrigger
                }}</span></span>
              <span class="text-muted-foreground ml-auto">（心率/血压/呼吸变化）</span>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="flex h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed">
        <span class="text-4xl opacity-30">👈</span>
        <p class="text-muted-foreground mt-2 text-sm">
          请从左侧选择一个对话节点进行编辑
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
textarea {
  resize: vertical;
}

details summary {
  list-style: none;
}

details summary::-webkit-details-marker {
  display: none;
}

details summary::before {
  content: '▶ ';
  font-size: 0.8em;
}

details[open] summary::before {
  content: '▼ ';
}
</style>
