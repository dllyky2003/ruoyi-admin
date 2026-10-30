<script setup lang="ts">
import type {
  CaseContract,
  StateContract,
  TransitionContract,
} from '../../../../api/ems/types';

import { computed, h, nextTick, onBeforeUnmount, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message, Modal } from 'ant-design-vue';

import { request } from '../../../../utils/request';

// ====================================================================
// ★ 弹窗 API
// ====================================================================
const [BasicModal, modalApi] = useVbenModal({
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      if (mermaidContainer.value) {
        mermaidContainer.value.innerHTML = '';
      }
      return;
    }

    const data = modalApi.getData<{ caseId?: string }>();
    init(data?.caseId || 'stable_narrow');
  },
});

// ====================================================================
// 状态
// ====================================================================
const caseId = ref<string>('stable_narrow');
const caseList = ref<string[]>([]);

const loading = ref(false);
const errorMessage = ref('');

const contract = ref<CaseContract | null>(null);

const selectedNodeId = ref<null | string>(null);
const selectedTransitionId = ref<null | string>(null);

const filterMode = ref<
  'all' | 'dead' | 'event' | 'intent' | 'selfLoop' | 'timer'
>('all');

const mermaidContainer = ref<HTMLElement | null>(null);

// ====================================================================
// 计算属性
// ====================================================================
const diagnostics = computed(() => contract.value?.diagnostics || null);

const selectedNode = computed<null | StateContract>(() => {
  if (!selectedNodeId.value || !contract.value) return null;
  return contract.value.states[selectedNodeId.value] || null;
});

const selectedTransition = computed<null | TransitionContract>(() => {
  if (!selectedTransitionId.value || !contract.value) return null;
  return contract.value.transitions[selectedTransitionId.value] || null;
});

// ====================================================================
// 初始化
// ====================================================================
async function init(initialCaseId: string) {
  caseId.value = initialCaseId;
  selectedNodeId.value = null;
  selectedTransitionId.value = null;
  await loadCaseList();
  await loadContract();
}

// ====================================================================
// 数据加载
// ====================================================================
async function loadCaseList() {
  try {
    const result = await request.get('/ems/contract/cases');
    caseList.value = result.data || [];
  } catch (error: any) {
    console.warn('加载案例列表失败', error);
  }
}

async function loadContract() {
  loading.value = true;
  errorMessage.value = '';

  try {
    const detailRes = await request.get('/ems/contract/detail', {
      params: { caseId: caseId.value },
    });
    contract.value = detailRes.data;
    selectedNodeId.value = null;
    selectedTransitionId.value = null;

    const mermaidRes = await request.get('/ems/contract/mermaid', {
      params: { caseId: caseId.value, withDiagnostics: true },
    });
    const mermaidCode = mermaidRes.msg;
    if (mermaidCode) {
      await nextTick();
      await renderMermaidCode(mermaidCode);
    } else {
      errorMessage.value = '未获取到 Mermaid 代码';
    }
  } catch (error: any) {
    console.error('加载契约失败', error);
    errorMessage.value = `加载契约失败：${error?.message || '未知错误'}`;
    message.error('加载契约失败');
  } finally {
    loading.value = false;
  }
}

async function reloadAll() {
  try {
    await request.post('/ems/contract/reloadAll');
    message.success('✅ 已触发全量重载');
    await loadContract();
  } catch (error: any) {
    message.error(`重载失败：${error?.message || '未知错误'}`);
  }
}

// ====================================================================
// 切换案例
// ====================================================================
async function onCaseChange() {
  await loadContract();
}

// ====================================================================
// Mermaid 渲染
// ====================================================================
async function renderMermaidCode(mermaidCode: string) {
  if (!mermaidContainer.value) {
    console.warn('[renderMermaidCode] 容器不存在');
    return;
  }
  if (!mermaidCode || typeof mermaidCode !== 'string') {
    errorMessage.value = '未获取到有效的 Mermaid 代码';
    console.warn('[renderMermaidCode] mermaidCode 无效:', mermaidCode);
    return;
  }

  try {
    const { default: mermaid } = await import('mermaid');

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'loose',
      fontFamily: 'sans-serif',
      themeVariables: {
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
        fontSize: '14px',
        lineColor: '#909399',
      },
      flowchart: {
        htmlLabels: false,
        useMaxWidth: false,
        curve: 'basis',
        padding: 20,
      },
    });

    mermaidContainer.value.innerHTML = '';

    const safeCaseId = String(caseId.value || 'case').replaceAll(/\W/g, '_');
    const renderId = `contract-${safeCaseId}-${Date.now()}`;

    const { svg } = await mermaid.render(renderId, mermaidCode);

    if (!svg) {
      throw new Error('mermaid.render 未返回 svg');
    }

    mermaidContainer.value.innerHTML = svg;

    await nextTick();
    applyZoom();
  } catch (error: any) {
    console.error('Mermaid 渲染失败', error);
    errorMessage.value = `渲染失败：${error?.message || error || '未知错误'}`;
    if (mermaidContainer.value) {
      mermaidContainer.value.innerHTML = '';
    }
  }
}

// ====================================================================
// 点击处理
// ====================================================================
const onMermaidClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  const nodeElement = target.closest('.node') as HTMLElement | null;
  if (!nodeElement) return;

  const stateId = nodeElement.dataset.state;
  if (!stateId) return;

  selectedNodeId.value = stateId;
  selectedTransitionId.value = null;
};

function selectTransition(transitionId: string) {
  selectedTransitionId.value = transitionId;
  selectedNodeId.value = null;
}

function jumpToTransition(transitionId: string) {
  selectTransition(transitionId);
}

// ====================================================================
// 缩放
// ====================================================================
const zoomLevel = ref(1);

function applyZoom() {
  if (!mermaidContainer.value) return;
  const svg = mermaidContainer.value.querySelector('svg');
  if (!svg) return;
  (svg as SVGElement).style.transform = `scale(${zoomLevel.value})`;
  (svg as SVGElement).style.transformOrigin = 'top left';
}

function zoomIn() {
  zoomLevel.value = Math.min(2, zoomLevel.value + 0.1);
  applyZoom();
}

function zoomOut() {
  zoomLevel.value = Math.max(0.4, zoomLevel.value - 0.1);
  applyZoom();
}

function resetZoom() {
  zoomLevel.value = 1;
  applyZoom();
}

// ====================================================================
// 过滤
// ====================================================================
async function setFilter(mode: typeof filterMode.value) {
  filterMode.value = mode;
  try {
    const mermaidRes = await request.get('/ems/contract/mermaid', {
      params: { caseId: caseId.value, withDiagnostics: true },
    });
    await renderMermaidCode(mermaidRes.msg);
  } catch (error: any) {
    console.warn('重新渲染失败', error);
  }
}

// ====================================================================
// 操作
// ====================================================================
function viewSourceFile(entityType: string, entityId: string) {
  Modal.info({
    title: `源文件位置：${entityType}`,
    content: h('div', { style: { lineHeight: '1.8' } }, [
      h('p', `实体: ${entityId}`),
      h('p', '请在以下配置文件中修改:'),
      h(
        'code',
        {
          style: {
            display: 'block',
            padding: '8px',
            background: '#f5f7fa',
            borderRadius: '4px',
          },
        },
        entityType === 'transition' || entityType === 'state'
          ? `config/acls/cases/${caseId.value}/_flow.yaml`
          : `config/acls/cases/${caseId.value}/_variables.json`,
      ),
    ]),
    okText: '知道了',
  });
}

function disableTransition(transitionId: string) {
  Modal.confirm({
    title: '⚠️ 确认禁用',
    content: `确定要禁用转移 ${transitionId} 吗？禁用的转移不会在运行时触发。`,
    okText: '确认禁用',
    cancelText: '取消',
    okType: 'danger',
    onOk: async () => {
      try {
        await request.post('/ems/contract/transition/disable', {
          caseId: caseId.value,
          transitionId,
        });
        message.success('已禁用，需重载配置生效');
        await loadContract();
      } catch (error: any) {
        message.error(`禁用失败：${error?.message || '未知错误'}`);
      }
    },
  });
}

// ====================================================================
// 工具函数
// ====================================================================
function toSafeId(stateId: string): string {
  return stateId.replaceAll(/\W/g, '_');
}

function formatTriggerType(t: TransitionContract): string {
  if (t.intentCode) return '意图';
  if (t.event) return '事件';
  if (t.systemTrigger) return '定时';
  return '未知';
}

function triggerTagClass(t: TransitionContract): string {
  if (t.intentCode) return 'tag-intent';
  if (t.event) return 'tag-event';
  if (t.systemTrigger) return 'tag-timer';
  return 'tag-dead';
}

/** ★ 新增：出边/转移的触发标识（意图编码 / 事件名 / 系统标识） */
function triggerLabel(t: TransitionContract): string {
  if (t.intentCode) return t.intentCode;
  if (t.event) return t.event;
  if (t.systemTrigger) return '（系统 / 定时）';
  return '（无触发源）';
}

// ====================================================================
// 清理
// ====================================================================
onBeforeUnmount(() => {
  if (mermaidContainer.value) {
    mermaidContainer.value.innerHTML = '';
  }
});
</script>

<template>
  <BasicModal title="配置方案" class="w-[1600px]  h-[800px]">
    <div class="contract-page">
      <!-- ============ Header ============ -->
      <div class="page-header">
        <div class="header-left">
          <h2>📋 契约维护</h2>

          <select v-model="caseId" class="case-selector" @change="onCaseChange">
            <option v-for="c in caseList" :key="c" :value="c">{{ c }}</option>
          </select>

          <span v-if="diagnostics" class="diagnostics-badges">
            <span v-if="diagnostics.undefinedDerivedVars.length > 0" class="badge danger">
              {{ diagnostics.undefinedDerivedVars.length }} 阻断
            </span>
            <span v-if="diagnostics.deadTransitions.length > 0" class="badge warning">
              {{ diagnostics.deadTransitions.length }} 死转移
            </span>
            <span v-if="diagnostics.selfLoops.length > 0" class="badge warning">
              {{ diagnostics.selfLoops.length }} 自循环
            </span>
            <span class="badge info">
              {{ Object.keys(contract?.states || {}).length }} 状态 ·
              {{ Object.keys(contract?.transitions || {}).length }} 转移
            </span>
          </span>
        </div>

        <div class="header-right">
          <button class="btn-default" @click="resetZoom">⟲ 重置缩放</button>
          <button class="btn-primary" @click="reloadAll">🔄 全量重载</button>
        </div>
      </div>

      <!-- ============ 主体 ============ -->
      <div class="main-layout">
        <!-- 左侧过滤器 -->
        <aside class="filter-sidebar">
          <div class="filter-title">过滤</div>
          <div class="filter-item" :class="{ active: filterMode === 'all' }" @click="setFilter('all')">
            全部
            <span class="count">{{
              Object.keys(contract?.transitions || {}).length
            }}</span>
          </div>
          <div class="filter-item" :class="{ active: filterMode === 'intent' }" @click="setFilter('intent')">
            意图触发
            <span class="count">{{
              Object.values(contract?.transitions || {}).filter(
                (t) => t.intentCode,
              ).length
            }}</span>
          </div>
          <div class="filter-item" :class="{ active: filterMode === 'event' }" @click="setFilter('event')">
            系统事件
            <span class="count">{{
              Object.values(contract?.transitions || {}).filter((t) => t.event)
                .length
            }}</span>
          </div>
          <div class="filter-item" :class="{ active: filterMode === 'timer' }" @click="setFilter('timer')">
            定时触发
            <span class="count">{{
              Object.values(contract?.transitions || {}).filter(
                (t) => t.systemTrigger,
              ).length
            }}</span>
          </div>
          <div class="filter-divider"></div>
          <div class="filter-item danger" :class="{ active: filterMode === 'dead' }" @click="setFilter('dead')">
            ⚠ 死转移
            <span class="count">{{
              Object.values(contract?.transitions || {}).filter((t) => t.dead)
                .length
            }}</span>
          </div>
          <div class="filter-item warning" :class="{ active: filterMode === 'selfLoop' }"
            @click="setFilter('selfLoop')">
            ↺ 自循环
            <span class="count">{{
              Object.values(contract?.transitions || {}).filter(
                (t) => t.selfLoop,
              ).length
            }}</span>
          </div>
        </aside>

        <!-- 中间 Mermaid -->
        <div class="graph-area">
          <div v-if="loading" class="overlay">加载中...</div>
          <div v-else-if="errorMessage" class="overlay error">
            {{ errorMessage }}
          </div>

          <div ref="mermaidContainer" class="mermaid-container" @click="onMermaidClick"></div>

          <div v-if="!loading && !errorMessage" class="zoom-controls">
            <button @click="zoomIn">＋</button>
            <button @click="zoomOut">－</button>
            <button @click="resetZoom">⟲</button>
            <span class="zoom-text">{{ Math.round(zoomLevel * 100) }}%</span>
          </div>

          <div class="legend">
            <div class="legend-item">
              <span class="legend-box initial"></span>初始状态
            </div>
            <div class="legend-item">
              <span class="legend-box end"></span>终止状态
            </div>
            <div class="legend-item">
              <span class="legend-box warning"></span>警告
            </div>
            <div class="legend-item">
              <span class="legend-box error"></span>错误
            </div>
          </div>
        </div>

        <!-- 右侧详情面板 -->
        <aside class="detail-sidebar" :class="{ empty: !selectedNode && !selectedTransition }">
          <!-- 空状态 -->
          <div v-if="!selectedNode && !selectedTransition" class="detail-empty">
            <div class="empty-icon">◇</div>
            <div class="empty-text">
              点击左侧 Mermaid 图的节点<br />查看契约详情
            </div>
          </div>

          <!-- ==================== 节点详情 ==================== -->
          <div v-else-if="selectedNode" class="detail-content">
            <div class="detail-header">
              <div class="detail-type">状态</div>
              <div class="detail-title">
                {{ selectedNode.stateDescription || selectedNode.stateId }}
              </div>
              <div class="detail-subtitle">{{ selectedNode.stateId }}</div>
              <div class="detail-badges">
                <span v-if="selectedNode.initialState" class="badge-badge initial">初始状态</span>
                <span v-if="selectedNode.endState" class="badge-badge end">终止状态</span>
              </div>
            </div>

            <!-- onEnter 规则 -->
            <div v-if="selectedNode.onEnterRules.length > 0" class="detail-section">
              <div class="section-title">
                onEnter 规则
                <span class="section-count">{{
                  selectedNode.onEnterRules.length
                }}</span>
              </div>
              <div class="code-list">
                <div v-for="(expr, i) in selectedNode.onEnterRules" :key="i" class="code-line">
                  {{ expr }}
                </div>
              </div>
            </div>

            <!-- ★ 出边（增强：显示触发意图编码 + 条件标签） -->
            <div class="detail-section">
              <div class="section-title">
                出边（{{ selectedNode.transitions.length }}）
              </div>
              <div v-if="selectedNode.transitions.length === 0" class="empty-hint">
                无出边
              </div>
              <div v-for="t in selectedNode.transitions" :key="t.transitionId" class="edge-item"
                :class="{ dead: t.dead, self: t.selfLoop }" @click="jumpToTransition(t.transitionId)">
                <!-- 头部：类型 + 触发标识 + 目标状态 -->
                <div class="edge-header">
                  <span class="tag" :class="[triggerTagClass(t)]">{{
                    formatTriggerType(t)
                  }}</span>
                  <span class="edge-intent">{{ triggerLabel(t) }}</span>
                  <span class="edge-target">→ {{ t.targetState }}</span>
                </div>

                <!-- 条件行（有/无条件都显示） -->
                <div v-if="t.guardExpression" class="edge-guard">
                  <span class="guard-label">条件</span>
                  <span class="guard-text">{{ t.guardExpression }}</span>
                </div>
                <div v-else class="edge-guard empty">
                  <span class="guard-label">条件</span>
                  <span class="guard-text">（无条件，直接触发）</span>
                </div>

                <!-- 警告标记 -->
                <div class="edge-warnings" v-if="t.dead || t.selfLoop">
                  <span v-if="t.dead" class="warn-tag">DEAD</span>
                  <span v-if="t.selfLoop" class="warn-tag">SELF-LOOP</span>
                </div>
              </div>
            </div>

            <!-- 变量摘要 -->
            <div class="detail-section">
              <div class="section-title">涉及变量</div>
              <div class="var-summary">
                <span class="var-badge read">读 {{ selectedNode.requiredVariables.length }}</span>
                <span class="var-badge write">写 1</span>
              </div>
            </div>

            <!-- 操作 -->
            <div class="detail-section">
              <div class="section-title">操作</div>
              <div class="action-group">
                <button class="btn-small" @click="viewSourceFile('state', selectedNode.stateId)">
                  📄 查看源文件
                </button>
              </div>
            </div>
          </div>

          <!-- ==================== 转移详情 ==================== -->
          <div v-else-if="selectedTransition" class="detail-content">
            <div class="detail-header">
              <div class="detail-type">转移</div>
              <div class="detail-title">
                {{ selectedTransition.sourceState }} →
                {{ selectedTransition.targetState }}
              </div>
              <div class="detail-subtitle">
                {{ selectedTransition.transitionId }}
              </div>
              <div class="detail-badges">
                <span class="badge-badge" :class="[triggerTagClass(selectedTransition)]">
                  {{ formatTriggerType(selectedTransition) }}
                </span>
                <span v-if="selectedTransition.dead" class="badge-badge dead">DEAD</span>
                <span v-if="selectedTransition.selfLoop" class="badge-badge warning">自循环</span>
                <span v-if="selectedTransition.deviation" class="badge-badge deviation">偏离路径</span>
              </div>
            </div>

            <!-- 诊断警告 -->
            <div v-if="selectedTransition.warnings.length > 0" class="detail-section">
              <div class="section-title">诊断警告</div>
              <div class="warning-list">
                <div v-for="(w, i) in selectedTransition.warnings" :key="i" class="warning-item">
                  ⚠ {{ w }}
                </div>
              </div>
            </div>

            <!-- ★ 触发标识（意图编码 / 事件 / 系统） -->
            <div class="detail-section">
              <div class="section-title">触发源</div>
              <div class="code-block">
                {{ triggerLabel(selectedTransition) }}
              </div>
            </div>

            <!-- Guard 表达式 -->
            <div v-if="selectedTransition.guardExpression" class="detail-section">
              <div class="section-title">Guard 表达式</div>
              <div class="code-block">
                {{ selectedTransition.guardExpression }}
              </div>
            </div>

            <!-- Action 表达式 -->
            <div v-if="selectedTransition.actionExpression" class="detail-section">
              <div class="section-title">Action 表达式</div>
              <div class="code-block">
                {{ selectedTransition.actionExpression }}
              </div>
            </div>

            <!-- 触发意图 -->
            <div v-if="selectedTransition.triggeringIntents.length > 0" class="detail-section">
              <div class="section-title">
                触发意图
                <span class="section-count">{{
                  selectedTransition.triggeringIntents.length
                }}</span>
              </div>
              <div class="intent-tags">
                <span v-for="intent in selectedTransition.triggeringIntents" :key="intent" class="intent-tag">
                  {{ intent }}
                </span>
              </div>
            </div>

            <!-- 读取变量 -->
            <div v-if="selectedTransition.readVariables.length > 0" class="detail-section">
              <div class="section-title">
                读取变量
                <span class="section-count">{{
                  selectedTransition.readVariables.length
                }}</span>
              </div>
              <div class="var-list">
                <span v-for="v in selectedTransition.readVariables" :key="v" class="var-tag read">{{ v }}</span>
              </div>
            </div>

            <!-- 写入变量 -->
            <div v-if="selectedTransition.writtenVariables.length > 0" class="detail-section">
              <div class="section-title">
                写入变量
                <span class="section-count">{{
                  selectedTransition.writtenVariables.length
                }}</span>
              </div>
              <div class="var-list">
                <span v-for="v in selectedTransition.writtenVariables" :key="v" class="var-tag write">{{ v }}</span>
              </div>
            </div>

            <!-- 操作 -->
            <div class="detail-section">
              <div class="section-title">操作</div>
              <div class="action-group">
                <button class="btn-small" @click="
                  viewSourceFile(
                    'transition',
                    selectedTransition.transitionId,
                  )
                  ">
                  📄 查看源文件
                </button>
                <button class="btn-small danger" :disabled="!selectedTransition.enabled"
                  @click="disableTransition(selectedTransition.transitionId)">
                  🚫 禁用转移
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </BasicModal>
</template>

<style scoped lang="scss">
/* ============ 页面布局 ============ */
.contract-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }

  .header-right {
    display: flex;
    gap: 8px;
  }
}

.case-selector {
  padding: 6px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 13px;
  background: #fff;
  cursor: pointer;
  color: #409eff;
  font-weight: 500;
  font-family: 'SF Mono', Monaco, monospace;

  &:focus {
    outline: none;
    border-color: #409eff;
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
  }
}

.diagnostics-badges {
  display: flex;
  gap: 8px;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid transparent;

  &.danger {
    background: #fef0f0;
    color: #f56c6c;
    border-color: #fbc4c4;
  }

  &.warning {
    background: #fdf6ec;
    color: #e6a23c;
    border-color: #f5dab1;
  }

  &.info {
    background: #f4f4f5;
    color: #909399;
    border-color: #d3d4d6;
  }
}

/* ============ 主布局 ============ */
.main-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 200px 1fr 420px;
  overflow: hidden;
}

/* ============ 左侧过滤器 ============ */
.filter-sidebar {
  background: #fff;
  border-right: 1px solid #e4e7ed;
  padding: 12px 0;
  overflow-y: auto;
}

.filter-title {
  padding: 8px 20px;
  font-size: 11px;
  font-weight: 600;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filter-item {
  padding: 8px 20px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-left: 2px solid transparent;
  transition: all 0.15s;

  &:hover {
    background: #f5f7fa;
    color: #303133;
  }

  &.active {
    background: #ecf5ff;
    color: #409eff;
    border-left-color: #409eff;
    font-weight: 500;
  }

  &.danger.active {
    background: #fef0f0;
    color: #f56c6c;
    border-left-color: #f56c6c;
  }

  &.warning.active {
    background: #fdf6ec;
    color: #e6a23c;
    border-left-color: #e6a23c;
  }

  .count {
    font-size: 11px;
    color: #909399;
    background: #f4f4f5;
    padding: 1px 6px;
    border-radius: 8px;
    font-family: 'SF Mono', Monaco, monospace;
  }

  &.active .count {
    background: rgba(64, 158, 255, 0.15);
    color: #409eff;
  }
}

.filter-divider {
  height: 1px;
  background: #ebeef5;
  margin: 8px 20px;
}

/* ============ 中间图区域 ============ */
.graph-area {
  position: relative;
  overflow: auto;
  background: #fafbfc;
  padding: 20px;
}

.overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 14px;
  color: #909399;

  &.error {
    color: #f56c6c;
  }
}

.mermaid-container {
  min-height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;

  :deep(svg) {
    transition: transform 0.15s ease-out;
  }

  :deep(.node) {
    cursor: pointer;

    &:hover rect,
    &:hover polygon,
    &:hover circle,
    &:hover path {
      filter: brightness(0.97);
      stroke-width: 3px;
    }
  }

  :deep(.node[data-state]) {
    cursor: pointer;
  }

  :deep(.edgePath) {
    cursor: pointer;

    &:hover path {
      stroke-width: 3px;
      stroke: #409eff;
    }
  }
}

.zoom-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  button {
    width: 30px;
    height: 30px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    color: #606266;
    transition: background 0.15s;

    &:hover {
      background: #f5f7fa;
      color: #409eff;
    }
  }

  .zoom-text {
    font-size: 12px;
    color: #909399;
    padding: 0 8px;
    font-family: 'SF Mono', Monaco, monospace;
  }
}

.legend {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  font-size: 12px;
  color: #606266;

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-box {
    width: 12px;
    height: 12px;
    border-radius: 3px;

    &.initial {
      background: #e6f7ff;
      border: 2px solid #1890ff;
    }

    &.end {
      background: #fff1f0;
      border: 2px solid #f5222d;
    }

    &.warning {
      background: #fff7e6;
      border: 2px solid #fa8c16;
    }

    &.error {
      background: #fff1f0;
      border: 2px solid #ff4d4f;
    }
  }
}

/* ============ 右侧详情面板 ============ */
.detail-sidebar {
  background: #fff;
  border-left: 1px solid #e4e7ed;
  overflow-y: auto;

  &.empty {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.detail-empty {
  text-align: center;
  color: #c0c4cc;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.4;
  }

  .empty-text {
    font-size: 13px;
    line-height: 1.8;
  }
}

.detail-content {
  padding: 20px;
}

.detail-header {
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 20px;

  .detail-type {
    display: inline-block;
    padding: 2px 8px;
    background: #f4f4f5;
    color: #909399;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .detail-title {
    font-size: 15px;
    font-weight: 600;
    color: #303133;
    line-height: 1.5;
    margin-bottom: 4px;
  }

  .detail-subtitle {
    font-size: 11px;
    color: #909399;
    font-family: 'SF Mono', Monaco, monospace;
    word-break: break-all;
    margin-bottom: 8px;
  }

  .detail-badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
}

.badge-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;

  &.initial {
    background: #e6f7ff;
    color: #1890ff;
  }

  &.end {
    background: #fff1f0;
    color: #f5222d;
  }

  &.dead {
    background: #fef0f0;
    color: #f56c6c;
  }

  &.warning {
    background: #fdf6ec;
    color: #e6a23c;
  }

  &.deviation {
    background: #fde8ef;
    color: #c2185b;
  }

  &.tag-intent {
    background: #e8f4fd;
    color: #1a73c9;
  }

  &.tag-event {
    background: #f0eafc;
    color: #7c3aed;
  }

  &.tag-timer {
    background: #fef3e6;
    color: #d97706;
  }

  &.tag-dead {
    background: #fef0f0;
    color: #f56c6c;
  }
}

.detail-section {
  margin-bottom: 20px;

  .section-title {
    font-size: 11px;
    font-weight: 600;
    color: #909399;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .section-count {
      font-size: 10px;
      color: #909399;
      background: #f4f4f5;
      padding: 1px 6px;
      border-radius: 8px;
      font-family: 'SF Mono', Monaco, monospace;
    }
  }
}

.code-block {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11.5px;
  background: #f5f7fa;
  padding: 10px 12px;
  border-radius: 5px;
  color: #303133;
  word-break: break-all;
  line-height: 1.6;
  border: 1px solid #ebeef5;
}

.code-list {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .code-line {
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 11.5px;
    background: #f5f7fa;
    padding: 8px 10px;
    border-radius: 5px;
    color: #303133;
    word-break: break-all;
    line-height: 1.5;
    border-left: 3px solid #d9ecff;
  }
}

.empty-hint {
  font-size: 12px;
  color: #c0c4cc;
  padding: 8px 0;
}

/* ★ 出边卡片（增强版） */
.edge-item {
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #c6e2ff;
    background: #f0f7ff;
  }

  &.dead {
    border-left: 3px solid #f56c6c;
  }

  &.self {
    border-left: 3px solid #e6a23c;
  }

  .edge-header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;

    .tag {
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 500;

      &.tag-intent {
        background: #e8f4fd;
        color: #1a73c9;
      }

      &.tag-event {
        background: #f0eafc;
        color: #7c3aed;
      }

      &.tag-timer {
        background: #fef3e6;
        color: #d97706;
      }

      &.tag-dead {
        background: #fef0f0;
        color: #f56c6c;
      }
    }

    .edge-intent {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 11px;
      color: #1a73c9;
      background: #f0f7ff;
      padding: 1px 6px;
      border-radius: 3px;
      word-break: break-all;
      max-width: 100%;
    }

    .edge-target {
      font-size: 12px;
      color: #606266;
      font-family: 'SF Mono', Monaco, monospace;
      margin-left: auto;
    }
  }

  .edge-guard {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 11px;
    color: #606266;
    word-break: break-all;
    line-height: 1.5;
    margin-bottom: 4px;

    .guard-label {
      flex-shrink: 0;
      display: inline-block;
      font-size: 10px;
      color: #909399;
      background: #f4f4f5;
      padding: 0 5px;
      border-radius: 3px;
      line-height: 16px;
      font-weight: 500;
    }

    .guard-text {
      flex: 1;
    }

    &.empty {
      .guard-text {
        color: #c0c4cc;
        font-style: italic;
      }
    }
  }

  .edge-warnings {
    display: flex;
    gap: 4px;
    margin-top: 6px;

    .warn-tag {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 3px;
      background: #fef0f0;
      color: #f56c6c;
      font-weight: 500;
    }
  }
}

.intent-tags,
.var-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.intent-tag {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11px;
  padding: 3px 8px;
  background: #f4f4f5;
  color: #606266;
  border-radius: 4px;
}

.var-tag {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  word-break: break-all;

  &.read {
    background: #ecf5ff;
    color: #1a73c9;
  }

  &.write {
    background: #f0f9eb;
    color: #2e7d32;
  }
}

.var-summary {
  display: flex;
  gap: 8px;

  .var-badge {
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;

    &.read {
      background: #ecf5ff;
      color: #1a73c9;
    }

    &.write {
      background: #f0f9eb;
      color: #2e7d32;
    }
  }
}

.warning-list {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .warning-item {
    padding: 8px 10px;
    background: #fdf6ec;
    border-left: 3px solid #e6a23c;
    border-radius: 4px;
    font-size: 12px;
    color: #a06000;
    line-height: 1.5;
  }
}

.action-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 4px;
  color: #606266;
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    border-color: #409eff;
    color: #409eff;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.danger:hover:not(:disabled) {
    border-color: #f56c6c;
    color: #f56c6c;
  }
}

.btn-default,
.btn-primary {
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-default {
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;

  &:hover {
    border-color: #409eff;
    color: #409eff;
  }
}

.btn-primary {
  border: 1px solid #409eff;
  background: #409eff;
  color: #fff;

  &:hover {
    background: #66b1ff;
    border-color: #66b1ff;
  }
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 4px;

  &:hover {
    background: #c0c4cc;
  }
}
</style>