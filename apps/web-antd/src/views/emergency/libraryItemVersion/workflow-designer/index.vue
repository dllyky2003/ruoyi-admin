<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import LogicFlow, {
  DiamondNode,
  DiamondNodeModel,
  EllipseNode,
  EllipseNodeModel,
  RectNode,
  RectNodeModel,
} from '@logicflow/core';

import '@logicflow/core/lib/style/index.css';

import NodePalette from './components/NodePalette.vue';
import NodeProperties from './components/NodeProperties.vue';
import { useLogicFlowDefinition } from './useLogicFlowDefinition';

import {
  createDefaultNodeProperties,
  getGraphType,
  isWorkflowNodeType,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeProperties,
  type WorkflowNodeTemplate,
  type WorkflowNodeType,
} from './types/workflow';

const props = withDefaults(defineProps<{ caseId?: string }>(), {
  caseId: 'stable_narrow',
});

const STORAGE_KEY = 'ruoyi-ai-workflow-designer-draft';

// 后端 YAML 子案例状态机（默认 stable_narrow，仅加载自身定义）
const {
  caseId: currentCaseId,
  full,
  definition,
  graphData,
  loading: definitionLoading,
  error: definitionError,
  loadDefinition,
} = useLogicFlowDefinition();

let disposed = false;
let loadSequence = 0;

const container = ref<HTMLElement | null>(null);
const selectedNode = ref<WorkflowNode | null>(null);
const jsonText = ref('');
const showJsonPanel = ref(false);
const message = ref('');
const messageType = ref<'success' | 'error' | 'info'>('info');

let lf: LogicFlow | null = null;
let messageTimer: ReturnType<typeof setTimeout> | null = null;

/* ==================== 提示消息 ==================== */

function notify(
  text: string,
  type: 'success' | 'error' | 'info' = 'info',
) {
  message.value = text;
  messageType.value = type;

  if (messageTimer) clearTimeout(messageTimer);

  messageTimer = setTimeout(() => {
    message.value = '';
  }, 3500);
}

/* ==================== 自定义节点 ==================== */

function registerWorkflowNodes(logicflow: LogicFlow) {
  class WorkflowRectModel extends RectNodeModel {
    setAttributes() {
      this.width = 160;
      this.height = 64;
      this.radius = 8;
    }
  }

  class WorkflowEllipseModel extends EllipseNodeModel {
    setAttributes() {
      this.rx = 70;
      this.ry = 30;
    }
  }

  class WorkflowDiamondModel extends DiamondNodeModel {
    setAttributes() {
      this.rx = 70;
      this.ry = 50;
    }
  }

  logicflow.register({
    type: 'workflow-rect',
    view: RectNode,
    model: WorkflowRectModel,
  });

  logicflow.register({
    type: 'workflow-ellipse',
    view: EllipseNode,
    model: WorkflowEllipseModel,
  });

  class WorkflowPhaseModel extends RectNodeModel {
    setAttributes() {
      this.width = 240;
      this.height = 86;
      this.radius = 12;
    }
  }

  logicflow.register({
    type: 'workflow-phase',
    view: RectNode,
    model: WorkflowPhaseModel,
  });

  logicflow.register({
    type: 'workflow-diamond',
    view: DiamondNode,
    model: WorkflowDiamondModel,
  });
}

/* ==================== 阶段层级导航 ==================== */
type PhaseItem = {
  id: string;
  displayName?: string;
  children?: PhaseItem[];
};
type PhaseDefinitionView = {
  phaseGraph?: WorkflowGraph;
  phaseGraphs?: Record<string, WorkflowGraph>;
  phaseHierarchy?: PhaseItem[];
};

// null = 顶层阶段总览；字符串 = 当前阶段 ID；'__all__' = 原完整状态图
const currentView = ref<string | null>(null);
const navigation = ref<{ id: string; name: string }[]>([]);
const viewTitle = computed(() =>
  currentView.value === '__all__'
    ? '完整状态图'
    : navigation.value.length
      ? navigation.value[navigation.value.length - 1]?.name || '阶段内部'
      : '阶段总览',
);

function phaseDefinition(): PhaseDefinitionView {
  return (definition.value || {}) as PhaseDefinitionView;
}

function findPhase(items: PhaseItem[] | undefined, id: string): PhaseItem | undefined {
  for (const item of items || []) {
    if (item.id === id) return item;
    const child = findPhase(item.children, id);
    if (child) return child;
  }
  return undefined;
}

function graphForView(view: string | null): WorkflowGraph {
  const def = phaseDefinition();
  if (view === '__all__') return graphData.value as WorkflowGraph;
  if (view === null) {
    return def.phaseGraph?.nodes?.length
      ? def.phaseGraph
      : (graphData.value as WorkflowGraph);
  }
  return def.phaseGraphs?.[view] || { nodes: [], edges: [] };
}

async function renderCurrentView() {
  if (!lf) return;
  const graph = normalizeGraph(graphForView(currentView.value));
  lf.render(graph);
  selectedNode.value = null;
  await nextTick();
  requestAnimationFrame(() => {
    if (disposed || !lf) return;
    lf.resize();
    lf.fitView();
  });
}

async function openPhase(phaseId: string) {
  const phase = findPhase(phaseDefinition().phaseHierarchy, phaseId);
  if (!phase) {
    notify(`阶段 ${phaseId} 不在阶段树中`, 'error');
    return;
  }
  if (!phaseDefinition().phaseGraphs?.[phaseId]) {
    notify(`后端尚未返回阶段 ${phaseId} 的内部图`, 'info');
    return;
  }
  navigation.value.push({ id: phase.id, name: phase.displayName || phase.id });
  currentView.value = phaseId;
  await renderCurrentView();
}

async function goToLevel(index: number) {
  navigation.value = navigation.value.slice(0, index + 1);
  currentView.value = navigation.value[index]?.id || null;
  await renderCurrentView();
}

async function showOverview() {
  navigation.value = [];
  currentView.value = null;
  await renderCurrentView();
}

async function showAllStates() {
  navigation.value = [];
  currentView.value = '__all__';
  await renderCurrentView();
}

/* ==================== 图数据 ==================== */

function getCurrentGraph(): WorkflowGraph {
  if (!lf) {
    return {
      nodes: [],
      edges: [],
    };
  }

  return lf.getGraphData() as unknown as WorkflowGraph;
}

function syncSelectedNode(nodeId: string) {
  if (!lf) return;

  const node = lf.getNodeModelById(nodeId);

  if (!node) {
    selectedNode.value = null;
    return;
  }

  selectedNode.value = {
    ...node.getData(),
    properties: { ...node.properties },
  } as WorkflowNode;
}

/* ==================== 节点尺寸诊断 ==================== */

function inspectNode(nodeId: string) {
  if (!lf) return;

  const node = lf.getNodeModelById(nodeId);

  if (!node) return;

  const model = node as typeof node & {
    rx?: number;
    ry?: number;
  };

  console.table({
    id: node.id,
    type: node.type,
    width: node.width,
    height: node.height,
    rx: model.rx,
    ry: model.ry,
  });
}

/* ==================== 添加节点 ==================== */

function createNode(
  template: WorkflowNodeTemplate,
  x: number,
  y: number,
) {
  if (!lf) return;

  const node = lf.addNode({
    type: getGraphType(template.nodeType),
    x,
    y,
    text: template.label,
    properties: createDefaultNodeProperties(template.nodeType),
  });

  syncSelectedNode(node.id);
  inspectNode(node.id);

  return node;
}

function handleAddNode(template: WorkflowNodeTemplate) {
  if (!lf) return;
  if (currentView.value !== '__all__') { notify('阶段视图暂不支持添加节点，请切换完整状态图', 'info'); return; }

  const graph = getCurrentGraph();

  const offset = graph.nodes.length * 25;

  createNode(
    template,
    350 + (offset % 200),
    250 + (offset % 160),
  );

  notify(`已添加：${template.label}`, 'success');
}

/* ==================== 拖拽添加 ==================== */

function handleDragStart(template: WorkflowNodeTemplate) {
  if (!lf) return;
  if (currentView.value !== '__all__') { notify('阶段视图暂不支持拖入节点', 'info'); return; }

  const type = getGraphType(template.nodeType);

  console.log('[LogicFlow] 开始拖拽:', {
    nodeType: template.nodeType,
    graphType: type,
  });

  lf.dnd.startDrag({
    type,
    text: template.label,
    properties: createDefaultNodeProperties(template.nodeType),
  });
}

/* ==================== 属性编辑 ==================== */

function handleUpdateProperties(
  nodeId: string,
  properties: WorkflowNodeProperties,
) {
  if (!lf) return;
  if (currentView.value !== '__all__') { notify('阶段视图暂不支持修改业务属性', 'info'); return; }

  lf.setProperties(nodeId, { ...properties });
  lf.updateText(nodeId, properties.name);

  syncSelectedNode(nodeId);

  notify('节点配置已更新', 'success');
}

/* ==================== 节点操作 ==================== */

function deleteSelectedNode() {
  if (currentView.value !== '__all__') { notify('阶段视图暂不支持删除节点', 'info'); return; }
  if (!lf || !selectedNode.value) {
    notify('请先选择节点', 'info');
    return;
  }

  lf.deleteNode(selectedNode.value.id);
  selectedNode.value = null;

  notify('节点已删除', 'success');
}

function undo() {
  lf?.undo();
  selectedNode.value = null;
}

function redo() {
  lf?.redo();
  selectedNode.value = null;
}

function zoomIn() {
  lf?.zoom(true);
}

function zoomOut() {
  lf?.zoom(false);
}

function fitView() {
  lf?.fitView();
}

function resetZoom() {
  lf?.resetZoom();
}

function clearGraph() {
  if (currentView.value !== '__all__') { notify('阶段视图暂不支持清空画布', 'info'); return; }
  if (!lf) return;

  if (!window.confirm('确定清空当前工作流吗？')) return;

  lf.clearData();
  selectedNode.value = null;

  notify('画布已清空', 'success');
}

/* ==================== JSON 导入导出 ==================== */

function exportJson() {
  jsonText.value = JSON.stringify(getCurrentGraph(), null, 2);
  showJsonPanel.value = true;
}

function downloadJson() {
  const blob = new Blob(
    [JSON.stringify(getCurrentGraph(), null, 2)],
    { type: 'application/json;charset=utf-8' },
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `workflow-${Date.now()}.json`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);

  notify('JSON 已下载', 'success');
}

function normalizeGraph(graph: WorkflowGraph): WorkflowGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const nodeType = node.properties?.nodeType;

      if (!isWorkflowNodeType(nodeType)) {
        return node;
      }

      return {
        ...node,
        type: getGraphType(nodeType),
      };
    }),
  };
}

function importJson() {
  if (!lf) return;
  if (currentView.value !== '__all__') { notify('请先切换完整状态图后再导入', 'info'); return; }

  try {
    const parsed: unknown = JSON.parse(jsonText.value);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('nodes' in parsed) ||
      !('edges' in parsed) ||
      !Array.isArray(parsed.nodes) ||
      !Array.isArray(parsed.edges)
    ) {
      throw new Error('JSON 必须包含 nodes 和 edges 数组');
    }

    const graph = normalizeGraph(parsed as WorkflowGraph);

    lf.render(graph);
    selectedNode.value = null;
    showJsonPanel.value = false;

    notify('工作流导入成功', 'success');
  } catch (error) {
    notify(
      `导入失败：${error instanceof Error ? error.message : '未知错误'}`,
      'error',
    );
  }
}

/* ==================== 本地草稿 ==================== */

function saveDraft() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(getCurrentGraph()),
    );

    notify('草稿已保存', 'success');
  } catch (error) {
    console.error(error);
    notify('草稿保存失败', 'error');
  }
}

function loadDraft() {
  if (!lf) return;

  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    notify('没有找到本地草稿', 'info');
    return;
  }

  try {
    const graph = normalizeGraph(
      JSON.parse(saved) as WorkflowGraph,
    );

    lf.render(graph);
    selectedNode.value = null;

    notify('草稿已恢复', 'success');
  } catch (error) {
    console.error(error);
    notify('草稿恢复失败', 'error');
  }
}

/* ==================== 基础校验 ==================== */

function validateWorkflow() {
  const graph = getCurrentGraph();
  const errors: string[] = [];

  const startNodes = graph.nodes.filter(
    (node) => node.properties?.nodeType === 'start',
  );

  const endNodes = graph.nodes.filter(
    (node) => node.properties?.nodeType === 'end',
  );

  if (startNodes.length !== 1) {
    errors.push('必须且只能有一个开始节点');
  }

  if (endNodes.length === 0) {
    errors.push('至少需要一个结束节点');
  }

  for (const node of graph.nodes) {
    const properties = node.properties;

    if (!properties?.name?.trim()) {
      errors.push(`节点 ${node.id} 未设置名称`);
    }

    if (
      properties?.nodeType === 'action' &&
      !properties.actionCode?.trim()
    ) {
      errors.push(`动作节点 ${node.id} 未设置动作编码`);
    }

    if (
      properties?.nodeType === 'condition' &&
      !properties.inputVariable?.trim()
    ) {
      errors.push(`条件节点 ${node.id} 未设置判断变量`);
    }
  }

  if (errors.length > 0) {
    jsonText.value = errors.join('\n');
    showJsonPanel.value = true;

    notify(`发现 ${errors.length} 个问题`, 'error');
    return;
  }

  notify('基础校验通过', 'success');
}

/* ==================== 后端接口预留 ==================== */

function saveToBackend() {
  console.log('待提交工作流:', getCurrentGraph());

  notify('尚未接入 Java 保存接口', 'info');
}

/* ==================== 后端状态机加载 ==================== */

/** 从 Java 后端读取状态机定义，并渲染到现有 LogicFlow 实例。 */
async function loadCaseStateMachine() {
  if (!lf) return;
  const sequence = ++loadSequence;
  const success = await loadDefinition();

  // 页面卸载或后续请求已发出时，忽略过期结果
  if (disposed || sequence !== loadSequence || !lf) return;

  if (!success) {
    notify(`加载状态机失败：${definitionError.value}`, 'error');
    return;
  }

  try {
    // 保持后端原始状态 ID 和转移规则属性；只处理节点类型兼容
    currentView.value = null;
    navigation.value = [];
    const graph = normalizeGraph(graphForView(null));
    await renderCurrentView();
    notify(
      `已加载 ${definition.value?.caseName || currentCaseId.value}：${graph.nodes.length} 个状态、${graph.edges.length} 条转移`,
      'success',
    );
  } catch (err) {
    console.error('[LogicFlow] 渲染失败', err);
    notify(`渲染失败：${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

async function switchInheritanceMode(value: boolean) {
  full.value = value;
  await loadCaseStateMachine();
}

/* ==================== 初始化 ==================== */

// 弹窗复用时，父组件切换案例后自动重新加载。
watch(
  () => props.caseId,
  (newCaseId) => {
    if (!newCaseId || newCaseId === currentCaseId.value) return;
    currentCaseId.value = newCaseId;
    if (lf) void loadCaseStateMachine();
  },
);

onMounted(() => {
  currentCaseId.value = props.caseId;
  if (!container.value) return;

  lf = new LogicFlow({
    container: container.value,

    grid: {
      size: 20,
      visible: true,
    },

    background: {
      color: '#f8fafc',
    },

    keyboard: {
      enabled: true,
    },

    edgeType: 'polyline',

    stopScrollGraph: true,
  });

  registerWorkflowNodes(lf);

  // 不再渲染固定的演示节点，改为加载后端子案例状态机。
  // 此处必须先完成 LogicFlow 初始化和自定义节点注册。
  void loadCaseStateMachine();

  lf.on('node:dblclick', ({ data }: any) => {
    const phaseId = data?.properties?.phaseId;
    if (typeof phaseId === 'string' && phaseId) void openPhase(phaseId);
  });

  lf.on('node:click', ({ data }: any) => {
    syncSelectedNode(data.id);
  });

  lf.on('blank:click', () => {
    selectedNode.value = null;
  });

  lf.on('node:delete', ({ data }: any) => {
    if (selectedNode.value?.id === data.id) {
      selectedNode.value = null;
    }
  });

  lf.on('node:drop', ({ data }: any) => {
    inspectNode(data.id);
    syncSelectedNode(data.id);
  });

  lf.on('node:dnd-add', ({ data }: any) => {
    console.log('[LogicFlow] DnD 节点创建:', data);

    inspectNode(data.id);
    syncSelectedNode(data.id);
  });

  lf.on('history:change', () => {
    if (selectedNode.value) {
      syncSelectedNode(selectedNode.value.id);
    }
  });

  console.log('[LogicFlow] 工作流设计器初始化完成');
});

onBeforeUnmount(() => {
  disposed = true;
  loadSequence++;
  if (messageTimer) {
    clearTimeout(messageTimer);
    messageTimer = null;
  }

  lf?.destroy();
  lf = null;
});
</script>

<template>
  <div class="workflow-page">
    <div class="workflow-toolbar">
      <div class="toolbar-title">
        <h2>工作流设计器</h2>
        <span>LogicFlow · RuoYi-AI</span>
      </div>

      <div class="toolbar-actions">
        <label class="case-selector">
          案例 ID
          <input v-model.trim="currentCaseId" placeholder="例如 stable_narrow" @keyup.enter="loadCaseStateMachine" />
        </label>
        <button :disabled="definitionLoading" @click="loadCaseStateMachine">
          {{ definitionLoading ? '加载中...' : '加载案例' }}
        </button>
        <label class="case-selector">
          <input :checked="full" type="checkbox" :disabled="definitionLoading"
            @change="switchInheritanceMode(($event.target as HTMLInputElement).checked)" />
          包含父级状态机
        </label>
        <span class="toolbar-divider"></span>
        <button @click="undo">撤销</button>
        <button @click="redo">重做</button>

        <span class="toolbar-divider"></span>

        <button @click="zoomIn">放大</button>
        <button @click="zoomOut">缩小</button>
        <button @click="fitView">适应画布</button>
        <button @click="resetZoom">重置缩放</button>

        <span class="toolbar-divider"></span>

        <button @click="validateWorkflow">校验</button>
        <button @click="exportJson">查看 JSON</button>
        <button @click="downloadJson">导出文件</button>

        <span class="toolbar-divider"></span>

        <button @click="saveDraft">保存草稿</button>
        <button @click="loadDraft">恢复草稿</button>

        <button class="primary-btn" @click="saveToBackend">
          保存到服务器
        </button>
      </div>
    </div>

    <div v-if="message" class="message-bar" :class="messageType">
      {{ message }}
    </div>

    <div class="workflow-designer">
      <aside class="node-panel">
        <NodePalette @add-node="handleAddNode" @drag-start="handleDragStart" />
      </aside>

      <main class="canvas-panel">
        <div class="phase-navigation">
          <button @click="showOverview">阶段总览</button>
          <template v-for="(item, index) in navigation" :key="item.id">
            <span class="nav-separator">›</span>
            <button @click="goToLevel(index)">{{ item.name }}</button>
          </template>
          <span class="nav-spacer"></span>
          <span class="nav-title">{{ viewTitle }}</span>
          <button @click="showAllStates">完整状态图</button>
        </div>
        <div ref="container" class="graph-container"></div>

        <div class="canvas-tools">
          <button @click="deleteSelectedNode">
            删除选中节点
          </button>

          <button @click="clearGraph">
            清空画布
          </button>
        </div>
      </main>

      <aside class="property-panel">
        <NodeProperties :node="selectedNode" @update="handleUpdateProperties" />
      </aside>
    </div>

    <div v-if="showJsonPanel" class="json-overlay">
      <div class="json-dialog">
        <div class="json-header">
          <h3>工作流 JSON / 校验结果</h3>

          <button @click="showJsonPanel = false">
            关闭
          </button>
        </div>

        <textarea v-model="jsonText" spellcheck="false" placeholder="在此粘贴工作流 JSON"></textarea>

        <div class="json-footer">
          <button @click="exportJson">
            刷新 JSON
          </button>

          <button class="primary-btn" @click="importJson">
            导入 JSON
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workflow-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 500px;
  background: #f1f5f9;
}

.workflow-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 66px;
  padding: 10px 18px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.case-selector {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  white-space: nowrap;
  color: #334155;
}

.case-selector input:not([type='checkbox']) {
  width: 155px;
  padding: 6px 8px;
  border: 1px solid #dbe1e8;
  border-radius: 5px;
}

.toolbar-title {
  flex-shrink: 0;
}

.toolbar-title h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #111827;
}

.toolbar-title span {
  font-size: 11px;
  color: #94a3b8;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.toolbar-actions button,
.canvas-tools button,
.json-header button,
.json-footer button {
  padding: 7px 11px;
  font-size: 12px;
  color: #334155;
  cursor: pointer;
  background: #fff;
  border: 1px solid #dbe1e8;
  border-radius: 5px;
}

.toolbar-actions button:hover,
.canvas-tools button:hover {
  background: #f1f5f9;
}

.toolbar-actions .primary-btn,
.json-footer .primary-btn {
  color: #fff;
  background: #2563eb;
  border-color: #2563eb;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  margin: 0 5px;
  background: #e2e8f0;
}

.message-bar {
  padding: 9px 18px;
  font-size: 12px;
}

.message-bar.success {
  color: #166534;
  background: #dcfce7;
}

.message-bar.error {
  color: #991b1b;
  background: #fee2e2;
}

.message-bar.info {
  color: #1d4ed8;
  background: #dbeafe;
}

.workflow-designer {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.node-panel {
  flex-shrink: 0;
  width: 220px;
  border-right: 1px solid #e5e7eb;
}

.canvas-panel {
  position: relative;
  flex: 1;
  min-width: 0;
  background: #f8fafc;
}

.graph-container {
  width: 100%;
  height: calc(100% - 46px);
}

.phase-navigation {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 12px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.phase-navigation button {
  padding: 5px 9px;
  color: #2563eb;
  cursor: pointer;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 5px;
}

.nav-separator {
  color: #94a3b8;
}

.nav-spacer {
  flex: 1;
}

.nav-title {
  font-size: 12px;
  color: #64748b;
}

.canvas-tools {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  gap: 8px;
  z-index: 10;
}

.property-panel {
  flex-shrink: 0;
  width: 300px;
  border-left: 1px solid #e5e7eb;
}

.json-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(15 23 42 / 50%);
}

.json-dialog {
  display: flex;
  flex-direction: column;
  width: min(900px, 90vw);
  height: min(700px, 85vh);
  padding: 20px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 20px 60px rgb(0 0 0 / 20%);
}

.json-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.json-header h3 {
  margin: 0;
  font-size: 16px;
}

.json-dialog textarea {
  flex: 1;
  width: 100%;
  padding: 14px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.6;
  resize: none;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  outline: none;
}

.json-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}
</style>