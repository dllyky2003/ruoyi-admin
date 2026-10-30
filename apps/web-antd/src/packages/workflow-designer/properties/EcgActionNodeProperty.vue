<script setup lang="ts">
import type { UIWorkflow, WorkflowInfo, WorkflowNode } from '../types/index.d'

import { Alert, Input, InputNumber, Select, Switch } from 'ant-design-vue'

type ContentSize = 'high' | 'medium'
type SearchEngine =
  | 'search_pro'
  | 'search_pro_quark'
  | 'search_pro_sogou'
  | 'search_std'
type SearchRecency = 'noLimit' | 'oneDay' | 'oneMonth' | 'oneWeek' | 'oneYear'

interface NodeOutputDefinition {
  /** 必须与后端 NodeIOData 的 name 完全一致 */
  name: string
  /** 前端显示名称 */
  title: string
  type: number
}

interface SearchNodeConfig {
  content_size: ContentSize
  include_image: boolean
  query: string
  result_count: number
  search_domain_filter: string
  search_engine: SearchEngine
  search_recency_filter: SearchRecency

  /** 节点输出定义，供后续节点变量选择器读取 */
  outputs: NodeOutputDefinition[]
}

interface Props {
  uiWorkflow: UIWorkflow
  wfNode: WorkflowNode
  workflow: WorkflowInfo
}

const props = defineProps<Props>()

if (!props.wfNode.nodeConfig) {
  ;(props.wfNode as any).nodeConfig = {}
}

const config = props.wfNode.nodeConfig as SearchNodeConfig
const InputTextArea = Input.TextArea

/**
 * 这里的 name 必须与后端“我的节点”实际输出保持一致：
 *
 * NodeIOData.createByText("resultName", ...)
 * NodeIOData.createByText("Category", ...)
 * NodeIOData.createByText("Time", ...)
 * NodeIOData.createByText("data", ...)
 */
const defaultOutputs: NodeOutputDefinition[] = [
  {
    name: 'resultName',
    title: '语音识别文本内容',
    type: 1,
  },
  {
    name: 'Category',
    title: '意图类别',
    type: 1,
  },
  {
    name: 'Time',
    title: '处理时间',
    type: 1,
  },
  {
    name: 'data',
    title: '完整结果 JSON',
    type: 1,
  },
]

Object.assign(config, {
  content_size: config.content_size || 'medium',
  include_image: config.include_image ?? false,
  query: config.query || '',
  result_count: config.result_count ?? 10,
  search_domain_filter: config.search_domain_filter || '',
  search_engine: config.search_engine || 'search_std',
  search_recency_filter: config.search_recency_filter || 'noLimit',

  // 老工作流节点首次打开时自动补齐，不覆盖已有输出定义
  outputs:
    Array.isArray(config.outputs) && config.outputs.length > 0
      ? config.outputs
      : defaultOutputs,
})

const searchEngineOptions = [
  { label: '基础搜索', value: 'search_std' },
  { label: '高阶搜索', value: 'search_pro' },
  { label: '高阶搜索 · 搜狗', value: 'search_pro_sogou' },
  { label: '高阶搜索 · 夸克', value: 'search_pro_quark' },
]

const recencyOptions = [
  { label: '不限时间', value: 'noLimit' },
  { label: '一天内', value: 'oneDay' },
  { label: '一周内', value: 'oneWeek' },
  { label: '一个月内', value: 'oneMonth' },
  { label: '一年内', value: 'oneYear' },
]

const contentSizeOptions = [
  { label: '标准摘要', value: 'medium' },
  { label: '完整正文', value: 'high' },
]
</script>

<template>
  <div class="space-y-5">
    <Alert
      description="这是实现用户语音识别结果意图分类的流程节点。"
      message="急救功能结点"
      show-icon
      type="info"
    />

    <div>
      <div class="mb-1.5 text-sm font-medium text-gray-700">搜索内容</div>
      <InputTextArea
        v-model:value="config.query"
        :auto-size="{ minRows: 3, maxRows: 6 }"
        :maxlength="70"
        placeholder="留空时使用上游输入，也可填写固定内容或 {变量名}"
        show-count
      />
    </div>

    <div>
      <div class="mb-1.5 text-sm font-medium text-gray-700">搜索引擎</div>
      <Select
        v-model:value="config.search_engine"
        class="w-full"
        :options="searchEngineOptions"
      />
    </div>

    <div>
      <div class="mb-1.5 text-sm font-medium text-gray-700">返回数量</div>
      <InputNumber
        v-model:value="config.result_count"
        class="w-full"
        :max="50"
        :min="1"
        :precision="0"
      />
      <div class="mt-1 text-xs text-gray-400">每次返回 1–50 条搜索结果</div>
    </div>

    <div>
      <div class="mb-1.5 text-sm font-medium text-gray-700">限定站点</div>
      <Input
        v-model:value="config.search_domain_filter"
        allow-clear
        placeholder="可选，例如 docs.bigmodel.cn"
      />
    </div>

    <div>
      <div class="mb-1.5 text-sm font-medium text-gray-700">时间范围</div>
      <Select
        v-model:value="config.search_recency_filter"
        class="w-full"
        :options="recencyOptions"
      />
    </div>

    <div>
      <div class="mb-1.5 text-sm font-medium text-gray-700">内容深度</div>
      <Select
        v-model:value="config.content_size"
        class="w-full"
        :options="contentSizeOptions"
      />
    </div>

    <div
      class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5"
    >
      <div>
        <div class="text-sm font-medium text-gray-700">返回图片信息</div>
        <div class="mt-0.5 text-xs text-gray-400">在结果中包含相关图片链接</div>
      </div>
      <Switch v-model:checked="config.include_image" />
    </div>

    <div class="rounded-lg border border-blue-100 bg-blue-50 p-3">
      <div class="mb-2 text-sm font-medium text-blue-700">节点输出变量</div>
      <div class="space-y-1 text-xs text-blue-600">
        <div v-for="output in config.outputs" :key="output.name">
          <code>{{ output.name }}</code>
          <span class="ml-2">{{ output.title }}</span>
        </div>
      </div>
    </div>
  </div>
</template>