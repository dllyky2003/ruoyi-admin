import type { Interview } from 'src/api/ems/types';

import { computed, ref } from 'vue';

import { useAppConfig } from '@vben/hooks';

// ====== 导入项目的 Axios 封装（统一请求） ======
import { message } from 'ant-design-vue';

import { get, post } from '../../../../../utils/request';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

// ==================== 新 JSON 结构类型定义 ====================
export interface BasicInfo {
  id?: number | string;
  name?: string;
  workflowType?: string;
  mode?: string;
  tags?: string;
  sourceGuideline?: string;
  sourceVersion?: string;
  status?: string;
  versionNo?: number | string;
  description?: string;
  learningObjectives?: string;
  difficultyLevel?: string;
  estimatedDurationMinutes?: number;
  sex?: string;
  age?: number;
  sopRef?: string;
  guidelineVersion?: string;
}

// ----- clinical -----
export interface Clinical {
  clinicalTopic: ClinicalTopic;
  initialState: InitialState;
  monitors: Monitor[];
  labResults: LabResult[];
}

export interface ClinicalTopic {
  chiefComplaint: string;
  background: string;
  scene: string;
}

export interface InitialState {
  consciousness: string;
  airway: string;
  breathing: string;
  circulation: string;
  ecg: string;
  appearance: string[];
}

export interface Monitor {
  key: string;
  item: string;
  value: string;
  unit: string;
  hint: string;
  locked: boolean;
}

export interface LabResult {
  id: string;
  category: string;
  name: string;
  value: number | string;
  unit: string;
  referenceRange: string;
  flag: string;
  visibility: string;
  delaySeconds: number;
  releaseCondition: string;
  note: string;
  locked: boolean;
}

// ----- physical -----
export interface Physical {
  vascular: Vascular;
  respiratory: Respiratory;
  neuro: Neuro;
  abdominal: Abdominal;
}

export interface Vascular {
  rightArmBP: string;
  leftArmBP: string;
  jvd: string;
  femoralPulse: string;
  dorsalisPedisPulse: string;
  crt: string;
}

export interface Respiratory {
  lungBase: string;
  lungApex: string;
  accessoryMuscles: string;
}

export interface Neuro {
  pupils: string;
  faceSymmetry: string;
  gcsE: number;
  gcsV: number;
  gcsM: number;
}

export interface Abdominal {
  abdomen: string;
  traumaLocation: string;
}

// ----- medication -----
export interface Medication {
  allergy: Allergy;
  homeMed: HomeMed;
  tempMed: TempMed;
  history: History;
}

export interface Allergy {
  hasAllergy: string;
  drugCategory: string;
  severity: string;
}

export interface HomeMed {
  longTerm: any[];
  anticoagulant: string;
  antiplatelet: string;
  pde5: string;
}

export interface TempMed {
  sedative: string;
  nitroGiven: string;
  nitroDose: string;
}

export interface History {
  hypertension: string;
  hypertensionYears: number;
  diabetes: string;
  renal: string;
  giBleed: string;
}

// ----- interview -----
export interface Interview {
  case_type_id: string;
  case_tag: string;
  messages: InterviewMessage[];
}

export interface InterviewMessage {
  turn_index: number;
  speaker_role: string;
  delegation: string;
  simulator_role: string;
  question_q_id: string;
  time_window: string;
  parallel_operation: string;
  question_text: string;
  model_answer: string;
  keywords_hit: string[];
  keywords_miss: string[];
  medical_consistency_flag: boolean;
  score: number;
}

// ----- resources -----
export interface Resources {
  resources: Resource[];
}

export interface Resource {
  id: string;
  kind: string;
  name: string;
  specification: string;
  initialStatus: string;
  quantity: number;
  unit: string;
  prerequisites: string[];
  usageLimit: string[];
  locked: boolean;
}

// ----- stages -----
export interface Stages {
  phases: Phase[];
  settings: StageSettings;
}

export interface Phase {
  id: string;
  name: string;
  sequence: number;
  type: string;
  entryRuleId: string;
  entryCondition: string;
  exitRuleId: string;
  exitCondition: string;
  transitionType: string;
  transitionTargetId: string;
  activeTrackIds: string[];
  maxDurationSec: number;
  nominalDurationSec: number;
  description: string;
  rules: PhaseRule[];
  isExpanded: boolean;
  isLocked: boolean;
}

export interface PhaseRule {
  id: string;
  name: string;
  type: string;
  condition: string;
  consequence: string;
  durationSec: number;
  scoreChange: number;
}

export interface StageSettings {
  cycleSeconds: number;
  maxCycles: number;
}

export interface EmergencyLibraryItemDefinition {
  basic: BasicInfo;
  clinical: Clinical;
  physical: Physical;
  medication: Medication;
  interview: Interview;
  resources: Resources;
  stages: Stages;
  validation: Record<string, any>;
}

// ----- EmergencyLibraryItemVersion（版本信息）-----
export interface EmergencyLibraryItemVersion {
  id?: number;
  name?: string;
  workflowType?: string;
  mode?: string;
  tags?: string;
  difficultyLevel?: string;
  estimatedDurationMinutes?: number;
  teachingplanTypeOptions?: string;
  sex?: string;
  age?: string;
  libraryItemId?: number;
  versionNo?: number;
  schemaVersion?: string;
  status?: string;
  definitionJson?: EmergencyLibraryItemDefinition;
  definitionHash?: string;
  sourceGuideline?: string;
  sourceVersion?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  changeReason?: string;
  reviewedBy?: number;
  reviewedAt?: string;
  createTime?: string;
  updateTime?: string;
  createdBy?: number;
  updatedBy?: number;
}

// ==================== 状态与加载函数 ====================
export const emergencyLibraryItemVersionInfo = ref<
  EmergencyLibraryItemVersion[]
>([]);

/**
 * 加载版本详情（使用 Axios 封装，自动携带 Token 和 clientid）
 */
export async function loadLibraryItemVersionInfo(versionId: string) {
  if (!versionId) {
    emergencyLibraryItemVersionInfo.value = [];
    return;
  }

  try {
    // 使用 get 方法，自动处理认证头及 clientid
    const result = await get<{ code: number; data: any; msg: string }>(
      '/emergency/libraryItemVersion/configure',
      { id: versionId },
      {
        showError: true,
        autoHandle401: true,
      },
    );

    if (result.code !== 200) {
      throw new Error(result.msg || '获取案例数据失败');
    }

    const data = result.data;

    emergencyLibraryItemVersionInfo.value = data ? [data] : [];
  } catch (error) {
    console.error('获取预设数据失败:', error);
    emergencyLibraryItemVersionInfo.value = [];
    // 错误已在拦截器中显示，无需重复提示
  }
}

/**
 * 保存版本详情（使用 Axios 封装）
 */
export async function saveLibraryItemVersionInfo(
  payload: EmergencyLibraryItemVersion,
): Promise<boolean> {
  if (!payload.id) {
    message.error('缺少版本ID，无法保存');
    return false;
  }

  try {
    const result = await post<{ code: number; data?: any; msg: string }>(
      '/emergency/libraryItemVersion/configure/save',
      payload,
      {
        showError: true,
        autoHandle401: true,
        showSuccess: true, // 可在拦截器中显示成功消息
      },
    );

    if (result.code !== 200) {
      throw new Error(result.msg || '保存失败');
    }

    // 更新本地缓存
    if (emergencyLibraryItemVersionInfo.value.length > 0) {
      emergencyLibraryItemVersionInfo.value[0] = {
        ...emergencyLibraryItemVersionInfo.value[0],
        ...payload,
        updateTime: new Date().toISOString(),
      };
    } else {
      emergencyLibraryItemVersionInfo.value = [payload as any];
    }

    message.success('保存成功！');
    return true;
  } catch (error) {
    console.error('保存数据失败:', error);
    return false;
  }
}

// ==================== 新数据读取工具函数 ====================
export function createVersionDataReader(
  versionData: EmergencyLibraryItemVersion,
) {
  const def = versionData.definitionJson as EmergencyLibraryItemDefinition;

  return {
    /** 案例元数据（从 interview.case_tag 提取标题） */
    getCaseMeta: () => ({
      title: def?.interview?.case_tag || '',
      caseType: def?.interview?.case_type_id || '',
    }),

    /** 获取所有阶段（按 sequence 排序） */
    getPhasesSorted: () => {
      const phases = def?.stages?.phases || [];
      return [...phases].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    },

    /** 获取所有规则（合并所有阶段的规则） */
    getRules: () => {
      const phases = def?.stages?.phases || [];
      return phases.flatMap((p) => p.rules || []);
    },

    /** 获取资源列表 */
    getResources: () => def?.resources?.resources || [],

    /** 获取监护仪数据 */
    getMonitors: () => def?.clinical?.monitors || [],

    /** 获取实验室结果 */
    getLabResults: () => def?.clinical?.labResults || [],

    /** 获取体格检查数据 */
    getPhysical: () => def?.physical || null,

    /** 获取用药史 */
    getMedication: () => def?.medication || null,

    /** 获取访谈对话 */
    getInterview: () => def?.interview || null,

    /** 获取阶段设置 */
    getStageSettings: () => def?.stages?.settings || null,

    /** 获取初始状态 */
    getInitialState: () => def?.clinical?.initialState || null,

    /** 获取版本状态 */
    getStatus: () => versionData.status || '',

    /** 获取版本号 */
    getVersionNo: () => versionData.versionNo || 0,
  };
}

export const currentVersionReader = computed(() => {
  const data = emergencyLibraryItemVersionInfo.value[0];
  return data ? createVersionDataReader(data) : null;
});
