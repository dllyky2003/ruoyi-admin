<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { Button, Collapse, Input, Select } from 'ant-design-vue'
import type { VNodeChild } from 'vue'
import {
  emptyWorkflowInfo,
  getIconByComponentName,
  getIconClassByComponentName,
} from '../utils/workflow-util'
import SvgIcon from './SvgIcon.vue'
import type { WorkflowInfo, WorkflowNode } from '../types/index.d'

interface NodeOutputDefinition {
  name: string
  title?: string
  type?: number
}

interface Props {
  workflow: WorkflowInfo
  wfNode: WorkflowNode
  excludeNodes: string[]
  whiteListComponents?: string[]
  whiteListUserInputTypes?: number[]
}

const props = withDefaults(defineProps<Props>(), {
  workflow: () => emptyWorkflowInfo(),
  whiteListComponents: () => [],
  whiteListUserInputTypes: () => [],
})

const selectedVars = ref<string[]>([])
const keysRef = ref<string[]>([])

function renderDropdownLabel(option: any): VNodeChild {
  // 分组标题，例如“用户的输入”“节点的输出”
  if (option.options) return option.label as string

  const val = String(option.value || '')
  const nodeUuid = val.split('::')[0]

  const componentName =
    (props.workflow.nodes || []).find((item) => item.uuid === nodeUuid)
      ?.wfComponent?.name || ''

  return h('div', { class: 'flex items-center' }, [
    h(SvgIcon, {
      icon: getIconByComponentName(componentName),
      class: getIconClassByComponentName(componentName),
    }),
    h('div', { class: 'ml-1.5' }, option.label as string),
  ])
}

/**
 * 获取一个节点可被下游引用的输出定义。
 *
 * Start 节点：输出就是其 user_inputs。
 * 普通节点：优先读取 nodeConfig.outputs。
 * 老节点兼容：若尚未定义 outputs，保留 output。
 */
function getNodeOutputOptions(node: WorkflowNode) {
  if (node.wfComponent?.name === 'Start') {
    const userInputs = node.inputConfig?.user_inputs || []

    return userInputs.map((item: any) => ({
      label: item.title || item.name,
      value: `${node.uuid}::${item.name}`,
    }))
  }

  const outputs = ((node.nodeConfig as any)?.outputs || []) as NodeOutputDefinition[]

  if (Array.isArray(outputs) && outputs.length > 0) {
    return outputs
      .filter((item) => item?.name)
      .map((item) => ({
        label: item.title || item.name,
        value: `${node.uuid}::${item.name}`,
      }))
  }

  // 兼容没有输出声明的历史节点
  return [
    {
      label: '输出结果',
      value: `${node.uuid}::output`,
    },
  ]
}

const options = computed(() => {
  const userInputOptions: any[] = []
  const componentOutputOptions: any[] = []
  const nodes = props.workflow.nodes || []

  for (const node of nodes) {
    if (!node?.uuid || !node.wfComponent) continue

    // 排除当前节点、结束节点
    if (
      (props.excludeNodes || []).includes(node.uuid) ||
      node.wfComponent.name === 'End'
    ) {
      continue
    }

    // 有组件白名单时，只显示许可组件
    if (
      (props.whiteListComponents || []).length > 0 &&
      !(props.whiteListComponents || []).includes(node.wfComponent.name)
    ) {
      continue
    }

    if (node.wfComponent.name === 'Start') {
      const userInputs = node.inputConfig?.user_inputs || []

      for (const userInput of userInputs as any[]) {
        if (
          (props.whiteListUserInputTypes || []).length > 0 &&
          !(props.whiteListUserInputTypes || []).includes(userInput.type)
        ) {
          continue
        }

        userInputOptions.push({
          label: userInput.title || userInput.name,
          value: `${node.uuid}::${userInput.name}`,
        })
      }
    } else {
      componentOutputOptions.push(...getNodeOutputOptions(node))
    }
  }

  return [
    { label: '用户的输入', options: userInputOptions },
    { label: '节点的输出', options: componentOutputOptions },
  ]
})

function syncRefInputs() {
  const refInputs = selectedVars.value.map((value, index) => {
    const ref = toRefDef(value)

    return {
      name: keysRef.value[index] || defaultKeyAt(index),
      node_uuid: ref.node_uuid,
      node_param_name: ref.node_param_name,
    }
  })

  if (!(props.wfNode as any).inputConfig) {
    ;(props.wfNode as any).inputConfig = {
      user_inputs: [],
      ref_inputs: [],
    }
  }

  ;(props.wfNode.inputConfig as any).ref_inputs = refInputs
}

function rebuildSelectedVars() {
  const refInputs = ((props.wfNode as any)?.inputConfig?.ref_inputs ||
    []) as any[]

  selectedVars.value = refInputs.map(
    (item) => `${item.node_uuid || ''}::${item.node_param_name || ''}`,
  )

  keysRef.value = refInputs.map((item) => item.name || '')
  syncKeysLength()
}

rebuildSelectedVars()

function two(value: number) {
  return String(value).padStart(2, '0')
}

function defaultKeyAt(index: number) {
  return `var_${two(index + 1)}`
}

function nextAutoKey(list: string[]) {
  const nums = list.map((key) => {
    const result = String(key || '').match(/^var_(\d+)$/)
    return result ? Number(result[1]) : 0
  })

  return `var_${two(Math.max(0, ...nums) + 1)}`
}

function syncKeysLength() {
  const targetLength = selectedVars.value.length

  while (keysRef.value.length < targetLength) {
    keysRef.value.push(nextAutoKey(keysRef.value))
  }

  while (keysRef.value.length > targetLength) {
    keysRef.value.pop()
  }
}

function toRefDef(value: string) {
  const [nodeUuid = '', nodeParamName = ''] = String(value || '').split('::')

  return {
    node_uuid: nodeUuid,
    node_param_name: nodeParamName,
  }
}

function handleSelectAt(index: number, value: string) {
  const next = selectedVars.value.slice()
  next[index] = value
  selectedVars.value = next
  syncRefInputs()
}

function handleKeyChange() {
  syncRefInputs()
}

function addVariable() {
  selectedVars.value = [...selectedVars.value, '']
  keysRef.value = [...keysRef.value, nextAutoKey(keysRef.value)]
  syncRefInputs()
}

function removeVariable(index: number) {
  selectedVars.value = selectedVars.value.filter((_, i) => i !== index)
  keysRef.value = keysRef.value.filter((_, i) => i !== index)
  syncRefInputs()
}
</script>

<template>
  <Collapse :default-active-key="['vars']">
    <Collapse.Panel key="vars" header="输入">
      <div class="flex flex-col gap-2">
        <div
          v-for="(sv, idx) in selectedVars"
          :key="idx"
          class="flex items-center gap-2"
        >
          <div class="min-w-36 text-gray-600 flex items-center justify-between pr-2">
            <Input
              v-model:value="keysRef[idx]"
              placeholder="var_xxx"
              size="small"
              @change="handleKeyChange"
            />
          </div>

          <Select
            :value="sv"
            :show-arrow="true"
            :options="options"
            class="flex-1"
            placeholder="选择前序节点输出"
            @update:value="(val: string) => handleSelectAt(idx, val)"
          >
            <template #optionRender="{ option }">
              <component :is="() => renderDropdownLabel(option)" />
            </template>
          </Select>

          <Button size="small" title="删除" @click="removeVariable(idx)">
            <SvgIcon icon="carbon:delete" />
          </Button>
        </div>

        <div>
          <Button size="small" type="dashed" @click="addVariable">
            + 新增变量
          </Button>
        </div>
      </div>
    </Collapse.Panel>
  </Collapse>
</template>