<script setup lang="ts">
import { computed } from 'vue'
import { Alert, Input, Table } from 'ant-design-vue'
import type { WorkflowInfo, WorkflowNode } from '../types/index.d'
import WfVariableSelector from '../components/WfVariableSelector.vue'

interface Props {
  workflow: WorkflowInfo
  wfNode: WorkflowNode
}

const props = defineProps<Props>()

// 初始化 nodeConfig
if (!props.wfNode.nodeConfig) {
  ;(props.wfNode as any).nodeConfig = {}
}

const nodeConfig = props.wfNode.nodeConfig as any

if (nodeConfig.message === undefined) {
  nodeConfig.message = '工作流调试日志'
}

// 初始化 inputConfig，变量选择器会维护 ref_inputs
if (!props.wfNode.inputConfig) {
  ;(props.wfNode as any).inputConfig = {
    user_inputs: [],
    ref_inputs: [],
  }
}

if (!Array.isArray(props.wfNode.inputConfig.user_inputs)) {
  ;(props.wfNode.inputConfig as any).user_inputs = []
}

if (!Array.isArray(props.wfNode.inputConfig.ref_inputs)) {
  ;(props.wfNode.inputConfig as any).ref_inputs = []
}

const refInputs = computed(() => props.wfNode.inputConfig.ref_inputs || [])

const columns = [
  {
    title: '调试变量名',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '引用输出变量',
    dataIndex: 'node_param_name',
    key: 'node_param_name',
  },
  {
    title: '来源节点',
    key: 'node_uuid',
    customRender: ({ record }: { record: any }) => {
      const sourceNode = props.workflow.nodes.find(
        (node: any) => node.uuid === record.node_uuid,
      ) as any

      return sourceNode?.title || record.node_uuid
    },
  },
]
</script>

<template>
  <div class="flex flex-col w-full space-y-4">
    <div>
      <div class="text-sm mb-1">调试日志标题</div>
      <Input
        v-model:value="nodeConfig.message"
        placeholder="例如：检查 ECG 节点输出"
        :maxlength="100"
        show-count
      />
      <div class="mt-1 text-xs text-gray-400">
        用于服务端日志和节点运行记录中的调试标识。
      </div>
    </div>

    <Alert
      type="info"
      show-icon
      message="选择需要打印的前序节点输出"
      description="运行时将打印所选变量的实际值，并将其原样透传给下游节点。"
    />

    <!-- 通用变量选择器：自动维护 inputConfig.ref_inputs -->
    <WfVariableSelector
      :workflow="workflow"
      :wf-node="wfNode"
      :exclude-nodes="[wfNode.uuid]"
    />

    <div v-if="refInputs.length > 0">
      <div class="mb-2 text-sm">
        已选择调试变量（{{ refInputs.length }}）
      </div>

      <Table
        :columns="columns"
        :data-source="refInputs"
        :pagination="false"
        row-key="uuid"
        size="small"
      />
    </div>
  </div>
</template>