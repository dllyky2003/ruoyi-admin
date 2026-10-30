/**
 * 场景信息
 */
export interface Scenario {
  id: string;
  name: string;
  difficulty: 'ADVANCED' | 'BASIC' | 'EXPERT' | 'INTERMEDIATE';
  guideVersion: string;
  description: string;
}

/**
 * 会话信息
 */
export interface Session {
  id: string;
  scenarioId: string;
  traineeName: string;
  mode: 'EXAM' | 'TEACH';
  status: 'COMPLETED' | 'INIT' | 'PAUSED' | 'RUNNING';
  startTime: string;
  endTime?: string;
}

/**
 * WebSocket 转写消息
 */
export interface TranscriptMessage {
  type: 'transcript';
  text: string;
  isFinal: boolean;
  timestamp: number;
}

/**
 * WebSocket 提示消息
 */
export interface HintMessage {
  type: 'hint';
  data: {
    state: string;
    text: string;
  };
  timestamp: number;
}

/**
 * WebSocket 状态变更消息
 */
export interface StateChangeMessage {
  type: 'state_change';
  from: string;
  to: string;
  event: string;
  timestamp: number;
}
/**
 * 对比报告-单个学员摘要
 */
export interface ComparisonItem {
  sessionId: string;
  traineeName: string;
  totalScore: number;
  isPass: boolean;
  criticalErrors: string[];
  duration?: number; // 考核用时（秒）
}

/**
 * 对比报告
 */
export interface ComparisonReport {
  title: string;
  items: ComparisonItem[];
  summary: string;
  averageScore?: number;
  passRate?: number;
}

/**
 * EMS API 类型定义
 */

/** 场景信息 */
export interface Scenario {
  id: string;
  name: string;
  difficulty: 'ADVANCED' | 'BASIC' | 'EXPERT' | 'INTERMEDIATE';
  guideVersion: string;
  description: string;
}

/** 会话信息 */
export interface Session {
  id: string;
  scenarioId: string;
  traineeName: string;
  mode: 'EXAM' | 'TEACH';
  status: 'COMPLETED' | 'INIT' | 'PAUSED' | 'RUNNING';
  startTime: string;
  endTime?: string;
}

/** 评估结果 */
export interface EvaluationResult {
  id: string;
  sessionId: string;
  totalScore: number;
  isPass: boolean;
  dimensionScores: Record<string, number>;
  criticalErrors: string[];
  warnings: string[];
  reportText: string;
  agentFusionScore?: number;
  agentDetails?: Record<string, AgentOutput>;
}

/** 智能体输出 */
export interface AgentOutput {
  agentName: string;
  score: number;
  reasoning: string;
  detailedFindings: Record<string, any>;
  warnings: string[];
  recommendations: string[];
  hasCriticalViolation: boolean;
  criticalViolations?: string[];
  trace?: string;
}

/** WebSocket 消息类型 */
export type WsMessageType =
  | 'connected'
  | 'error'
  | 'hint'
  | 'pong'
  | 'state_change'
  | 'transcript';

/** WebSocket 消息基础结构 */
export interface WsMessage {
  type: WsMessageType;
  timestamp?: number;
  data?: any;
  text?: string;
  isFinal?: boolean;
  from?: string;
  to?: string;
  event?: string;
  message?: string;
}

// 具体消息类型（按需使用）
export interface TranscriptMessage extends WsMessage {
  type: 'transcript';
  text: string;
  isFinal: boolean;
}

export interface HintMessage extends WsMessage {
  type: 'hint';
  data: {
    state: string;
    text: string;
  };
}

export interface StateChangeMessage extends WsMessage {
  type: 'state_change';
  from: string;
  to: string;
  event: string;
}

export interface ErrorMessage extends WsMessage {
  type: 'error';
  data: {
    message: string;
  };
}

export interface IntentDefinition {
  intentCode: string; // 意图编码
  intentName: string; // 意图显示名称
  examples: string[]; // 示例文本列表
  // 以下字段由后端填充，前端可忽略
  layer?: string;
  subDomain?: string;
  general?: boolean;
  specific?: boolean;
  domainCode?: string;
  caseCode?: string;
}

/** 子域（后端 SubDomain 对应） */
export interface SubDomain {
  subDomainName: string; // 子域名称
  domainCode: string; // 域编码
  subDomainDescription?: string; // 子域描述
  extractionHint?: string; // 提取提示
  intents: IntentDefinition[]; // 该子域下的意图列表
}
export interface ContractData {
  caseId: string;
  states: Record<string, ContractNode>;
  transitions: Record<string, ContractTransition>;
  intents: Record<string, ContractIntent>;
  variables: Record<string, ContractVariable>;
  diagnostics: ContractDiagnostics;
}

export interface ContractNode {
  stateId: string;
  stateDescription: string;
  initialState: boolean;
  endState: boolean;
  onEnterRules: string[];
  transitions: ContractTransition[];
  requiredVariables: Set<string>;
  requiredIntents: Set<string>;
}

export interface ContractTransition {
  transitionId: string;
  sourceState: string;
  targetState: string;
  intentCode: null | string;
  event: null | string;
  systemTrigger: boolean;
  guardExpression: null | string;
  actionExpression: null | string;
  readVariables: Set<string>;
  writtenVariables: Set<string>;

  // ★ 新增：状态机写入相关的 2 个字段
  exitReason: null | string;
  effects: ContractEffect[];

  triggeringIntents: Set<string>;
  skills: Set<string>;
  dead: boolean;
  selfLoop: boolean;
  deviation: boolean;
  enabled: boolean;
  warnings: string[];
}

/** ★ 新增：状态机 effects 的单项 */
export interface ContractEffect {
  var: string;
  value?: any;
  valueExpression?: string;
}

export interface ContractDiagnostics {
  undefinedDerivedVars: string[];
  deadTransitions: string[];
  selfLoops: string[];
  unwritableVariables: string[];
  orphanVariables: string[];
  emptyIntents: string[];
  circularDependencies: string[];
}
