<script setup lang="ts">
import { computed, reactive, watch } from 'vue';

import type {
  WorkflowNode,
  WorkflowNodeProperties,
} from '../types/workflow';

const props = defineProps<{ node: WorkflowNode | null }>();
const emit = defineEmits<{
  update: [nodeId: string, properties: WorkflowNodeProperties];
}>();

const defaults: WorkflowNodeProperties = {
  nodeType: 'action',
  name: '',
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
};

const form = reactive<WorkflowNodeProperties>({ ...defaults });

const currentNodeType = computed(() => {
  const type = props.node?.properties?.nodeType;
  if (type) return type;
  return props.node?.type === 'workflow-phase' ? 'phase' : 'state';
});

const isBackendNode = computed(
  () => currentNodeType.value === 'phase' || currentNodeType.value === 'state',
);
const isPhase = computed(() => currentNodeType.value === 'phase');
const nodeProperties = computed<Record<string, unknown>>(
  () => (props.node?.properties || {}) as Record<string, unknown>,
);

function readable(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.map(String).join('、') : '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function displayName(): string {
  const value = nodeProperties.value.displayName;
  return typeof value === 'string' && value ? value : readable(nodeProperties.value.name);
}

function loadForm(node: WorkflowNode | null) {
  // 删除旧节点的扩展属性，防止切换节点后把 A 节点的字段写进 B 节点。
  for (const key of Object.keys(form)) {
    delete (form as Record<string, unknown>)[key];
  }
  Object.assign(form, defaults, node?.properties || {});
  if (!form.name && node) {
    form.name = typeof node.text === 'string' ? node.text : node.text?.value || node.id;
  }
}

watch(() => props.node, loadForm, { immediate: true });

function saveProperties() {
  if (!props.node || isBackendNode.value) return;
  // 保留后端/插件扩展属性，避免只保存表单字段时发生信息丢失。
  emit('update', props.node.id, { ...props.node.properties, ...form });
}

function resetForm() {
  loadForm(props.node);
}
</script>

<template>
  <div class="node-properties">
    <div class="properties-header">
      <h3>节点属性</h3>
      <p>{{ isBackendNode ? '状态机配置（只读展示）' : '配置节点执行逻辑' }}</p>
    </div>

    <div v-if="!node" class="empty-state">
      <div class="empty-icon">◇</div>
      <p>请选择一个节点</p>
      <span>点击画布中的节点查看属性</span>
    </div>

    <div v-else class="properties-content">
      <div class="form-group">
        <label>节点 ID</label>
        <input :value="node.id" disabled />
      </div>
      <div class="form-group">
        <label>节点类型</label>
        <input :value="currentNodeType" disabled />
      </div>

      <!-- 后端阶段、状态节点：避免表单改动与 YAML 脱节。 -->
      <template v-if="isBackendNode">
        <div class="readonly-note">
          当前节点来自后端 YAML。此处仅供查看；暂未实现保存到 YAML 的接口。
        </div>
        <div class="form-group">
          <label>{{ isPhase ? '阶段名称' : '状态名称' }}</label>
          <input :value="isPhase ? displayName() : readable(nodeProperties.name || node.text)" disabled />
        </div>
        <div class="form-group">
          <label>描述</label>
          <textarea :value="readable(nodeProperties.description)" rows="3" disabled />
        </div>

        <template v-if="isPhase">
          <div class="section-title">阶段层级</div>
          <div class="form-group"><label>阶段 ID</label><input :value="readable(nodeProperties.phaseId || node.id)"
              disabled /></div>
          <div class="form-group"><label>父阶段 ID</label><input :value="readable(nodeProperties.parentPhaseId)"
              disabled /></div>
          <div class="form-group"><label>层级深度</label><input :value="readable(nodeProperties.depth)" disabled /></div>
          <div class="form-group"><label>子阶段数量</label><input :value="readable(nodeProperties.childCount)" disabled />
          </div>
          <div class="form-group"><label>叶子状态数量</label><input :value="readable(nodeProperties.leafStateCount)"
              disabled /></div>
          <div class="form-group"><label>包含状态</label><textarea
              :value="readable(nodeProperties.stateIds || nodeProperties.states)" rows="3" disabled /></div>
          <div class="form-group"><label>前置阶段</label><textarea :value="readable(nodeProperties.requiresPhases)" rows="2"
              disabled /></div>
          <div class="form-group"><label>阶段别名</label><textarea :value="readable(nodeProperties.aliases)" rows="2"
              disabled /></div>
          <p class="hint">双击画布中的阶段节点，可进入该阶段内部图（如存在）。</p>
        </template>
        <template v-else>
          <div class="section-title">状态机信息</div>
          <div class="form-group"><label>状态 ID</label><input :value="readable(nodeProperties.stateId || node.id)"
              disabled /></div>
          <div class="form-group"><label>所属阶段</label><input
              :value="readable(nodeProperties.phaseId || nodeProperties.parentPhaseId)" disabled /></div>
          <div class="form-group"><label>初始状态</label><input
              :value="readable(nodeProperties.isInitial ?? nodeProperties.initial)" disabled /></div>
          <div class="form-group"><label>结束状态</label><input
              :value="readable(nodeProperties.isEndState ?? nodeProperties.isEnd)" disabled /></div>
          <div v-if="nodeProperties.onEnterRules" class="form-group"><label>进入规则</label><textarea
              :value="readable(nodeProperties.onEnterRules)" rows="4" disabled /></div>
        </template>
        <div class="section-title">原始扩展属性</div>
        <pre class="raw-properties">{{ JSON.stringify(node.properties || {}, null, 2) }}</pre>
      </template>

      <!-- 原有六类设计器节点：维持原来的编辑功能。 -->
      <template v-else>
        <div class="form-group"><label>节点名称</label><input v-model="form.name" placeholder="请输入节点名称" /></div>
        <div class="form-group"><label>节点描述</label><textarea v-model="form.description" rows="3"
            placeholder="请输入节点描述" /></div>

        <template v-if="currentNodeType === 'action'">
          <div class="section-title">动作配置</div>
          <div class="form-group"><label>动作编码</label><input v-model="form.actionCode" placeholder="例如：CPR_START" />
          </div>
          <div class="form-group"><label>动作名称</label><input v-model="form.actionName" placeholder="例如：开始胸外按压" /></div>
          <div class="form-group">
            <label>执行角色</label>
            <select v-model="form.executor">
              <option value="leader">组长</option>
              <option value="npc_doctor">NPC医生</option>
              <option value="npc_nurse">NPC护士</option>
              <option value="npc_driver">NPC驾驶员</option>
              <option value="system">系统</option>
            </select>
          </div>
          <div class="form-group"><label>超时时间（毫秒）</label><input v-model.number="form.timeout" type="number" min="0" />
          </div>
          <div class="form-group"><label>输出变量</label><input v-model="form.outputVariable"
              placeholder="例如：cpr.started" /></div>
        </template>

        <template v-if="currentNodeType === 'condition'">
          <div class="section-title">条件判断</div>
          <div class="form-group"><label>输入变量</label><input v-model="form.inputVariable"
              placeholder="例如：patient.conscious" /></div>
          <div class="form-group">
            <label>比较运算符</label>
            <select v-model="form.operator">
              <option value="eq">等于（=）</option>
              <option value="ne">不等于（≠）</option>
              <option value="gt">大于（&gt;）</option>
              <option value="gte">大于等于（≥）</option>
              <option value="lt">小于（&lt;）</option>
              <option value="lte">小于等于（≤）</option>
              <option value="contains">包含</option>
            </select>
          </div>
          <div class="form-group"><label>比较值</label><input v-model="form.compareValue" placeholder="例如：false" /></div>
          <div class="condition-preview">
            <div class="preview-title">条件预览</div>
            <code>{{ form.inputVariable || '变量' }} {{ form.operator }} {{ form.compareValue || '比较值' }}</code>
          </div>
        </template>

        <template v-if="currentNodeType === 'event'">
          <div class="section-title">事件配置</div>
          <div class="form-group"><label>事件编码</label><input v-model="form.eventCode"
              placeholder="例如：VOICE_COMMAND_RECEIVED" /></div>
          <div class="form-group"><label>超时时间（毫秒）</label><input v-model.number="form.timeout" type="number" min="0" />
          </div>
        </template>

        <template v-if="currentNodeType === 'delay'">
          <div class="section-title">延迟配置</div>
          <div class="form-group"><label>延迟时间（毫秒）</label><input v-model.number="form.delay" type="number" min="0" />
          </div>
        </template>

        <div class="form-actions">
          <button class="btn-secondary" @click="resetForm">重置</button>
          <button class="btn-primary" @click="saveProperties">保存配置</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.node-properties {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #fff;
}

.properties-header {
  padding: 18px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.properties-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.properties-header p {
  margin: 8px 0 0;
  font-size: 12px;
  color: #9ca3af;
}

.empty-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.empty-icon {
  margin-bottom: 16px;
  font-size: 48px;
}

.empty-state p {
  margin: 0 0 8px;
  font-size: 14px;
  color: #6b7280;
}

.empty-state span {
  font-size: 12px;
}

.properties-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  margin-bottom: 7px;
  font-size: 12px;
  font-weight: 600;
  color: #4b5563;
}

.form-group input,
.form-group textarea,
.form-group select {
  box-sizing: border-box;
  width: 100%;
  padding: 9px 10px;
  font-size: 13px;
  color: #374151;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  outline: none;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  border-color: #3b82f6;
}

.form-group input:disabled,
.form-group textarea:disabled {
  color: #64748b;
  background: #f8fafc;
}

.section-title {
  padding-bottom: 10px;
  margin: 24px 0 16px;
  font-size: 13px;
  font-weight: 600;
  color: #2563eb;
  border-bottom: 1px solid #e5e7eb;
}

.condition-preview {
  padding: 12px;
  margin-top: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.preview-title {
  margin-bottom: 8px;
  font-size: 12px;
  color: #64748b;
}

.condition-preview code {
  font-size: 12px;
  color: #2563eb;
  overflow-wrap: anywhere;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}

.form-actions button {
  flex: 1;
  padding: 10px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
}

.btn-secondary {
  color: #374151;
  background: #fff;
  border: 1px solid #d1d5db;
}

.btn-primary {
  color: #fff;
  background: #2563eb;
  border: 1px solid #2563eb;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.readonly-note {
  padding: 10px 12px;
  margin-bottom: 18px;
  font-size: 12px;
  line-height: 1.6;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 6px;
}

.hint {
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}

.raw-properties {
  padding: 12px;
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 11px;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
</style>
