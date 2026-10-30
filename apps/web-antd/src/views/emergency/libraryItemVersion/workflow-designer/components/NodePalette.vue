<script setup lang="ts">
import {
  WORKFLOW_NODE_TEMPLATES,
  type WorkflowNodeTemplate,
} from '../types/workflow';

const emit = defineEmits<{
  addNode: [node: WorkflowNodeTemplate];
  dragStart: [node: WorkflowNodeTemplate];
}>();

function handleAddNode(
  event: MouseEvent,
  node: WorkflowNodeTemplate,
) {
  event.stopPropagation();
  emit('addNode', node);
}

function handleMouseDown(
  event: MouseEvent,
  node: WorkflowNodeTemplate,
) {
  if (event.button !== 0) return;

  emit('dragStart', node);
}
</script>

<template>
  <div class="node-palette">
    <div class="palette-header">
      <h3>工作流节点</h3>
      <p>拖拽节点到画布，或点击 + 添加</p>
    </div>

    <div class="node-list">
      <div v-for="node in WORKFLOW_NODE_TEMPLATES" :key="node.nodeType" class="node-item"
        @mousedown="handleMouseDown($event, node)">
        <div class="node-icon" :class="`node-${node.nodeType}`">
          <span v-if="node.nodeType === 'start'">▶</span>
          <span v-else-if="node.nodeType === 'end'">■</span>
          <span v-else-if="node.nodeType === 'action'">⚙</span>
          <span v-else-if="node.nodeType === 'condition'">◇</span>
          <span v-else-if="node.nodeType === 'event'">⚡</span>
          <span v-else>◷</span>
        </div>

        <div class="node-info">
          <div class="node-title">
            {{ node.label }}
          </div>

          <div class="node-description">
            {{ node.description }}
          </div>
        </div>

        <button class="add-button" type="button" title="点击添加节点" @mousedown.stop @click="handleAddNode($event, node)">
          +
        </button>
      </div>
    </div>

    <div class="palette-footer">
      <p>
        提示：按住节点拖动到画布；点击右侧 + 可直接添加。
      </p>
    </div>
  </div>
</template>

<style scoped>
.node-palette {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #fff;
}

.palette-header {
  padding: 18px 14px;
  border-bottom: 1px solid #e5e7eb;
}

.palette-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.palette-header p {
  margin: 8px 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.node-list {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
}

.node-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 66px;
  padding: 10px;
  margin-bottom: 10px;
  cursor: grab;
  user-select: none;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: background 0.2s, border-color 0.2s;
}

.node-item:hover {
  background: #eff6ff;
  border-color: #93c5fd;
}

.node-item:active {
  cursor: grabbing;
}

.node-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 18px;
  font-weight: 600;
  border-radius: 8px;
}

.node-start {
  color: #16a34a;
  background: #dcfce7;
}

.node-end {
  color: #dc2626;
  background: #fee2e2;
}

.node-action {
  color: #2563eb;
  background: #dbeafe;
}

.node-condition {
  color: #d97706;
  background: #fef3c7;
}

.node-event {
  color: #7c3aed;
  background: #ede9fe;
}

.node-delay {
  color: #0891b2;
  background: #cffafe;
}

.node-info {
  flex: 1;
  min-width: 0;
}

.node-title {
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.node-description {
  font-size: 11px;
  line-height: 1.5;
  color: #94a3b8;
}

.add-button {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: 20px;
  color: #2563eb;
  cursor: pointer;
  background: #dbeafe;
  border: none;
  border-radius: 6px;
}

.add-button:hover {
  color: #fff;
  background: #2563eb;
}

.palette-footer {
  padding: 12px;
  border-top: 1px solid #e5e7eb;
}

.palette-footer p {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: #94a3b8;
}
</style>