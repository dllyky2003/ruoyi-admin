<script lang="ts" setup>
import { ref, watch } from 'vue';

import { message } from 'ant-design-vue';

// ==================== Props ====================
const props = defineProps<{
  data?: any;
}>();

const emit = defineEmits<{
  dataChange: [data: any];
}>();

// ==================== 标签页状态 ====================
const activeTab = ref<'green' | 'red' | 'yellow'>('green');

// ==================== 数据模型 ====================

// 分组一：过敏史
const allergy = ref({
  hasAllergy: '无', // '有' | '无' | '不详'
  drugCategory: '', // 过敏药物类别
  severity: '', // 严重程度
});

// 分组二：常规家庭用药
const homeMed = ref({
  longTerm: [] as string[], // 多选值
  anticoagulant: '未服用', // 抗凝药
  antiplatelet: '未服用', // 抗血小板
  pde5: '未服用', // PDE5抑制剂
});

// 分组三：发病前后临时用药
const tempMed = ref({
  sedative: '未服用', // 镇静安眠药
  nitroGiven: '否', // 速效救心丸
  nitroDose: '', // 粒数
});

// 分组四：关键基础病史
const history = ref({
  hypertension: '无',
  hypertensionYears: 0,
  diabetes: '无',
  renal: '无',
  giBleed: '无',
});

// ==================== 选项数据 ====================
// 过敏
const allergyOptions = ['有', '无', '不详'] as const;
const drugCategoryOptions = [
  '青霉素类',
  '头孢菌素类',
  '磺胺类',
  '阿司匹林/水杨酸类',
  '造影剂',
  '其他 / 不详',
] as const;
const severityOptions = [
  '皮疹/荨麻疹（轻度）',
  '呼吸困难/喘息（中度）',
  '过敏性休克（重度）',
  '不详',
] as const;

// 长期用药多选
const longTermOptions = [
  '钙通道阻滞剂（如氨氯地平）',
  'ACEI/ARB类（如缬沙坦）',
  'β受体阻滞剂（如美托洛尔）',
  '他汀类（如阿托伐他汀）',
  '口服降糖药（二甲双胍）',
  '胰岛素',
  '利尿剂',
  '无 / 不详',
] as const;

const anticoagulantOptions = [
  '华法林',
  '利伐沙班',
  '达比加群',
  '未服用',
  '不详',
] as const;
const antiplateletOptions = ['氯吡格雷', '替格瑞洛', '未服用', '不详'] as const;
const pde5Options = [
  '是，24小时内服用',
  '是，超过24小时',
  '未服用',
  '不详 / 未问',
] as const;
const sedativeOptions = [
  '地西泮（安定）',
  '艾司唑仑',
  '佐匹克隆',
  '未服用',
  '不详',
] as const;
const nitroGivenOptions = ['是', '否', '不详'] as const;
const nitroDoseOptions = ['2粒', '3粒', '5粒', '10粒', '不详'] as const;
const hypertensionOptions = ['有', '无', '不详'] as const;
const yearsOptions = Array.from({ length: 10 }, (_, i) => i + 1);
const diabetesOptions = [
  '1型',
  '2型（饮食控制）',
  '2型（口服药）',
  '无',
  '不详',
] as const;
const renalOptions = ['有（透析）', '有（非透析）', '无', '不详'] as const;
const giOptions = ['有', '无', '不详'] as const;

// ==================== 从 data 映射数据 ====================
function mapDataToForm() {
  if (!props.data?.definitionJson) return;
  const def = props.data.definitionJson;
  const med = def.medication || {};
  if (med.allergy) allergy.value = { ...allergy.value, ...med.allergy };
  if (med.homeMed) homeMed.value = { ...homeMed.value, ...med.homeMed };
  if (med.tempMed) tempMed.value = { ...tempMed.value, ...med.tempMed };
  if (med.history) history.value = { ...history.value, ...med.history };
}

watch(
  () => props.data?.id,
  (newId) => {
    if (newId) mapDataToForm();
  },
  { immediate: true },
);

// ==================== 教学陷阱触发器 ====================
watch(
  () => allergy.value.severity,
  (newVal) => {
    if (newVal === '过敏性休克（重度）') {
      message.error('🚨 重度过敏史，阿司匹林禁用！');
    }
  },
);

watch(
  () => homeMed.value.pde5,
  (newVal) => {
    if (newVal === '是，24小时内服用') {
      message.error('🚨 24小时内服用PDE5抑制剂，硝酸甘油绝对禁忌！');
    }
  },
);

watch(
  () => history.value.renal,
  (newVal) => {
    if (newVal === '有（透析）') {
      message.warning('⚠️ 透析患者，PCI造影剂需谨慎！');
    }
  },
);

watch(
  () => history.value.giBleed,
  (newVal) => {
    if (newVal === '有') {
      message.warning('⚠️ 消化道出血史，抗凝治疗需评估！');
    }
  },
);

// ==================== 获取数据 ====================
function getData() {
  return {
    allergy: allergy.value,
    homeMed: homeMed.value,
    tempMed: tempMed.value,
    history: history.value,
  };
}

defineExpose({ getData });

// ==================== 辅助：一键绿色放行 ====================
function setGreenDefaults() {
  allergy.value.hasAllergy = '无';
  allergy.value.severity = '';
  history.value.renal = '无';
  history.value.giBleed = '无';
  homeMed.value.anticoagulant = '未服用';
  homeMed.value.antiplatelet = '未服用';
  homeMed.value.pde5 = '未服用';
  message.success('✅ 已一键设置绿色放行项，系统已补全默认值。');
}
</script>

<template>
  <section class="space-y-6">
    <!-- 标题 -->
    <div class="border-b border-slate-200 pb-4">
      <h2 class="text-lg font-semibold text-slate-800">
        💊 药物与过敏史（院前急救规范）
      </h2>
      <p class="mt-1 text-sm text-slate-500">
        按风险等级配置：绿色放行 → 黄色干扰 →
        红色安全锁。一键补全默认值，降低配置负担。
      </p>
    </div>

    <!-- 标签导航（绿→黄→红） -->
    <div class="flex gap-2 border-b border-slate-200">
      <button v-for="tab in [
        { key: 'green', label: '✅ 绿色放行' },
        { key: 'yellow', label: '⚠️ 黄色干扰' },
        { key: 'red', label: '🔒 红色安全锁' },
      ]" :key="tab.key" type="button" class="border-b-2 px-4 py-2 text-sm font-medium transition" :class="activeTab === tab.key
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-slate-500 hover:text-slate-700'
          " @click="activeTab = tab.key as 'green' | 'yellow' | 'red'">
        {{ tab.label }}
      </button>
    </div>

    <!-- ==================== 绿色放行标签页 ==================== -->
    <div v-show="activeTab === 'green'" class="rounded-lg border-2 border-green-500 bg-green-50 p-4">
      <h3 class="flex items-center gap-2 text-base font-bold text-green-700">
        <span class="text-xl">✅</span> 绿色放行信号
      </h3>
      <p class="text-sm text-green-700">
        以下项确认“无异常”后可一键放行，系统自动补全默认值。
      </p>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <!-- 有无药物过敏史 -->
        <div>
          <label class="block text-sm font-medium text-green-800">有无药物过敏史？</label>
          <div class="mt-1 flex flex-wrap gap-3">
            <label v-for="opt in allergyOptions" :key="opt" class="inline-flex items-center gap-1.5 text-sm">
              <input type="radio" v-model="allergy.hasAllergy" :value="opt" class="h-4 w-4 accent-green-600" />
              {{ opt }}
            </label>
          </div>
        </div>
        <!-- 过敏药物类别（二级联动） -->
        <div>
          <label class="block text-sm font-medium text-green-800">过敏药物类别（若有）</label>
          <select v-model="allergy.drugCategory" class="field border-green-300" :disabled="allergy.hasAllergy !== '有'">
            <option value="">请选择</option>
            <option v-for="opt in drugCategoryOptions" :key="opt">
              {{ opt }}
            </option>
          </select>
        </div>
        <!-- 长期服用的药物（多选） -->
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-green-800">患者长期服用的药物（可多选）</label>
          <div class="mt-1 flex flex-wrap gap-4">
            <label v-for="opt in longTermOptions" :key="opt" class="inline-flex items-center gap-1.5 text-sm">
              <input type="checkbox" v-model="homeMed.longTerm" :value="opt" class="h-4 w-4 accent-green-600" />
              {{ opt }}
            </label>
          </div>
        </div>
        <!-- 抗血小板药 -->
        <div>
          <label class="block text-sm font-medium text-green-800">是否服用抗血小板药？</label>
          <div class="mt-1 flex flex-wrap gap-3">
            <label v-for="opt in antiplateletOptions" :key="opt" class="inline-flex items-center gap-1.5 text-sm">
              <input type="radio" v-model="homeMed.antiplatelet" :value="opt" class="h-4 w-4 accent-green-600" />
              {{ opt }}
            </label>
          </div>
        </div>
        <!-- 基础病史 -->
        <div>
          <label class="block text-sm font-medium text-green-800">既往高血压史</label>
          <div class="flex items-center gap-2">
            <select v-model="history.hypertension" class="field flex-1 border-green-300">
              <option v-for="opt in hypertensionOptions" :key="opt">
                {{ opt }}
              </option>
            </select>
            <span class="text-sm">年限</span>
            <select v-model="history.hypertensionYears" class="field w-20 border-green-300"
              :disabled="history.hypertension !== '有'">
              <option v-for="y in yearsOptions" :key="y" :value="y">
                {{ y }}年
              </option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-green-800">既往糖尿病史</label>
          <select v-model="history.diabetes" class="field border-green-300">
            <option v-for="opt in diabetesOptions" :key="opt">{{ opt }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-green-800">既往肾功能不全史</label>
          <select v-model="history.renal" class="field border-green-300">
            <option v-for="opt in renalOptions" :key="opt">{{ opt }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-green-800">既往消化道出血/溃疡史</label>
          <select v-model="history.giBleed" class="field border-green-300">
            <option v-for="opt in giOptions" :key="opt">{{ opt }}</option>
          </select>
        </div>
      </div>
      <!-- 一键放行按钮 -->
      <div class="mt-4 flex justify-end">
        <button type="button"
          class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700"
          @click="setGreenDefaults">
          ✅ 一键设置绿色放行（全部无异常）
        </button>
      </div>
    </div>

    <!-- ==================== 黄色干扰标签页 ==================== -->
    <div v-show="activeTab === 'yellow'" class="rounded-lg border-2 border-yellow-500 bg-yellow-50 p-4">
      <h3 class="flex items-center gap-2 text-base font-bold text-yellow-700">
        <span class="text-xl">⚠️</span> 黄色干扰项（烟雾弹）
      </h3>
      <p class="text-sm text-yellow-700">
        这些信息易干扰学员判断，导师可配置以增加病例难度。
      </p>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <!-- 镇静药 -->
        <div>
          <label class="block text-sm font-medium text-yellow-800">发病前24h是否服用镇静/安眠药？</label>
          <select v-model="tempMed.sedative" class="field border-yellow-300">
            <option v-for="opt in sedativeOptions" :key="opt">{{ opt }}</option>
          </select>
        </div>
        <!-- 速效救心丸 -->
        <div>
          <label class="block text-sm font-medium text-yellow-800">现场目击者是否喂服过“速效救心丸”？</label>
          <div class="mt-1 flex flex-wrap gap-3">
            <label v-for="opt in nitroGivenOptions" :key="opt" class="inline-flex items-center gap-1.5 text-sm">
              <input type="radio" v-model="tempMed.nitroGiven" :value="opt" class="h-4 w-4 accent-yellow-600" />
              {{ opt }}
            </label>
          </div>
        </div>
        <!-- 速效救心丸粒数（子选项） -->
        <div v-if="tempMed.nitroGiven === '是'">
          <label class="block text-sm font-medium text-yellow-800">如果喂过，喂了几粒？</label>
          <select v-model="tempMed.nitroDose" class="field border-yellow-300">
            <option value="">请选择</option>
            <option v-for="opt in nitroDoseOptions" :key="opt">
              {{ opt }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- ==================== 红色安全锁标签页 ==================== -->
    <div v-show="activeTab === 'red'" class="rounded-lg border-2 border-red-500 bg-red-50 p-4">
      <h3 class="flex items-center gap-2 text-base font-bold text-red-700">
        <span class="text-xl">🔒</span> 红色安全锁（致命禁忌）
      </h3>
      <p class="text-sm text-red-600">
        以下选项必须明确选择，系统将据此执行安全拦截。
      </p>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <!-- 抗凝药 -->
        <div>
          <label class="block text-sm font-medium text-red-800">是否服用抗凝药？</label>
          <div class="mt-1 flex flex-wrap gap-3">
            <label v-for="opt in anticoagulantOptions" :key="opt" class="inline-flex items-center gap-1.5 text-sm">
              <input type="radio" v-model="homeMed.anticoagulant" :value="opt" class="h-4 w-4 accent-red-600" />
              {{ opt }}
            </label>
          </div>
        </div>
        <!-- PDE5抑制剂（伟哥） -->
        <div>
          <label class="block text-sm font-medium text-red-800">是否服用PDE5抑制剂（伟哥类）？</label>
          <div class="mt-1 flex flex-wrap gap-3">
            <label v-for="opt in pde5Options" :key="opt" class="inline-flex items-center gap-1.5 text-sm">
              <input type="radio" v-model="homeMed.pde5" :value="opt" class="h-4 w-4 accent-red-600" />
              {{ opt }}
            </label>
          </div>
        </div>
        <!-- 过敏严重程度 -->
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-red-800">过敏反应严重程度（若过敏）</label>
          <select v-model="allergy.severity" class="field border-red-300 bg-white">
            <option value="">请选择</option>
            <option v-for="opt in severityOptions" :key="opt">{{ opt }}</option>
          </select>
          <p class="mt-1 text-xs text-red-500">选“重度”将自动禁用阿司匹林。</p>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="flex justify-end border-t border-slate-200 pt-4">
      <button type="button"
        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        @click="emit('dataChange', getData())">
        保存药物与过敏史配置
      </button>
    </div>
  </section>
</template>

<style scoped>
.field {
  @apply w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100;
}
</style>
