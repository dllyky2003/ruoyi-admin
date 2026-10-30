<script lang="ts" setup>
import { ref, watch } from 'vue';

import { message } from 'ant-design-vue';

// ==================== Props ====================
const props = defineProps<{
  data?: any; // 病例版本数据，包含 definitionJson
}>();
const emit = defineEmits<{
  dataChange: [data: any];
}>();
const activeTab = ref<'abdominal' | 'neuro' | 'respiratory' | 'vascular'>(
  'vascular',
);
// ==================== 数据模型 ====================

// 分组一：血管与外周灌注
const vascular = ref({
  rightArmBP: '156/94',
  leftArmBP: '128/80',
  jvd: '否',
  // 拆分：原 femoralPulse 现分为两个独立字段
  femoralPulse: '减弱', // 股动脉搏动
  dorsalisPedisPulse: '减弱', // 足背动脉搏动
  crt: '>3秒',
});

// 分组二：肺部与呼吸
const respiratory = ref({
  lungBase: '湿啰音',
  lungApex: '清晰',
  accessoryMuscles: '是',
});

// 分组三：神经系统与头部
const neuro = ref({
  pupils: '等大等圆',
  faceSymmetry: '对称',
  gcsE: 3,
  gcsV: 4,
  gcsM: 6,
});

// 分组四：腹部与体表
const abdominal = ref({
  abdomen: '软',
  traumaLocation: '右前臂外侧 3cm 擦伤',
});

// 锁定状态（可选，用于防止 AI 覆盖）
const lockedFields = ref<Set<string>>(new Set());

// ==================== 选项数据 ====================
const jvdOptions = ['是', '否'] as const;
const crtOptions = ['<2秒', '2-3秒', '>3秒'] as const;
const lungOptions = [
  '清晰',
  '湿啰音',
  '哮鸣音',
  '呼吸音消失',
  '呼吸音减弱/不清',
] as const;
const lungApexOptions = ['清晰', '湿啰音', '哮鸣音'] as const;
const yesNoOptions = ['是', '否'] as const;
const pupilOptions = ['等大等圆', '不等大'] as const;
const faceOptions = ['对称', '不对称'] as const;
const abdomenOptions = ['软', '压痛', '反跳痛', '腹肌紧张/防御'] as const;
const jvdSupineVisibleOptions = ['平卧可见', '平卧不可见'] as const;
const dorsalisPedisPulseOption = ['是', '否'] as const;
const thighArteryPulseOptions = ['是', '否'] as const;

// ==================== 从 data 映射数据 ====================
function mapDataToForm() {
  if (!props.data?.definitionJson) return;

  const def = props.data.definitionJson;
  const exam = def.physical || {};

  // 血管
  if (exam.vascular) {
    vascular.value = { ...vascular.value, ...exam.vascular };
  }
  // 呼吸
  if (exam.respiratory) {
    respiratory.value = { ...respiratory.value, ...exam.respiratory };
  }
  // 神经
  if (exam.neuro) {
    neuro.value = { ...neuro.value, ...exam.neuro };
  }
  // 腹部
  if (exam.abdominal) {
    abdominal.value = { ...abdominal.value, ...exam.abdominal };
  }
}

// ==================== 监听数据变化 ====================
watch(
  () => props.data?.id,
  (newId) => {
    if (newId) {
      mapDataToForm();
    }
  },
  { immediate: true },
);

// ==================== 教学陷阱触发器（模拟） ====================
// 监听左臂血压，若左右压差 > 20，弹出警示
watch(
  () => vascular.value.leftArmBP,
  (newVal) => {
    const [leftSys] = newVal.split('/').map(Number);
    const [rightSys] = vascular.value.rightArmBP.split('/').map(Number);
    if (leftSys && rightSys && Math.abs(rightSys - leftSys) > 20) {
      message.warning('⚠️ 左右上肢血压压差 > 20 mmHg，主动脉夹层待排！');
    }
  },
);

// 监听颈静脉怒张，若为“是”则提示心包填塞风险
watch(
  () => vascular.value.jvd,
  (newVal) => {
    if (newVal === '是') {
      message.warning('⚠️ 颈静脉怒张提示心包填塞或右心衰，慎用硝酸甘油！');
    } else {
      message.info('✅ JVD 阴性，可安全使用硝酸甘油。');
    }
  },
);

// 监听瞳孔，若不等大则提示脑疝风险
watch(
  () => neuro.value.pupils,
  (newVal) => {
    if (newVal === '不等大') {
      message.error(
        '🚨 瞳孔不等大，高度怀疑脑疝！立即禁用溶栓并启动卒中CT流程！',
      );
    }
  },
);

// 监听腹部触诊，若非“软”则禁用阿司匹林/肝素
watch(
  () => abdominal.value.abdomen,
  (newVal) => {
    if (newVal === '软') {
      message.info('✅ 腹软，可安全使用阿司匹林和肝素。');
    } else {
      message.warning('⚠️ 腹部压痛/肌紧张，使用阿司匹林/肝素需谨慎！');
    }
  },
);

// ==================== 获取数据（供父组件调用） ====================
function getData() {
  return {
    vascular: vascular.value,
    respiratory: respiratory.value,
    neuro: neuro.value,
    abdominal: abdominal.value,
  };
}

defineExpose({ getData });

// ==================== 界面操作 ====================
// 切换锁定状态（示例）
function toggleLock(fieldKey: string) {
  if (lockedFields.value.has(fieldKey)) {
    lockedFields.value.delete(fieldKey);
  } else {
    lockedFields.value.add(fieldKey);
  }
}

function isLocked(fieldKey: string) {
  return lockedFields.value.has(fieldKey);
}
</script>
<template>
  <section class="space-y-6">
    <!-- 标题 -->
    <div class="border-b border-slate-200 pb-4">
      <h2 class="text-lg font-semibold text-slate-800">重点查体配置</h2>
      <p class="mt-1 text-sm text-slate-500">
        本模块所有字段均需人工核对，系统会根据录入值自动触发教学警示。
      </p>
    </div>

    <!-- 标签导航 -->
    <div class="flex gap-2 border-b border-slate-200">
      <button v-for="tab in [
        { key: 'vascular', label: '🩸 血管与外周灌注' },
        { key: 'respiratory', label: '🫁 肺部与呼吸' },
        { key: 'neuro', label: '🧠 神经系统与头部' },
        { key: 'abdominal', label: '🩺 腹部与体表' },
      ]" :key="tab.key" type="button" class="border-b-2 px-4 py-2 text-sm font-medium transition" :class="activeTab === tab.key
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-slate-500 hover:text-slate-700'
          " @click="activeTab = tab.key as typeof activeTab.value">
        {{ tab.label }}
      </button>
    </div>

    <!-- 分组一：血管与外周灌注 -->
    <div v-show="activeTab === 'vascular'" class="rounded-lg border border-slate-200 p-4">
      <h3 class="mb-3 font-semibold text-slate-800">🩸 血管与外周灌注</h3>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">右上臂袖带血压 (mmHg)</span>
          <input v-model="vascular.rightArmBP" class="field" placeholder="如 156/94" />
          <span class="mt-1 text-xs text-slate-400">首页已显示，需再次确认（考核复测意识）</span>
        </label>
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">左上臂袖带血压 (mmHg)</span>
          <input v-model="vascular.leftArmBP" class="field" placeholder="如 128/80" />
          <span class="mt-1 text-xs text-amber-600">若压差 > 20mmHg 将自动弹出夹层警示</span>
        </label>
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">颈静脉怒张 (JVD)</span>

          <div class="flex gap-4">
            <label class="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="jvdPresent" value="是" v-model="vascular.jvdPresent" />
              是
            </label>

            <label class="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="jvdPresent" value="否" v-model="vascular.jvdPresent" />
              否
            </label>
          </div>
        </label>

        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">JVD（平卧位）</span>
          <select v-model="vascular.jvdSupineVisible" class="field" :disabled="vascular.jvdPresent === '否'">
            <option v-for="opt in jvdSupineVisibleOptions" :key="opt">
              {{ opt }}
            </option>
          </select>
        </label>
        <!-- ======== 拆分后的两个下拉菜单 ======== -->
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">股动脉搏动</span>
          <select v-model="vascular.femoralPulse" class="field">
            <option v-for="opt in thighArteryPulseOptions" :key="opt.dictCode">
              {{ opt }}
            </option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">足背动脉搏动</span>
          <select v-model="vascular.dorsalisPedisPulse" class="field">
            <option v-for="opt in dorsalisPedisPulseOption" :key="opt.dictCode">
              {{ opt }}
            </option>
          </select>
        </label>
        <!-- ==================================== -->
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">毛细血管再充盈时间 (CRT)</span>
          <select v-model="vascular.crt" class="field">
            <option v-for="opt in crtOptions" :key="opt">{{ opt }}</option>
          </select>
        </label>
      </div>
    </div>

    <!-- 分组二：肺部与呼吸 -->
    <div v-show="activeTab === 'respiratory'" class="rounded-lg border border-slate-200 p-4">
      <h3 class="mb-3 font-semibold text-slate-800">🫁 肺部与呼吸</h3>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">双肺底听诊</span>
          <select v-model="respiratory.lungBase" class="field">
            <option v-for="opt in lungOptions" :key="opt">{{ opt }}</option>
          </select>
          <span class="mt-1 text-xs text-slate-400">Killip 分级依据</span>
        </label>
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">双肺尖听诊</span>
          <select v-model="respiratory.lungApex" class="field">
            <option v-for="opt in lungApexOptions" :key="opt">{{ opt }}</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">辅助呼吸肌动用</span>
          <select v-model="respiratory.accessoryMuscles" class="field">
            <option v-for="opt in yesNoOptions" :key="opt">{{ opt }}</option>
          </select>
          <span class="mt-1 text-xs text-amber-600">即使呼吸平稳，动用呼吸肌提示早期心衰</span>
        </label>
      </div>
    </div>

    <!-- 分组三：神经系统与头部 -->
    <div v-show="activeTab === 'neuro'" class="rounded-lg border border-slate-200 p-4">
      <h3 class="mb-3 font-semibold text-slate-800">🧠 神经系统与头部</h3>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">双侧瞳孔</span>
          <select v-model="neuro.pupils" class="field">
            <option v-for="opt in pupilOptions" :key="opt">{{ opt }}</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">面部是否对称</span>
          <select v-model="neuro.faceSymmetry" class="field">
            <option v-for="opt in faceOptions" :key="opt">{{ opt }}</option>
          </select>
        </label>
        <div class="grid grid-cols-3 gap-4 md:col-span-2">
          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-slate-700">GCS - 睁眼 (E)</span>
            <input v-model.number="neuro.gcsE" type="number" min="1" max="4" class="field" />
          </label>
          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-slate-700">GCS - 语言 (V)</span>
            <input v-model.number="neuro.gcsV" type="number" min="1" max="5" class="field" />
          </label>
          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-slate-700">GCS - 运动 (M)</span>
            <input v-model.number="neuro.gcsM" type="number" min="1" max="6" class="field" />
          </label>
        </div>
      </div>
    </div>

    <!-- 分组四：腹部与体表 -->
    <div v-show="activeTab === 'abdominal'" class="rounded-lg border border-slate-200 p-4">
      <h3 class="mb-3 font-semibold text-slate-800">🩺 腹部与体表</h3>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">腹部触诊 (压痛/反跳痛)</span>
          <select v-model="abdominal.abdomen" class="field">
            <option v-for="opt in abdomenOptions" :key="opt">{{ opt }}</option>
          </select>
          <span class="mt-1 text-xs text-slate-400">仅“腹软”允许安全使用阿司匹林/肝素</span>
        </label>
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">体表外伤具体部位</span>
          <input v-model="abdominal.traumaLocation" class="field" placeholder="如 右前臂外侧 3cm 擦伤" />
        </label>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="flex justify-end border-t border-slate-200 pt-4">
      底部提醒区
    </div>
  </section>
</template>

<style scoped>
.field {
  @apply w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100;
}
</style>
