<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

// ==================== Props ====================
const props = defineProps<{
  data?: any;
}>();

const emit = defineEmits<{
  dataChange: [data: any];
  'update:version': [data: any];
}>();

// ==================== 判断数据是否已加载 ====================
const isLoaded = computed(() => {
  return props.data && props.data.id && props.data.id > 0;
});

// ==================== 阶段类型 ====================
type PhaseType = 'cycle' | 'end' | 'start';

// ==================== 跳转类型 ====================
type TransitionType =
  | 'end_flow'
  | 'goto_phase'
  | 'loop_self'
  | 'next_phase'
  | 'previous_phase';

// ==================== 规则数据结构 ====================
interface RuleItem {
  id: string;
  name: string;
  type: 'assessment' | 'delay' | 'main' | 'safety';
  condition: string;
  consequence: string;
  durationSec: number;
  scoreChange: number;
}

// ==================== 阶段数据结构 ====================
interface PhaseItem {
  id: string;
  name: string;
  sequence: number;
  type: PhaseType;
  entryRuleId: string;
  entryCondition: string;
  exitRuleId: string;
  exitCondition: string;
  transitionType: TransitionType;
  transitionTargetId: string;
  activeTrackIds: string[];
  maxDurationSec: number;
  nominalDurationSec: number;
  description: string;
  rules: RuleItem[];
  isExpanded: boolean;
  isLocked: boolean;
}

// ==================== 技能领域选项 ====================
const trackOptions = [
  {
    id: 'circulation',
    label: '循环与胸外按压',
    color: 'bg-red-100 text-red-700',
    icon: '❤️',
  },
  {
    id: 'defibrillation',
    label: '监护与除颤',
    color: 'bg-blue-100 text-blue-700',
    icon: '⚡',
  },
  {
    id: 'airway',
    label: '气道与通气',
    color: 'bg-cyan-100 text-cyan-700',
    icon: '🫁',
  },
  {
    id: 'medication',
    label: '通路与药物',
    color: 'bg-green-100 text-green-700',
    icon: '💊',
  },
  {
    id: 'diagnostic',
    label: '病史与可逆病因',
    color: 'bg-amber-100 text-amber-700',
    icon: '📋',
  },
  {
    id: 'team_management',
    label: '团队管理',
    color: 'bg-purple-100 text-purple-700',
    icon: '👥',
  },
];

// ==================== 跳转类型选项 ====================
const transitionOptions = [
  { value: 'next_phase', label: '进入下一阶段' },
  { value: 'previous_phase', label: '返回上一阶段' },
  { value: 'loop_self', label: '重新执行本阶段' },
  { value: 'goto_phase', label: '跳转到指定阶段' },
  { value: 'end_flow', label: '结束流程' },
];

// ==================== 规则类型颜色映射 ====================
const ruleTypeMap: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  main: { label: '主路径', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  assessment: { label: '评估', color: 'text-blue-700', bg: 'bg-blue-100' },
  delay: { label: '延误分支', color: 'text-orange-700', bg: 'bg-orange-100' },
  safety: { label: '安全出口', color: 'text-purple-700', bg: 'bg-purple-100' },
};

// ==================== 阶段数据 ====================
const phases = ref<PhaseItem[]>([]);
const selectedPhaseIndex = ref(0);
const selectedPhase = computed(
  () => phases.value[selectedPhaseIndex.value] || null,
);

// ==================== 编辑弹窗状态 ====================
const showPhaseModal = ref(false);
const isEditing = ref(false);
const editingIndex = ref(-1);
const showDeleteConfirm = ref(false);
const deleteIndex = ref(-1);
const showRuleModal = ref(false);
const editingRuleIndex = ref(-1);

// ==================== Tab切换 ====================
type DetailTab = 'rules' | 'scoring' | 'settings' | 'transition';
const activeDetailTab = ref<DetailTab>('settings');

// ==================== 表单数据 ====================
const formData = ref<PhaseItem>({
  id: '',
  name: '',
  sequence: 1,
  type: 'cycle',
  entryRuleId: '',
  entryCondition: '',
  exitRuleId: '',
  exitCondition: '',
  transitionType: 'next_phase',
  transitionTargetId: '',
  activeTrackIds: ['circulation', 'defibrillation'],
  maxDurationSec: 120,
  nominalDurationSec: 120,
  description: '',
  rules: [],
  isExpanded: false,
  isLocked: false,
});

// ==================== 规则表单数据 ====================
const ruleFormData = ref<RuleItem>({
  id: '',
  name: '',
  type: 'main',
  condition: '',
  consequence: '',
  durationSec: 120,
  scoreChange: 0,
});

// ==================== 预定义的起始和终止阶段 ====================
const START_PHASE = {
  name: '初始接触与评估',
  entryCondition: '病例启动',
  entryRuleId: 'rule_case_start',
  exitCondition: '心搏骤停识别完成',
  exitRuleId: 'rule_arrest_recognized',
  activeTrackIds: [
    'circulation',
    'defibrillation',
    'diagnostic',
    'team_management',
  ],
  maxDurationSec: 60,
  nominalDurationSec: 60,
  description: '患者接触、初步评估、识别心搏骤停',
  rules: [
    {
      id: 'rule-start-1',
      name: '识别心搏骤停',
      type: 'main',
      condition: '患者无反应、无呼吸',
      consequence: '启动CPR流程',
      durationSec: 30,
      scoreChange: 5,
    },
    {
      id: 'rule-start-2',
      name: '启动应急响应',
      type: 'assessment',
      condition: '确认心搏骤停',
      consequence: '呼叫急救团队',
      durationSec: 20,
      scoreChange: 3,
    },
  ],
};

const END_PHASE = {
  name: 'ROSC后管理与交接',
  entryCondition: 'ROSC确认',
  entryRuleId: 'rule_rosc_achieved',
  exitCondition: '转运决策完成',
  exitRuleId: 'rule_transport_decision',
  activeTrackIds: ['circulation', 'airway', 'diagnostic', 'team_management'],
  maxDurationSec: 300,
  nominalDurationSec: 300,
  description: 'ROSC确认、复苏后处理、转运决策',
  rules: [
    {
      id: 'rule-end-1',
      name: 'ROSC确认',
      type: 'main',
      condition: '自主循环恢复',
      consequence: '启动ROSC后流程',
      durationSec: 30,
      scoreChange: 10,
    },
    {
      id: 'rule-end-2',
      name: '12导联心电图',
      type: 'assessment',
      condition: 'ROSC后',
      consequence: '获取12导联心电图',
      durationSec: 60,
      scoreChange: 5,
    },
    {
      id: 'rule-end-3',
      name: '转运决策',
      type: 'main',
      condition: '血流动力学稳定',
      consequence: '转运至导管室/ICU',
      durationSec: 60,
      scoreChange: 5,
    },
  ],
};

// ==================== ACLS循环阶段模板 ====================
const cycleTemplates = [
  {
    name: '监护与院前决策',
    entryCondition: '进入可电击心律周期',
    entryRuleId: 'rule_cycle_1_start',
    exitCondition: '节律分析完成',
    exitRuleId: 'rule_cycle_1_rhythm_check_due',
    description: '监护、节律分析、除颤决策',
    rules: [
      {
        id: 'cycle1-1',
        name: '识别可除颤节律',
        type: 'main',
        condition: 'VF/pVT识别',
        consequence: '触发除颤流程',
        durationSec: 120,
        scoreChange: 12,
      },
      {
        id: 'cycle1-2',
        name: '获取关键病史',
        type: 'assessment',
        condition: '可逆病因评估',
        consequence: '记录病史信息',
        durationSec: 60,
        scoreChange: 8,
      },
      {
        id: 'cycle1-3',
        name: '除颤延误',
        type: 'delay',
        condition: '除颤超过120秒',
        consequence: 'ETCO₂下降 → 扣分',
        durationSec: 120,
        scoreChange: -10,
      },
    ],
  },
  {
    name: 'CPR与除颤',
    entryCondition: '进入下一个CPR周期',
    entryRuleId: 'rule_cycle_2_start',
    exitCondition: 'CPR周期完成',
    exitRuleId: 'rule_cycle_2_rhythm_check_due',
    description: '高质量CPR、除颤、药物',
    rules: [
      {
        id: 'cycle2-1',
        name: '高质量CPR',
        type: 'main',
        condition: '按压深度5-6cm',
        consequence: '维持灌注',
        durationSec: 120,
        scoreChange: 10,
      },
      {
        id: 'cycle2-2',
        name: '肾上腺素给药',
        type: 'main',
        condition: 'VF/pVT持续',
        consequence: '给药记录',
        durationSec: 60,
        scoreChange: 8,
      },
      {
        id: 'cycle2-3',
        name: 'CPR中断延误',
        type: 'delay',
        condition: '按压中断>10秒',
        consequence: '灌注下降 → 扣分',
        durationSec: 60,
        scoreChange: -8,
      },
    ],
  },
  {
    name: '气道、药物与院前处置',
    entryCondition: '进入高级处置阶段',
    entryRuleId: 'rule_cycle_3_start',
    exitCondition: '高级处置完成',
    exitRuleId: 'rule_cycle_3_rhythm_check_due',
    description: '高级气道、血管通路、可逆病因',
    rules: [
      {
        id: 'cycle3-1',
        name: '高级气道建立',
        type: 'main',
        condition: '气道保护',
        consequence: '建立高级气道',
        durationSec: 90,
        scoreChange: 10,
      },
      {
        id: 'cycle3-2',
        name: '可逆病因排查',
        type: 'assessment',
        condition: 'Hs和Ts排查',
        consequence: '识别并处理',
        durationSec: 120,
        scoreChange: 8,
      },
    ],
  },
];

// ==================== 页面设置数据 ====================
const cycleSeconds = ref(120);
const maxCycles = ref(3);

// ==================== 计算属性 ====================
const hasStartPhase = computed(() =>
  phases.value.some((p) => p.type === 'start'),
);
const hasEndPhase = computed(() => phases.value.some((p) => p.type === 'end'));
const cyclePhases = computed(() =>
  phases.value.filter((p) => p.type === 'cycle'),
);

// 选中的阶段规则列表
const selectedRules = computed(() => {
  return selectedPhase.value?.rules || [];
});

// 规则统计
const ruleStats = computed(() => {
  const rules = selectedRules.value;
  if (!rules || rules.length === 0)
    return { main: 0, assessment: 0, delay: 0, safety: 0, total: 0 };
  const stats = {
    main: 0,
    assessment: 0,
    delay: 0,
    safety: 0,
    total: rules.length,
  };
  rules.forEach((r) => {
    if (stats[r.type] !== undefined) stats[r.type]++;
  });
  return stats;
});

// 得分计算
const scoreCalc = computed(() => {
  const rules = selectedRules.value;
  if (!rules || rules.length === 0)
    return { total: 0, main: 0, delay: 0, maxPossible: 0 };
  let total = 0;
  let main = 0;
  let delay = 0;
  rules.forEach((r) => {
    if (r.type === 'delay' || r.type === 'safety') {
      delay += Math.abs(r.scoreChange);
    } else {
      main += r.scoreChange;
    }
    total += r.scoreChange;
  });
  const maxPossible = rules.reduce(
    (sum, r) => sum + Math.abs(r.scoreChange),
    0,
  );
  return { total, main, delay, maxPossible };
});

// ==================== 排序和验证函数 ====================
function sortAndValidatePhases() {
  phases.value.sort((a, b) => a.sequence - b.sequence);

  const startIdx = phases.value.findIndex((p) => p.type === 'start');
  if (startIdx > 0) {
    const [start] = phases.value.splice(startIdx, 1);
    phases.value.unshift(start);
  }

  const endIdx = phases.value.findIndex((p) => p.type === 'end');
  if (endIdx !== -1 && endIdx < phases.value.length - 1) {
    const [end] = phases.value.splice(endIdx, 1);
    phases.value.push(end);
  }

  phases.value.forEach((p, i) => {
    p.sequence = (i + 1) * 10;
  });

  if (!hasStartPhase.value) {
    phases.value.unshift({
      id: `phase-start-${Date.now()}`,
      name: START_PHASE.name,
      sequence: 10,
      type: 'start',
      entryRuleId: START_PHASE.entryRuleId,
      entryCondition: START_PHASE.entryCondition,
      exitRuleId: START_PHASE.exitRuleId,
      exitCondition: START_PHASE.exitCondition,
      transitionType: 'next_phase',
      transitionTargetId: '',
      activeTrackIds: [...START_PHASE.activeTrackIds],
      maxDurationSec: START_PHASE.maxDurationSec,
      nominalDurationSec: START_PHASE.nominalDurationSec,
      description: START_PHASE.description,
      rules: START_PHASE.rules.map((r) => ({
        ...r,
        id: `rule-${Date.now()}-${r.id}`,
      })),
      isExpanded: false,
      isLocked: true,
    });
  }

  if (!hasEndPhase.value) {
    phases.value.push({
      id: `phase-end-${Date.now()}`,
      name: END_PHASE.name,
      sequence: (phases.value.length + 1) * 10,
      type: 'end',
      entryRuleId: END_PHASE.entryRuleId,
      entryCondition: END_PHASE.entryCondition,
      exitRuleId: END_PHASE.exitRuleId,
      exitCondition: END_PHASE.exitCondition,
      transitionType: 'end_flow',
      transitionTargetId: '',
      activeTrackIds: [...END_PHASE.activeTrackIds],
      maxDurationSec: END_PHASE.maxDurationSec,
      nominalDurationSec: END_PHASE.nominalDurationSec,
      description: END_PHASE.description,
      rules: END_PHASE.rules.map((r) => ({
        ...r,
        id: `rule-${Date.now()}-${r.id}`,
      })),
      isExpanded: false,
      isLocked: true,
    });
  }

  phases.value.sort((a, b) => a.sequence - b.sequence);
  phases.value.forEach((p, i) => {
    p.sequence = (i + 1) * 10;
  });
}

// ==================== 实体数据映射 ====================
function mapDataToForm() {
  if (!props.data || !props.data.id) {
    return;
  }

  const def = props.data.definitionJson.stages || {};
  const settings = def.settings || {};
  const sourcePhases = def.phases || [];

  if (sourcePhases.length > 0) {
    phases.value = sourcePhases.map((p: any) => {
      const isStart =
        p.id?.includes('initial') ||
        p.id?.includes('assessment') ||
        p.name?.includes('初始') ||
        p.name?.includes('评估');
      const isEnd =
        p.id?.includes('post_rosc') ||
        p.id?.includes('transport') ||
        p.name?.includes('ROSC') ||
        p.name?.includes('转运');
      let type: PhaseType = 'cycle';
      if (isStart) type = 'start';
      if (isEnd) type = 'end';

      let transitionType: TransitionType = 'next_phase';
      if (p.exitRuleId?.includes('end') || p.exitRuleId?.includes('finish'))
        transitionType = 'end_flow';
      else if (p.exitRuleId?.includes('loop')) transitionType = 'loop_self';
      else if (p.exitRuleId?.includes('back'))
        transitionType = 'previous_phase';
      else if (p.exitRuleId?.includes('goto')) transitionType = 'goto_phase';

      // 映射规则
      const rules = (p.rules || []).map((r: any) => ({
        id: r.id || `rule-${Date.now()}`,
        name: r.name || '未命名规则',
        type: r.type || 'main',
        condition: r.condition || '',
        consequence: r.consequence || '',
        durationSec: r.durationSec || 120,
        scoreChange: r.scoreChange || 0,
      }));

      return {
        id: p.id || `phase-${Date.now()}`,
        name: p.name || '未命名阶段',
        sequence: p.sequence || 0,
        type,
        entryRuleId: p.entryRuleId || '',
        entryCondition: p.entryCondition || `进入 ${p.name || '阶段'}`,
        exitRuleId: p.exitRuleId || '',
        exitCondition: p.exitCondition || `退出 ${p.name || '阶段'}`,
        transitionType,
        transitionTargetId: p.transitionTargetId || '',
        activeTrackIds: p.activeTrackIds || ['circulation', 'defibrillation'],
        maxDurationSec: p.maxDurationSec || 120,
        nominalDurationSec: p.nominalDurationSec || 120,
        description: p.description || `${p.name || '阶段'}描述`,
        rules:
          rules.length > 0
            ? rules
            : [
              {
                id: 'rule-default',
                name: '默认规则',
                type: 'main',
                condition: '条件待配置',
                consequence: '结果待配置',
                durationSec: 120,
                scoreChange: 0,
              },
            ],
        isExpanded: false,
        isLocked: type === 'start' || type === 'end',
      };
    });
    sortAndValidatePhases();
  } else {
    initializeDefaultPhases();
  }

  if (settings.maxDurationSec) {
    const phaseCount = phases.value.length || 1;
    cycleSeconds.value =
      Math.round(settings.maxDurationSec / phaseCount / 60) * 60 || 120;
  }

  const shockablePhases = phases.value.filter(
    (p) =>
      p.name?.includes('周期') ||
      p.name?.includes('电击') ||
      p.type === 'cycle',
  );
  if (shockablePhases.length > 0) {
    maxCycles.value = shockablePhases.length;
  }

  if (selectedPhaseIndex.value >= phases.value.length) {
    selectedPhaseIndex.value = 0;
  }
}

function initializeDefaultPhases() {
  phases.value = [
    {
      id: `phase-start-${Date.now()}`,
      name: START_PHASE.name,
      sequence: 10,
      type: 'start',
      entryRuleId: START_PHASE.entryRuleId,
      entryCondition: START_PHASE.entryCondition,
      exitRuleId: START_PHASE.exitRuleId,
      exitCondition: START_PHASE.exitCondition,
      transitionType: 'next_phase',
      transitionTargetId: '',
      activeTrackIds: [...START_PHASE.activeTrackIds],
      maxDurationSec: START_PHASE.maxDurationSec,
      nominalDurationSec: START_PHASE.nominalDurationSec,
      description: START_PHASE.description,
      rules: START_PHASE.rules.map((r) => ({
        ...r,
        id: `rule-${Date.now()}-${r.id}`,
      })),
      isExpanded: false,
      isLocked: true,
    },
    ...cycleTemplates.map((template, idx) => ({
      id: `phase-cycle-${idx + 1}-${Date.now()}`,
      name: template.name,
      sequence: 20 + idx * 10,
      type: 'cycle' as PhaseType,
      entryRuleId: template.entryRuleId,
      entryCondition: template.entryCondition,
      exitRuleId: template.exitRuleId,
      exitCondition: template.exitCondition,
      transitionType: 'next_phase' as TransitionType,
      transitionTargetId: '',
      activeTrackIds: [
        'circulation',
        'defibrillation',
        'airway',
        'medication',
        'diagnostic',
        'team_management',
      ],
      maxDurationSec: 120,
      nominalDurationSec: 120,
      description: template.description,
      rules: template.rules.map((r) => ({
        ...r,
        id: `rule-${Date.now()}-${r.id}`,
      })),
      isExpanded: false,
      isLocked: false,
    })),
    {
      id: `phase-end-${Date.now()}`,
      name: END_PHASE.name,
      sequence: 50,
      type: 'end',
      entryRuleId: END_PHASE.entryRuleId,
      entryCondition: END_PHASE.entryCondition,
      exitRuleId: END_PHASE.exitRuleId,
      exitCondition: END_PHASE.exitCondition,
      transitionType: 'end_flow',
      transitionTargetId: '',
      activeTrackIds: [...END_PHASE.activeTrackIds],
      maxDurationSec: END_PHASE.maxDurationSec,
      nominalDurationSec: END_PHASE.nominalDurationSec,
      description: END_PHASE.description,
      rules: END_PHASE.rules.map((r) => ({
        ...r,
        id: `rule-${Date.now()}-${r.id}`,
      })),
      isExpanded: false,
      isLocked: true,
    },
  ];
}

// ==================== 监听数据变化 ====================
watch(
  () => props.data?.id,
  (newId) => {
    if (newId && newId > 0) {
      mapDataToForm();
    }
  },
  { immediate: true },
);

watch(
  () => props.data,
  (newData) => {
    if (newData && newData.id && newData.id > 0) {
      mapDataToForm();
    }
  },
  { deep: true },
);

// ==================== 阶段操作 ====================
function selectPhase(index: number) {
  selectedPhaseIndex.value = index;
}

function getAvailableTargets(
  index: number,
): { label: string; value: string }[] {
  return phases.value
    .filter((_, i) => i !== index)
    .map((p, i) => ({ value: p.id, label: `#${i + 1} ${p.name}` }));
}

function openCreateModal() {
  if (!hasStartPhase.value || !hasEndPhase.value) {
    alert('请先确保起始阶段和终止阶段存在，然后添加循环阶段');
    return;
  }

  isEditing.value = false;
  editingIndex.value = -1;
  const nextSeq = (phases.value.length + 1) * 10;
  const cycleNum = cyclePhases.value.length + 1;
  formData.value = {
    id: `phase-${Date.now()}`,
    name: '',
    sequence: nextSeq,
    type: 'cycle',
    entryRuleId: `rule_cycle_${cycleNum}_start`,
    entryCondition: `进入第${cycleNum}周期`,
    exitRuleId: `rule_cycle_${cycleNum}_rhythm_check_due`,
    exitCondition: `第${cycleNum}周期完成`,
    transitionType: 'next_phase',
    transitionTargetId: '',
    activeTrackIds: [
      'circulation',
      'defibrillation',
      'airway',
      'medication',
      'diagnostic',
      'team_management',
    ],
    maxDurationSec: 120,
    nominalDurationSec: 120,
    description: '',
    rules: [],
    isExpanded: false,
    isLocked: false,
  };
  showPhaseModal.value = true;
}

function openEditModal(index: number) {
  const phase = phases.value[index];
  if (phase.isLocked) {
    alert('起始阶段和终止阶段不能编辑');
    return;
  }
  isEditing.value = true;
  editingIndex.value = index;
  formData.value = { ...phase };
  showPhaseModal.value = true;
}

function savePhase() {
  if (!formData.value.name.trim()) {
    alert('请输入阶段名称');
    return;
  }

  // 确保规则存在
  if (formData.value.rules.length === 0) {
    formData.value.rules = [
      {
        id: `rule-${Date.now()}`,
        name: '默认规则',
        type: 'main',
        condition: '',
        consequence: '',
        durationSec: 120,
        scoreChange: 0,
      },
    ];
  }

  if (isEditing.value && editingIndex.value >= 0) {
    phases.value[editingIndex.value] = { ...formData.value, isLocked: false };
  } else {
    const newPhase = { ...formData.value, isLocked: false };
    newPhase.id = `phase-${Date.now()}`;
    const endIndex = phases.value.findIndex((p) => p.type === 'end');
    if (endIndex === -1) {
      phases.value.push(newPhase);
    } else {
      phases.value.splice(endIndex, 0, newPhase);
    }
  }

  sortAndValidatePhases();
  showPhaseModal.value = false;
  if (!isEditing.value) {
    selectedPhaseIndex.value = phases.value.findIndex(
      (p) => p.id === formData.value.id,
    );
    if (selectedPhaseIndex.value >= 0) {
      selectPhase(selectedPhaseIndex.value);
    }
  }
  emit('dataChange', getData());
}

function confirmDelete(index: number) {
  const phase = phases.value[index];
  if (phase.isLocked) {
    alert('起始阶段和终止阶段不能删除');
    return;
  }
  deleteIndex.value = index;
  showDeleteConfirm.value = true;
}

function executeDelete() {
  if (deleteIndex.value >= 0) {
    phases.value.splice(deleteIndex.value, 1);
    sortAndValidatePhases();
    if (selectedPhaseIndex.value >= phases.value.length) {
      selectedPhaseIndex.value = phases.value.length - 1;
    }
    emit('dataChange', getData());
  }
  showDeleteConfirm.value = false;
  deleteIndex.value = -1;
}

function duplicatePhase(index: number) {
  const source = phases.value[index];
  if (source.isLocked) {
    alert('起始阶段和终止阶段不能复制');
    return;
  }
  const newPhase = {
    ...source,
    id: `phase-${Date.now()}`,
    name: `${source.name} (副本)`,
    isLocked: false,
    rules: source.rules.map((r) => ({
      ...r,
      id: `rule-${Date.now()}-${r.id}`,
    })),
  };
  const endIndex = phases.value.findIndex((p) => p.type === 'end');
  if (endIndex === -1) {
    phases.value.push(newPhase);
  } else {
    phases.value.splice(endIndex, 0, newPhase);
  }
  sortAndValidatePhases();
  emit('dataChange', getData());
}

function movePhaseUp(index: number) {
  const phase = phases.value[index];
  if (phase.isLocked || index <= 1) return;
  const temp = phases.value[index];
  phases.value[index] = phases.value[index - 1];
  phases.value[index - 1] = temp;
  sortAndValidatePhases();
  selectedPhaseIndex.value = index - 1;
  emit('dataChange', getData());
}

function movePhaseDown(index: number) {
  const phase = phases.value[index];
  if (phase.isLocked || index >= phases.value.length - 2) return;
  const temp = phases.value[index];
  phases.value[index] = phases.value[index + 1];
  phases.value[index + 1] = temp;
  sortAndValidatePhases();
  selectedPhaseIndex.value = index + 1;
  emit('dataChange', getData());
}

function addCycleTemplate(template: any) {
  if (!hasStartPhase.value || !hasEndPhase.value) {
    alert('请先确保起始阶段和终止阶段存在');
    return;
  }

  if (phases.value.some((p) => p.name === template.name)) {
    alert(`阶段 "${template.name}" 已存在`);
    return;
  }

  const cycleNum = cyclePhases.value.length + 1;
  const newPhase: PhaseItem = {
    id: `phase-${Date.now()}`,
    name: template.name,
    sequence: phases.value.length * 10,
    type: 'cycle',
    entryRuleId: template.entryRuleId || `rule_cycle_${cycleNum}_start`,
    entryCondition: template.entryCondition || `进入第${cycleNum}周期`,
    exitRuleId:
      template.exitRuleId || `rule_cycle_${cycleNum}_rhythm_check_due`,
    exitCondition: template.exitCondition || `第${cycleNum}周期完成`,
    transitionType: 'next_phase',
    transitionTargetId: '',
    activeTrackIds: [
      'circulation',
      'defibrillation',
      'airway',
      'medication',
      'diagnostic',
      'team_management',
    ],
    maxDurationSec: 120,
    nominalDurationSec: 120,
    description: template.description,
    rules: template.rules
      ? template.rules.map((r: any) => ({
        ...r,
        id: `rule-${Date.now()}-${r.id}`,
      }))
      : [],
    isExpanded: false,
    isLocked: false,
  };

  const endIndex = phases.value.findIndex((p) => p.type === 'end');
  if (endIndex === -1) {
    phases.value.push(newPhase);
  } else {
    phases.value.splice(endIndex, 0, newPhase);
  }

  sortAndValidatePhases();
  emit('dataChange', getData());
}

// ==================== 规则操作 ====================
function openAddRule() {
  editingRuleIndex.value = -1;
  ruleFormData.value = {
    id: `rule-${Date.now()}`,
    name: '',
    type: 'main',
    condition: '',
    consequence: '',
    durationSec: 120,
    scoreChange: 0,
  };
  showRuleModal.value = true;
}

function openEditRule(index: number) {
  if (!selectedPhase.value || selectedPhase.value.isLocked) {
    alert('起始阶段和终止阶段的规则不能编辑');
    return;
  }
  editingRuleIndex.value = index;
  ruleFormData.value = { ...selectedPhase.value.rules[index] };
  showRuleModal.value = true;
}

function saveRule() {
  if (!ruleFormData.value.name.trim()) {
    alert('请输入规则名称');
    return;
  }

  if (!selectedPhase.value) return;

  if (editingRuleIndex.value >= 0) {
    selectedPhase.value.rules[editingRuleIndex.value] = {
      ...ruleFormData.value,
    };
  } else {
    selectedPhase.value.rules.push({
      ...ruleFormData.value,
      id: `rule-${Date.now()}`,
    });
  }

  showRuleModal.value = false;
  emit('dataChange', getData());
}

function deleteRule(index: number) {
  if (!selectedPhase.value || selectedPhase.value.isLocked) {
    alert('起始阶段和终止阶段的规则不能删除');
    return;
  }
  if (confirm(`确认删除规则 "${selectedPhase.value.rules[index].name}" 吗？`)) {
    selectedPhase.value.rules.splice(index, 1);
    emit('dataChange', getData());
  }
}

function getRuleTypeInfo(type: string) {
  return (
    ruleTypeMap[type] || {
      label: type,
      color: 'text-gray-700',
      bg: 'bg-gray-100',
    }
  );
}

function getTrackLabel(trackId: string) {
  const found = trackOptions.find((t) => t.id === trackId);
  return found ? found.label : trackId;
}

function getTrackColor(trackId: string) {
  const found = trackOptions.find((t) => t.id === trackId);
  return found ? found.color : 'bg-gray-100 text-gray-700';
}

function getTrackIcon(trackId: string) {
  const found = trackOptions.find((t) => t.id === trackId);
  return found ? found.icon : '📌';
}

function getPhaseTypeLabel(type: PhaseType) {
  const map: Record<PhaseType, string> = {
    start: '起始',
    cycle: '循环',
    end: '终止',
  };
  return map[type] || '阶段';
}

function getPhaseTypeColor(type: PhaseType) {
  const map: Record<PhaseType, string> = {
    start: 'bg-emerald-100 text-emerald-700 border-emerald-400',
    cycle: 'bg-amber-100 text-amber-700 border-amber-400',
    end: 'bg-blue-100 text-blue-700 border-blue-400',
  };
  return map[type] || 'bg-gray-100 text-gray-700 border-gray-400';
}

function getTransitionLabel(type: TransitionType) {
  const found = transitionOptions.find((o) => o.value === type);
  return found ? found.label : type;
}

// ==================== 获取数据 ====================
function getData() {
  return {
    phases: phases.value,
    settings: {
      cycleSeconds: cycleSeconds.value,
      maxCycles: maxCycles.value,
    },
  };
}

defineExpose({ getData });

// ==================== 🔽 新增：ACLS短语模板面板功能 ====================
const showPhrasePanel = ref(false);
const activeField = ref<'condition' | 'consequence'>('condition');
const phrasePanelRef = ref<HTMLElement | null>(null);

// 条件短语库（按分组）
const conditionPhrases = [
  {
    group: '心律与电击',
    phrases: [
      'VF/pVT 识别',
      'PEA 无脉电活动识别',
      '心搏停止（Asystole）',
      '除颤完成',
      '节律分析完成',
    ],
  },
  {
    group: 'CPR 质量',
    phrases: [
      'CPR 进行中',
      '按压中断 > 10 秒',
      '2 分钟 CPR 周期完成',
      '按压深度 < 5cm',
    ],
  },
  {
    group: '气道与呼吸',
    phrases: [
      '呼吸停止 / 濒死呼吸',
      'SpO₂ < 94%（室内空气）',
      'ETCO₂ < 10 mmHg',
      '高级气道置入完成',
    ],
  },
  {
    group: '药物与通路',
    phrases: [
      'IV/IO 通路建立',
      '肾上腺素给药后',
      '胺碘酮首剂给药后',
      '可逆病因（Hs/Ts）排查完成',
    ],
  },
  {
    group: '团队与流程',
    phrases: ['急救团队已到位', 'ROSC 确认', '家属沟通完成', '转运决策启动'],
  },
];

// 结果短语库
const consequencePhrases = [
  {
    group: '流程引导',
    phrases: [
      '启动 CPR 流程',
      '触发除颤（建议能量 XXX J）',
      '进入下一 CPR 周期',
      '启动 ROSC 后处理流程',
    ],
  },
  {
    group: '药物与操作',
    phrases: [
      '给予肾上腺素 1mg IV/IO',
      '给予胺碘酮 300mg IV/IO',
      '建立高级气道 / 通气',
      '排查并处理可逆病因',
    ],
  },
  {
    group: '评分与反馈',
    phrases: [
      '正分：关键动作正确，+X 分',
      '扣分：延误导致预后不良，-X 分',
      '警告：学员需立即纠正操作',
    ],
  },
  {
    group: '路径跳转',
    phrases: [
      '跳转至下一阶段',
      '返回上一阶段重新操作',
      '跳转至安全出口阶段（终止流程）',
    ],
  },
];

// 根据规则类型和阶段类型筛选短语
const filteredPhrases = computed(() => {
  const source =
    activeField.value === 'condition' ? conditionPhrases : consequencePhrases;
  const ruleType = ruleFormData.value.type || 'main';
  const phaseType = selectedPhase.value?.type || 'cycle';

  // 根据规则类型进行筛选逻辑（示例：main 和 assessment 显示所有，delay 只显示与延误相关的，safety 只显示安全出口相关）
  const filtered = source
    .map((group) => {
      let phrases = group.phrases;
      if (ruleType === 'delay') {
        phrases = phrases.filter(
          (p) =>
            p.includes('延误') ||
            p.includes('中断') ||
            p.includes('扣分') ||
            p.includes('下降'),
        );
      } else if (ruleType === 'safety') {
        phrases = phrases.filter(
          (p) => p.includes('安全') || p.includes('终止') || p.includes('跳转'),
        );
      }
      // 根据阶段类型过滤（可选）
      if (phaseType === 'start') {
        phrases = phrases.filter(
          (p) => p.includes('启动') || p.includes('初始') || p.includes('评估'),
        );
      } else if (phaseType === 'end') {
        phrases = phrases.filter(
          (p) =>
            p.includes('ROSC') ||
            p.includes('转运') ||
            p.includes('交接') ||
            p.includes('终止'),
        );
      }
      return { ...group, phrases };
    })
    .filter((group) => group.phrases.length > 0);

  return filtered;
});

function togglePhrasePanel(field: 'condition' | 'consequence') {
  if (showPhrasePanel.value && activeField.value === field) {
    showPhrasePanel.value = false;
  } else {
    activeField.value = field;
    showPhrasePanel.value = true;
  }
}

function selectPhrase(phrase: string) {
  if (activeField.value === 'condition') {
    ruleFormData.value.condition = phrase;
  } else {
    ruleFormData.value.consequence = phrase;
  }
  closePhrasePanel();
}

function closePhrasePanel() {
  showPhrasePanel.value = false;
}

// 点击外部关闭面板
function handleOutsideClick(event: MouseEvent) {
  if (
    showPhrasePanel.value &&
    phrasePanelRef.value &&
    !phrasePanelRef.value.contains(event.target as Node)
  ) {
    closePhrasePanel();
  }
}

// 监听面板显示状态，添加/移除全局点击监听
watch(showPhrasePanel, (val) => {
  if (val) {
    document.addEventListener('click', handleOutsideClick);
  } else {
    document.removeEventListener('click', handleOutsideClick);
  }
});

// 组件卸载时移除监听
onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick);
});

// ESC 键关闭面板
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && showPhrasePanel.value) {
    closePhrasePanel();
  }
}
onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div v-if="!isLoaded" class="flex justify-center py-10">
    <span class="text-muted-foreground">加载中...</span>
  </div>

  <div v-else class="stage-events-layout">
    <!-- 顶部标题栏 -->
    <div
      class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div>
        <h2 class="flex items-center gap-2 text-xl font-semibold text-slate-800">
          <span>⚙️ 阶段与事件</span>
          <span class="text-sm font-normal text-slate-400">ACLS / MegaCode 流程配置</span>
        </h2>
        <p class="mt-0.5 text-sm text-slate-500">
          配置教学流程的阶段、规则及阶段间跳转逻辑
        </p>
      </div>
      <div class="flex gap-2">
        <button class="btn-secondary" @click="openCreateModal">
          <span class="mr-1">➕</span> 添加阶段
        </button>
      </div>
    </div>

    <!-- 两栏布局：左栏加宽到4列，右栏8列 -->
    <div class="grid grid-cols-12 gap-6">
      <!-- 左栏：阶段列表（4列，更宽） -->
      <div class="col-span-4 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-slate-600">阶段列表</span>
          <span class="text-xs text-slate-400">{{ phases.length }} 个阶段</span>
        </div>

        <div class="custom-scrollbar max-h-[600px] space-y-2 overflow-y-auto pr-1">
          <div v-for="(phase, index) in phases" :key="phase.id"
            class="phase-item group cursor-pointer rounded-xl border p-3 transition-all duration-200" :class="[
              selectedPhaseIndex === index
                ? 'border-blue-500 bg-blue-50/80 shadow-md ring-1 ring-blue-500/20'
                : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm',
              phase.type === 'start'
                ? 'border-l-4 border-l-emerald-500'
                : phase.type === 'end'
                  ? 'border-l-4 border-l-blue-500'
                  : 'border-l-4 border-l-amber-500',
            ]" @click="selectPhase(index)">
            <div class="flex items-start justify-between gap-2">
              <!-- 左侧信息 -->
              <div class="min-w-0 flex-1">
                <!-- 第一行：序号 + 类型标签 + 锁 -->
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-medium text-slate-400">#{{ index + 1 }}</span>
                  <span class="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                    :class="getPhaseTypeColor(phase.type)">
                    {{ getPhaseTypeLabel(phase.type) }}
                  </span>
                  <span v-if="phase.isLocked" class="shrink-0 text-[10px] text-slate-400">🔒</span>
                </div>
                <!-- 第二行：阶段名称（突出显示） -->
                <p class="mt-1 truncate text-sm font-semibold text-slate-800">
                  {{ phase.name }}
                </p>
                <!-- 第三行：规则数 + 时长 + 跳转类型（紧凑） -->
                <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                  <span class="flex items-center gap-0.5">📋 {{ phase.rules?.length || 0 }}条</span>
                  <span class="text-slate-300">·</span>
                  <span class="flex items-center gap-0.5">⏱️ {{ phase.maxDurationSec }}s</span>
                  <span class="text-slate-300">·</span>
                  <span class="max-w-[80px] truncate font-medium text-amber-600">{{
                    getTransitionLabel(phase.transitionType) }}</span>
                </div>
              </div>

              <!-- 右侧操作按钮组（紧凑） -->
              <div class="flex shrink-0 gap-0.5" @click.stop>
                <button v-if="!phase.isLocked"
                  class="rounded-md p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-20"
                  :disabled="index <= 1" @click="movePhaseUp(index)" title="上移">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button v-if="!phase.isLocked"
                  class="rounded-md p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-20"
                  :disabled="index >= phases.length - 2" @click="movePhaseDown(index)" title="下移">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button v-if="!phase.isLocked"
                  class="rounded-md p-1 text-slate-300 transition hover:bg-blue-50 hover:text-blue-600"
                  @click="duplicatePhase(index)" title="复制">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button v-if="!phase.isLocked"
                  class="rounded-md p-1 text-slate-300 transition hover:bg-blue-50 hover:text-blue-600"
                  @click="openEditModal(index)" title="编辑">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button v-if="!phase.isLocked"
                  class="rounded-md p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                  @click="confirmDelete(index)" title="删除">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 快速添加模板 -->
        <div class="mt-4 flex flex-wrap gap-1.5">
          <span class="mr-1 text-xs text-slate-400">快速添加:</span>
          <button v-for="template in cycleTemplates" :key="template.name"
            class="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-medium text-slate-500 transition hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
            @click="addCycleTemplate(template)">
            + {{ template.name }}
          </button>
        </div>
      </div>

      <!-- 右栏：阶段详情（8列） -->
      <div class="col-span-8">
        <div v-if="selectedPhase" class="space-y-4">
          <!-- 阶段标题 -->
          <div class="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3">
            <span class="text-sm font-medium text-slate-400">#{{ selectedPhaseIndex + 1 }}</span>
            <span class="rounded-full border px-2.5 py-0.5 text-xs font-semibold"
              :class="getPhaseTypeColor(selectedPhase.type)">
              {{ getPhaseTypeLabel(selectedPhase.type) }}
            </span>
            <span class="text-lg font-semibold text-slate-800">{{
              selectedPhase.name
            }}</span>
            <span v-if="selectedPhase.isLocked" class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">🔒
              固定阶段</span>
            <span class="ml-auto rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">{{
              selectedPhase.rules?.length || 0 }} 条规则</span>
          </div>

          <!-- 详情 Tab -->
          <div class="flex gap-1 border-b border-slate-200">
            <button class="relative px-3 py-2 text-sm font-medium transition-all duration-200" :class="activeDetailTab === 'settings'
                ? 'text-blue-600'
                : 'text-slate-500 hover:text-slate-700'
              " @click="activeDetailTab = 'settings'">
              阶段设置
              <span v-if="activeDetailTab === 'settings'"
                class="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-blue-600"></span>
            </button>
            <button class="relative px-3 py-2 text-sm font-medium transition-all duration-200" :class="activeDetailTab === 'transition'
                ? 'text-blue-600'
                : 'text-slate-500 hover:text-slate-700'
              " @click="activeDetailTab = 'transition'">
              阶段跳转
              <span v-if="activeDetailTab === 'transition'"
                class="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-blue-600"></span>
            </button>
            <button class="relative px-3 py-2 text-sm font-medium transition-all duration-200" :class="activeDetailTab === 'rules'
                ? 'text-blue-600'
                : 'text-slate-500 hover:text-slate-700'
              " @click="activeDetailTab = 'rules'">
              规则与事件
              <span v-if="activeDetailTab === 'rules'"
                class="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-blue-600"></span>
            </button>
            <button class="relative px-3 py-2 text-sm font-medium transition-all duration-200" :class="activeDetailTab === 'scoring'
                ? 'text-blue-600'
                : 'text-slate-500 hover:text-slate-700'
              " @click="activeDetailTab = 'scoring'">
              教学与评分
              <span v-if="activeDetailTab === 'scoring'"
                class="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-blue-600"></span>
            </button>
          </div>

          <!-- Tab 内容 -->
          <div class="pt-1">
            <!-- ===== 阶段设置 ===== -->
            <div v-if="activeDetailTab === 'settings'"
              class="grid grid-cols-1 gap-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm md:grid-cols-2">
              <label class="flex flex-col gap-1.5">
                <span class="text-sm font-medium text-slate-700">阶段名称</span>
                <input v-model="selectedPhase.name" :disabled="selectedPhase.isLocked" class="input"
                  placeholder="输入阶段名称" />
              </label>
              <label class="flex flex-col gap-1.5">
                <span class="text-sm font-medium text-slate-700">阶段描述</span>
                <input v-model="selectedPhase.description" :disabled="selectedPhase.isLocked" class="input"
                  placeholder="简要描述该阶段目标" />
              </label>
              <label class="flex flex-col gap-1.5">
                <span class="text-sm font-medium text-slate-700">最大时长（秒）</span>
                <input v-model.number="selectedPhase.maxDurationSec" type="number" min="10"
                  :disabled="selectedPhase.isLocked" class="input" />
              </label>
              <label class="flex flex-col gap-1.5">
                <span class="text-sm font-medium text-slate-700">名义时长（秒）</span>
                <input v-model.number="selectedPhase.nominalDurationSec" type="number" min="10"
                  :disabled="selectedPhase.isLocked" class="input" />
              </label>
              <div class="col-span-1 md:col-span-2">
                <span class="mb-2 block text-sm font-medium text-slate-700">活跃技能领域</span>
                <div class="flex flex-wrap gap-2">
                  <span v-for="trackId in selectedPhase.activeTrackIds" :key="trackId"
                    class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                    :class="getTrackColor(trackId)">
                    {{ getTrackIcon(trackId) }} {{ getTrackLabel(trackId) }}
                  </span>
                  <button v-if="!selectedPhase.isLocked"
                    class="text-xs text-blue-600 hover:text-blue-800 hover:underline">
                    + 编辑
                  </button>
                </div>
              </div>
            </div>

            <!-- ===== 阶段跳转 ===== -->
            <div v-if="activeDetailTab === 'transition'"
              class="space-y-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium text-slate-700">进入条件（触发规则）</span>
                  <input v-model="selectedPhase.entryCondition" :disabled="selectedPhase.isLocked" class="input"
                    placeholder="如：进入可电击心律周期" />
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium text-slate-700">进入规则ID</span>
                  <input v-model="selectedPhase.entryRuleId" :disabled="selectedPhase.isLocked" class="input"
                    placeholder="如 rule_cycle_1_start" />
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium text-slate-700">退出条件</span>
                  <input v-model="selectedPhase.exitCondition" :disabled="selectedPhase.isLocked" class="input"
                    placeholder="如：节律分析完成" />
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium text-slate-700">退出规则ID</span>
                  <input v-model="selectedPhase.exitRuleId" :disabled="selectedPhase.isLocked" class="input"
                    placeholder="如 rule_cycle_1_end" />
                </label>
              </div>

              <div class="rounded-xl border border-blue-200 bg-blue-50/70 p-5">
                <div class="flex flex-wrap items-center gap-4">
                  <span class="text-sm font-medium text-slate-700">阶段完成后跳转：</span>
                  <select v-model="selectedPhase.transitionType" class="input w-48" :disabled="selectedPhase.isLocked">
                    <option v-for="opt in transitionOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                  <select v-if="selectedPhase.transitionType === 'goto_phase'"
                    v-model="selectedPhase.transitionTargetId" class="input w-48" :disabled="selectedPhase.isLocked">
                    <option value="">选择目标阶段</option>
                    <option v-for="target in getAvailableTargets(selectedPhaseIndex)" :key="target.value"
                      :value="target.value">
                      {{ target.label }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- 跳转逻辑可视化 -->
              <div class="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <p class="text-xs font-medium text-slate-500">
                  🔀 跳转逻辑预览
                </p>
                <div class="mt-2 flex items-center gap-3 text-sm">
                  <span class="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700">{{
                    selectedPhase.name }}</span>
                  <span class="text-slate-400">→</span>
                  <span class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-medium text-blue-600">
                    {{ getTransitionLabel(selectedPhase.transitionType) }}
                  </span>
                  <span v-if="selectedPhase.transitionType === 'end_flow'" class="font-medium text-blue-600">🏁
                    流程结束</span>
                  <span v-else-if="selectedPhase.transitionType === 'loop_self'" class="font-medium text-amber-600">🔄
                    重新执行本阶段</span>
                  <span v-else-if="
                    selectedPhase.transitionType === 'previous_phase'
                  " class="font-medium text-purple-600">⬅️ 返回上一阶段</span>
                  <span v-else-if="selectedPhase.transitionType === 'goto_phase'" class="font-medium text-blue-600">
                    ➡️
                    {{
                      phases.find(
                        (p) => p.id === selectedPhase.transitionTargetId,
                      )?.name || '未选择'
                    }}
                  </span>
                  <span v-else class="font-medium text-emerald-600">➡️ 进入下一阶段</span>
                </div>
              </div>
            </div>

            <!-- ===== 规则与事件 ===== -->
            <div v-if="activeDetailTab === 'rules'"
              class="space-y-3 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-slate-700">阶段内规则列表（{{
                  selectedPhase.rules?.length || 0
                }}
                  条）</span>
                <button v-if="!selectedPhase.isLocked" class="btn-primary text-sm" @click="openAddRule">
                  ➕ 添加规则
                </button>
              </div>

              <div v-if="selectedPhase.rules && selectedPhase.rules.length > 0" class="space-y-2.5">
                <div v-for="(rule, idx) in selectedPhase.rules" :key="rule.id"
                  class="rule-card rounded-xl border p-4 transition-all hover:shadow-sm" :class="rule.type === 'delay'
                      ? 'border-orange-200 bg-orange-50/50'
                      : rule.type === 'safety'
                        ? 'border-purple-200 bg-purple-50/50'
                        : rule.type === 'assessment'
                          ? 'border-blue-200 bg-blue-50/50'
                          : 'border-emerald-200 bg-emerald-50/50'
                    ">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span class="text-lg">
                        {{
                          rule.type === 'delay'
                            ? '⚠️'
                            : rule.type === 'safety'
                              ? '🛡️'
                              : rule.type === 'assessment'
                                ? '📊'
                                : '✔️'
                        }}
                      </span>
                      <span class="text-sm font-semibold text-slate-800">{{
                        rule.name
                      }}</span>
                      <span class="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold"
                        :class="`${getRuleTypeInfo(rule.type).bg} ${getRuleTypeInfo(rule.type).color} border-current/20`">
                        {{ getRuleTypeInfo(rule.type).label }}
                      </span>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-slate-500">
                      <span class="flex items-center gap-1">⏱️ {{ rule.durationSec }}s</span>
                      <span class="font-bold" :class="rule.scoreChange >= 0
                          ? 'text-emerald-600'
                          : 'text-orange-600'
                        ">
                        {{ rule.scoreChange >= 0 ? '+' : ''
                        }}{{ rule.scoreChange }} 分
                      </span>
                      <div v-if="!selectedPhase.isLocked" class="ml-2 flex gap-1">
                        <button class="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          @click="openEditRule(idx)">
                          编辑
                        </button>
                        <button class="text-xs font-medium text-red-600 hover:text-red-800 hover:underline"
                          @click="deleteRule(idx)">
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                    <div class="flex items-start gap-1.5 text-slate-600">
                      <span class="font-medium text-slate-500">条件：</span>
                      <span class="flex-1 rounded border border-slate-200/60 bg-white/60 px-2 py-0.5">{{ rule.condition
                        || '未配置' }}</span>
                    </div>
                    <div class="flex items-start gap-1.5 text-slate-600">
                      <span class="font-medium text-slate-500">结果：</span>
                      <span class="flex-1 rounded border border-slate-200/60 bg-white/60 px-2 py-0.5">{{
                        rule.consequence || '未配置' }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else
                class="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-400">
                暂无规则，点击 “添加规则” 配置
              </div>
            </div>

            <!-- ===== 教学与评分 ===== -->
            <div v-if="activeDetailTab === 'scoring'" class="space-y-4">
              <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div class="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                  <p class="text-3xl font-bold text-blue-600">
                    {{ scoreCalc.total }}
                  </p>
                  <p class="text-xs font-medium text-slate-500">总得分</p>
                </div>
                <div class="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                  <p class="text-3xl font-bold text-emerald-600">
                    {{ scoreCalc.main }}
                  </p>
                  <p class="text-xs font-medium text-slate-500">主路径得分</p>
                </div>
                <div class="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                  <p class="text-3xl font-bold text-orange-600">
                    -{{ scoreCalc.delay }}
                  </p>
                  <p class="text-xs font-medium text-slate-500">
                    延误/安全扣分
                  </p>
                </div>
                <div class="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                  <p class="text-3xl font-bold text-purple-600">
                    {{ scoreCalc.maxPossible }}
                  </p>
                  <p class="text-xs font-medium text-slate-500">最大可能得分</p>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p class="text-sm font-semibold text-slate-700">
                    📊 规则统计
                  </p>
                  <div class="mt-3 space-y-1.5 text-sm text-slate-600">
                    <div class="flex justify-between border-b border-slate-100 pb-1">
                      <span class="text-emerald-600">●</span> 主路径
                      <span class="font-semibold">{{ ruleStats.main }} 条</span>
                    </div>
                    <div class="flex justify-between border-b border-slate-100 pb-1">
                      <span class="text-blue-600">●</span> 评估
                      <span class="font-semibold">{{ ruleStats.assessment }} 条</span>
                    </div>
                    <div class="flex justify-between border-b border-slate-100 pb-1">
                      <span class="text-orange-600">●</span> 延误分支
                      <span class="font-semibold">{{ ruleStats.delay }} 条</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-purple-600">●</span> 安全出口
                      <span class="font-semibold">{{ ruleStats.safety }} 条</span>
                    </div>
                  </div>
                </div>
                <div
                  class="flex items-center rounded-xl border border-purple-200 bg-purple-50/70 p-4 shadow-sm md:col-span-2">
                  <div class="text-sm text-purple-950">
                    <span class="font-bold">🎯 教学要点：</span> 学员需在
                    <span class="font-bold">{{
                      selectedPhase?.maxDurationSec || 120
                    }}</span>
                    秒内完成
                    <span class="font-bold">{{
                      selectedPhase?.rules?.length || 0
                    }}</span>
                    项核心操作。 延误超过阈值将触发扣分和纠错提示。
                  </div>
                </div>
              </div>

              <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p class="text-sm font-semibold text-slate-700">📝 评分明细</p>
                <div class="mt-3 space-y-1.5">
                  <div v-for="(rule, idx) in selectedPhase?.rules || []" :key="idx"
                    class="flex items-center justify-between border-b border-slate-100 py-1.5 text-sm last:border-0">
                    <span class="text-slate-600">{{ rule.name }}</span>
                    <span class="font-bold" :class="rule.scoreChange >= 0
                        ? 'text-emerald-600'
                        : 'text-orange-600'
                      ">
                      {{ rule.scoreChange >= 0 ? '+' : ''
                      }}{{ rule.scoreChange }} 分
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else
          class="flex h-60 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-slate-400">
          <div class="text-center">
            <span class="mb-2 block text-4xl">👈</span>
            请选择一个阶段进行配置
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 编辑弹窗 ==================== -->
    <Teleport to="body">
      <div v-if="showPhaseModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        @click.self="showPhaseModal = false">
        <div
          class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl">
          <div class="mb-5 flex items-center justify-between">
            <h3 class="text-xl font-semibold text-slate-800">
              {{ isEditing ? '编辑循环阶段' : '添加循环阶段' }}
            </h3>
            <button class="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              @click="showPhaseModal = false">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700">阶段名称 <span class="text-red-500">*</span></label>
              <input v-model="formData.name" class="input w-full" placeholder="如：可电击心律第1周期" />
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-slate-700">进入条件</label><input
                  v-model="formData.entryCondition" class="input w-full" placeholder="如：进入可电击心律周期" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700">进入规则ID</label><input
                  v-model="formData.entryRuleId" class="input w-full" placeholder="如：rule_cycle_1_start" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700">退出条件</label><input
                  v-model="formData.exitCondition" class="input w-full" placeholder="如：节律分析完成" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700">退出规则ID</label><input
                  v-model="formData.exitRuleId" class="input w-full" placeholder="如：rule_cycle_1_rhythm_check_due" />
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-slate-700">最大时长（秒）</label><input
                  v-model.number="formData.maxDurationSec" class="input w-full" type="number" min="10" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700">阶段完成后跳转</label>
                <select v-model="formData.transitionType" class="input w-full">
                  <option v-for="opt in transitionOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">描述</label>
              <input v-model="formData.description" class="input w-full" placeholder="阶段简要描述" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">活跃技能领域</label>
              <div class="mt-2 flex flex-wrap gap-2">
                <label v-for="track in trackOptions" :key="track.id"
                  class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition hover:bg-slate-50"
                  :class="formData.activeTrackIds.includes(track.id)
                      ? 'border-blue-400 bg-blue-50/80'
                      : 'border-slate-200'
                    ">
                  <input type="checkbox" :value="track.id" v-model="formData.activeTrackIds"
                    class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <span :class="formData.activeTrackIds.includes(track.id)
                      ? 'font-medium text-blue-700'
                      : 'text-slate-600'
                    ">{{ track.icon }} {{ track.label }}</span>
                </label>
              </div>
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              @click="showPhaseModal = false">
              取消
            </button>
            <button
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
              @click="savePhase">
              {{ isEditing ? '保存修改' : '添加阶段' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 删除确认弹窗 -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        @click.self="showDeleteConfirm = false">
        <div class="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl">
          <h3 class="text-lg font-semibold text-slate-800">⚠️ 确认删除</h3>
          <p class="mt-2 text-sm text-slate-600">
            确定要删除阶段 "{{
              deleteIndex >= 0 ? phases[deleteIndex]?.name : ''
            }}" 吗？此操作不可撤销。
          </p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              @click="showDeleteConfirm = false">
              取消
            </button>
            <button
              class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700"
              @click="executeDelete">
              确认删除
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ==================== 规则编辑弹窗（含闪电面板） ==================== -->
    <Teleport to="body">
      <div v-if="showRuleModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        @click.self="showRuleModal = false">
        <div
          class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl">
          <div class="mb-5 flex items-center justify-between">
            <h3 class="text-xl font-semibold text-slate-800">
              {{ editingRuleIndex >= 0 ? '编辑规则' : '添加规则' }}
            </h3>
            <button class="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              @click="showRuleModal = false">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700">规则名称 <span class="text-red-500">*</span></label>
              <input v-model="ruleFormData.name" class="input w-full" placeholder="如：识别可除颤节律" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700">规则类型</label>
                <select v-model="ruleFormData.type" class="input w-full">
                  <option value="main">主路径</option>
                  <option value="assessment">评估</option>
                  <option value="delay">延误分支</option>
                  <option value="safety">安全出口</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700">得分变化</label>
                <input v-model.number="ruleFormData.scoreChange" class="input w-full" type="number"
                  placeholder="如：10 或 -5" />
              </div>
            </div>

            <!-- ===== 触发条件 ===== -->
            <div class="relative">
              <label class="block text-sm font-medium text-slate-700">触发条件</label>
              <div class="mt-1 flex items-center gap-2">
                <input v-model="ruleFormData.condition" class="input flex-1" placeholder="如：VF/pVT 识别" />
                <button type="button"
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 text-blue-600 transition hover:border-blue-500 hover:bg-blue-100"
                  @click.stop="togglePhrasePanel('condition')" title="点击选择ACLS标准条件短语">
                  <span class="text-xl">⚡</span>
                </button>
              </div>
              <!-- 浮动短语面板（触发条件） -->
              <div v-if="showPhrasePanel && activeField === 'condition'" ref="phrasePanelRef"
                class="custom-scrollbar absolute left-0 top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
                @click.stop>
                <div
                  class="sticky top-0 flex items-center justify-between rounded-t-xl border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 backdrop-blur-sm">
                  <span class="text-xs font-medium text-slate-500">📋 ACLS 高频短语库（点击即填入）</span>
                  <button class="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                    @click="closePhrasePanel">
                    ✕
                  </button>
                </div>
                <div class="space-y-3 p-3">
                  <div v-for="group in filteredPhrases" :key="group.group" class="space-y-1.5">
                    <div class="text-xs font-semibold text-slate-400">
                      {{ group.group }}
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                      <button v-for="phrase in group.phrases" :key="phrase"
                        class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                        @click="selectPhrase(phrase)">
                        {{ phrase }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ===== 执行结果 ===== -->
            <div class="relative">
              <label class="block text-sm font-medium text-slate-700">执行结果/后果</label>
              <div class="mt-1 flex items-center gap-2">
                <input v-model="ruleFormData.consequence" class="input flex-1" placeholder="如：触发除颤流程" />
                <button type="button"
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 text-blue-600 transition hover:border-blue-500 hover:bg-blue-100"
                  @click.stop="togglePhrasePanel('consequence')" title="点击选择ACLS标准结果短语">
                  <span class="text-xl">⚡</span>
                </button>
              </div>
              <!-- 浮动短语面板（执行结果） -->
              <div v-if="showPhrasePanel && activeField === 'consequence'" ref="phrasePanelRef"
                class="custom-scrollbar absolute left-0 top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
                @click.stop>
                <div
                  class="sticky top-0 flex items-center justify-between rounded-t-xl border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 backdrop-blur-sm">
                  <span class="text-xs font-medium text-slate-500">📋 ACLS 高频短语库（点击即填入）</span>
                  <button class="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                    @click="closePhrasePanel">
                    ✕
                  </button>
                </div>
                <div class="space-y-3 p-3">
                  <div v-for="group in filteredPhrases" :key="group.group" class="space-y-1.5">
                    <div class="text-xs font-semibold text-slate-400">
                      {{ group.group }}
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                      <button v-for="phrase in group.phrases" :key="phrase"
                        class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                        @click="selectPhrase(phrase)">
                        {{ phrase }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700">时限（秒）</label>
              <input v-model.number="ruleFormData.durationSec" class="input w-full" type="number" min="10" />
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              @click="showRuleModal = false">
              取消
            </button>
            <button
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
              @click="saveRule">
              {{ editingRuleIndex >= 0 ? '保存修改' : '添加规则' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.stage-events-layout {
  @apply space-y-4;
}

.input {
  @apply w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400;
}

.btn-primary {
  @apply rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/20;
}

.btn-secondary {
  @apply rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:shadow-sm;
}

.phase-item {
  transition: all 0.2s ease;
}

.rule-card {
  transition: all 0.2s ease;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 9999px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
