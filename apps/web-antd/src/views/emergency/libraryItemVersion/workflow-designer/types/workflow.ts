/**
 * 工作流节点类型定义。
 * LogicFlow 负责可视化；Java/YAML 是状态机运行与业务配置的权威来源。
 */

/** 兼容原有设计器节点，并增加后端状态机/阶段节点。 */
export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'action'
  | 'condition'
  | 'event'
  | 'delay'
  | 'state'
  | 'phase';

export type ExecutorType =
  | 'leader'
  | 'npc_doctor'
  | 'npc_nurse'
  | 'npc_driver'
  | 'system';

export type ConditionOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains';

export type NodeExecutionStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped';

export type WorkflowGraphType =
  | 'workflow-rect'
  | 'workflow-ellipse'
  | 'workflow-diamond'
  | 'workflow-phase';

/**
 * 业务属性保留开放结构，避免后端新增字段在前端转换时丢失。
 * 注意：阶段节点是导航/配置展示节点，不是运行时状态。
 */
export interface WorkflowNodeProperties {
  nodeType: WorkflowNodeType;
  name: string;
  description?: string;

  actionCode?: string;
  actionName?: string;
  executor?: ExecutorType;

  inputVariable?: string;
  outputVariable?: string;
  operator?: ConditionOperator;
  compareValue?: string;

  eventCode?: string;
  timeout?: number;
  delay?: number;
  executionStatus?: NodeExecutionStatus;

  /** 阶段导航与层级关系。 */
  phaseId?: string;
  parentPhaseId?: string | null;
  displayName?: string;
  depth?: number;
  childCount?: number;
  leafStateCount?: number;
  stateIds?: string[];
  hasChildren?: boolean;
  requiresPhases?: string[];
  aliases?: string[];

  /** 后端状态机标识及原始业务字段。 */
  stateId?: string;
  initial?: boolean;
  isInitial?: boolean;
  isEnd?: boolean;
  isEndState?: boolean;
  onEnterRules?: string[];

  [key: string]: unknown;
}

export interface WorkflowNode {
  id: string;
  type: string;
  x: number;
  y: number;
  text?:
    | string
    | {
        x: number;
        y: number;
        value: string;
      };
  properties: WorkflowNodeProperties;
}

export interface WorkflowEdge {
  id?: string;
  type: string;
  sourceNodeId: string;
  targetNodeId: string;
  text?:
    | string
    | {
        x: number;
        y: number;
        value: string;
      };
  properties?: {
    transitionIndex?: number;
    transitionRule?: Record<string, unknown>;
    requiresPhase?: boolean;
    [key: string]: unknown;
  };
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNodeTemplate {
  nodeType: WorkflowNodeType;
  label: string;
  description: string;
  graphType: WorkflowGraphType;
}

/**
 * 仅保留原有六类可拖拽节点，避免误将阶段/状态节点当作通用动作节点创建。
 * 后端阶段节点通过 graph/phaseGraph/phaseGraphs 渲染。
 */
export const WORKFLOW_NODE_TEMPLATES: WorkflowNodeTemplate[] = [
  {
    nodeType: 'start',
    label: '开始节点',
    description: '工作流开始',
    graphType: 'workflow-ellipse',
  },
  {
    nodeType: 'end',
    label: '结束节点',
    description: '工作流结束',
    graphType: 'workflow-ellipse',
  },
  {
    nodeType: 'action',
    label: '动作节点',
    description: '执行急救动作或系统操作',
    graphType: 'workflow-rect',
  },
  {
    nodeType: 'condition',
    label: '条件判断',
    description: '根据变量决定流程分支',
    graphType: 'workflow-diamond',
  },
  {
    nodeType: 'event',
    label: '事件等待',
    description: '等待语音指令或场景事件',
    graphType: 'workflow-rect',
  },
  {
    nodeType: 'delay',
    label: '延迟节点',
    description: '等待指定时间',
    graphType: 'workflow-rect',
  },
];

export function createDefaultNodeProperties(
  nodeType: WorkflowNodeType,
): WorkflowNodeProperties {
  const template = WORKFLOW_NODE_TEMPLATES.find(
    (item) => item.nodeType === nodeType,
  );

  return {
    nodeType,
    name:
      template?.label ||
      (nodeType === 'phase'
        ? '未命名阶段'
        : nodeType === 'state'
          ? '未命名状态'
          : '未命名节点'),
    description: '',
    actionCode: '',
    actionName: '',
    executor: 'system',
    inputVariable: '',
    outputVariable: '',
    operator: 'eq',
    compareValue: '',
    eventCode: '',
    timeout: 30000,
    delay: 1000,
    executionStatus: 'idle',
  };
}

/**
 * 业务节点类型 -> LogicFlow 已注册的图形类型。
 * workflow-phase 必须在编辑器中 register 后才能渲染。
 */
export function getGraphType(
  nodeType: WorkflowNodeType,
): WorkflowGraphType {
  switch (nodeType) {
    case 'start':
    case 'end':
      return 'workflow-ellipse';

    case 'condition':
      return 'workflow-diamond';

    case 'phase':
      return 'workflow-phase';

    case 'action':
    case 'event':
    case 'delay':
    case 'state':
    default:
      return 'workflow-rect';
  }
}

/** 包括不可从节点面板直接拖入的 state / phase 类型。 */
export function isWorkflowNodeType(
  value: unknown,
): value is WorkflowNodeType {
  return (
    typeof value === 'string' &&
    (value === 'state' ||
      value === 'phase' ||
      WORKFLOW_NODE_TEMPLATES.some((item) => item.nodeType === value))
  );
}
