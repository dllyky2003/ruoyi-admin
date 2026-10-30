import { ref } from 'vue';

import { requestClient } from '#/api/request';

/** LogicFlow 节点类型。 */
export interface LogicFlowNode {
  id: string;
  type: string;
  x: number;
  y: number;
  text?: string;
  properties?: Record<string, any>;
}

/** LogicFlow 连线类型。 */
export interface LogicFlowEdge {
  id: string;
  type: string;
  sourceNodeId: string;
  targetNodeId: string;
  text?: string;
  properties?: Record<string, any>;
}

/** 可直接传给 LogicFlow.render() 的图数据。 */
export interface LogicFlowGraph {
  nodes: LogicFlowNode[];
  edges: LogicFlowEdge[];
}

/** 后端 PhaseData 的递归结构。 */
export interface LogicFlowPhase {
  id: string;
  displayName?: string;
  parentId?: string | null;
  depth: number;
  childCount: number;
  leafStateCount: number;
  stateIds: string[];
  children: LogicFlowPhase[];
}

/** 对应后端 LogicFlowDefinitionDTO。 */
export interface LogicFlowDefinition {
  caseId: string;
  caseName?: string;
  version?: string | number;
  parent?: string;
  full: boolean;
  inheritanceChain: string[];
  /** 原有完整状态图，保留向后兼容。 */
  graph: LogicFlowGraph;
  /** 顶层阶段总览图。 */
  phaseGraph: LogicFlowGraph;
  /** 递归阶段树。 */
  phaseHierarchy: LogicFlowPhase[];
  /** 按阶段 ID 索引的内部图。 */
  phaseGraphs: Record<string, LogicFlowGraph>;
  /** 原始业务配置，供属性面板与后续 YAML 编辑使用。 */
  stateMachine: Record<string, any>;
}

const emptyGraph = (): LogicFlowGraph => ({ nodes: [], edges: [] });

function normalizeGraph(raw: unknown): LogicFlowGraph {
  if (!raw || typeof raw !== 'object') return emptyGraph();
  const graph = raw as Partial<LogicFlowGraph>;
  return {
    nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
    edges: Array.isArray(graph.edges) ? graph.edges : [],
  };
}

function normalizePhase(raw: unknown): LogicFlowPhase | null {
  if (!raw || typeof raw !== 'object') return null;
  const phase = raw as Record<string, any>;
  if (typeof phase.id !== 'string' || !phase.id) return null;
  return {
    id: phase.id,
    displayName: typeof phase.displayName === 'string' ? phase.displayName : phase.id,
    parentId: typeof phase.parentId === 'string' ? phase.parentId : null,
    depth: typeof phase.depth === 'number' ? phase.depth : 0,
    childCount: typeof phase.childCount === 'number' ? phase.childCount : 0,
    leafStateCount: typeof phase.leafStateCount === 'number' ? phase.leafStateCount : 0,
    stateIds: Array.isArray(phase.stateIds) ? phase.stateIds : [],
    children: Array.isArray(phase.children)
      ? phase.children.map(normalizePhase).filter((p): p is LogicFlowPhase => p !== null)
      : [],
  };
}

/** 兼容直接返回 DTO 或返回 R<DTO>，也兼容 requestClient 自动解包。 */
function normalizeDefinition(raw: unknown): LogicFlowDefinition {
  if (!raw || typeof raw !== 'object') {
    throw new Error('后端返回的状态机定义为空');
  }
  const response = raw as Record<string, any>;
  const data = response.graph ? response : response.data;
  if (!data || typeof data !== 'object') {
    throw new Error(response.msg || response.message || '无法获取状态机定义');
  }
  if (!data.graph) {
    throw new Error('状态机定义缺少 graph 字段');
  }

  const phaseGraphs: Record<string, LogicFlowGraph> = {};
  if (data.phaseGraphs && typeof data.phaseGraphs === 'object' && !Array.isArray(data.phaseGraphs)) {
    for (const [phaseId, graph] of Object.entries(data.phaseGraphs)) {
      phaseGraphs[phaseId] = normalizeGraph(graph);
    }
  }

  return {
    caseId: data.caseId || '',
    caseName: data.caseName || '',
    version: data.version,
    parent: data.parent || '',
    full: Boolean(data.full),
    inheritanceChain: Array.isArray(data.inheritanceChain) ? data.inheritanceChain : [],
    graph: normalizeGraph(data.graph),
    phaseGraph: normalizeGraph(data.phaseGraph),
    phaseHierarchy: Array.isArray(data.phaseHierarchy)
      ? data.phaseHierarchy.map(normalizePhase).filter((p: LogicFlowPhase | null): p is LogicFlowPhase => p !== null)
      : [],
    phaseGraphs,
    stateMachine: data.stateMachine && typeof data.stateMachine === 'object'
      ? data.stateMachine
      : {},
  };
}

export function useLogicFlowDefinition() {
  const caseId = ref<string>('stable_narrow');
  const full = ref<boolean>(false);
  const definition = ref<LogicFlowDefinition | null>(null);
  /** 原有完整状态图。 */
  const graphData = ref<LogicFlowGraph>(emptyGraph());
  /** 顶层阶段图。 */
  const phaseGraph = ref<LogicFlowGraph>(emptyGraph());
  /** 递归阶段树。 */
  const phaseHierarchy = ref<LogicFlowPhase[]>([]);
  /** 阶段内部图映射。 */
  const phaseGraphs = ref<Record<string, LogicFlowGraph>>({});
  const stateMachine = ref<Record<string, any>>({});
  const loading = ref(false);
  const error = ref('');
  const selectedStateId = ref<null | string>(null);
  const selectedTransitionId = ref<null | string>(null);

  /** 清空已加载数据，不改变 caseId/full。 */
  function resetData() {
    definition.value = null;
    graphData.value = emptyGraph();
    phaseGraph.value = emptyGraph();
    phaseHierarchy.value = [];
    phaseGraphs.value = {};
    stateMachine.value = {};
    selectedStateId.value = null;
    selectedTransitionId.value = null;
  }

  /** 加载当前案例的状态机定义。 */
  async function loadDefinition(): Promise<boolean> {
    if (!caseId.value || !caseId.value.trim()) {
      error.value = '请先选择案例';
      return false;
    }

    loading.value = true;
    error.value = '';
    selectedStateId.value = null;
    selectedTransitionId.value = null;

    try {
      const url = `/ems/contract/${encodeURIComponent(caseId.value)}/definition`;
      const result = await requestClient.get(url, { params: { full: full.value } });
      const normalized = normalizeDefinition(result);

      definition.value = normalized;
      graphData.value = normalized.graph;
      phaseGraph.value = normalized.phaseGraph;
      phaseHierarchy.value = normalized.phaseHierarchy;
      phaseGraphs.value = normalized.phaseGraphs;
      stateMachine.value = normalized.stateMachine;

      console.log('[useLogicFlowDefinition] 加载成功:', {
        caseId: normalized.caseId,
        full: normalized.full,
        nodeCount: normalized.graph.nodes.length,
        edgeCount: normalized.graph.edges.length,
        phaseCount: normalized.phaseHierarchy.length,
        phaseGraphCount: Object.keys(normalized.phaseGraphs).length,
      });
      return true;
    } catch (error_: any) {
      console.error('[useLogicFlowDefinition] 加载状态机失败', error_);
      error.value = error_?.message || '状态机定义加载失败';
      resetData();
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function loadCase(newCaseId: string, includeInherited = false) {
    caseId.value = newCaseId;
    full.value = includeInherited;
    return await loadDefinition();
  }

  async function setFull(includeInherited: boolean) {
    full.value = includeInherited;
    return await loadDefinition();
  }

  async function reloadDefinition() {
    return await loadDefinition();
  }

  function clearDefinition() {
    resetData();
    error.value = '';
  }

  return {
    caseId,
    full,
    definition,
    graphData,
    phaseGraph,
    phaseHierarchy,
    phaseGraphs,
    stateMachine,
    loading,
    error,
    selectedStateId,
    selectedTransitionId,
    loadDefinition,
    loadCase,
    setFull,
    reloadDefinition,
    clearDefinition,
  };
}
