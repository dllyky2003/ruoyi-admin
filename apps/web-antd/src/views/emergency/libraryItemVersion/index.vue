<script setup lang="ts">
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeGridProps } from '#/adapter/vxe-table';
import type { LibraryItemVersionForm } from '#/api/emergency/libraryItemVersion/model';

import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { getVxePopupContainer } from '@vben/utils';

import { message, Popconfirm, Space, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  libraryItemVersionExport,
  libraryItemVersionList,
  // libraryItemVersionRemove, // 取消注释以使用真实删除
} from '#/api/emergency/libraryItemVersion';
import { commonDownloadExcel } from '#/utils/file/download';

import ConfigureModal from './configure/index.vue';
import { querySchema } from './data';
import CaseFlowWrapperModal from './SimulateTest/case-flow-wrapper.vue';
import LogicFlowModal from './workflow-designer/LogicFlowModal.vue';

const router = useRouter();

// ==================== 表格配置 ====================
const formOptions: VbenFormProps = {
  commonConfig: {
    labelWidth: 80,
    componentProps: {
      allowClear: true,
    },
  },
  schema: querySchema(),
  wrapperClass: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
};

const customColumns: VxeGridProps['columns'] = [
  {
    field: 'name',
    title: '方案名称',
    minWidth: 180,
    slots: { default: 'caseTitle' },
  },
  {
    field: 'workflow',
    title: '流程类型',
    minWidth: 150,
    slots: { default: 'workflowType' },
  },
  {
    field: 'mode',
    title: '模式',
    minWidth: 150,
    slots: { default: 'mode' },
  },
  {
    field: 'tags',
    title: '标签',
    minWidth: 150,
    slots: { default: 'tags' },
  },
  {
    field: 'definitionJson.caseMeta.difficulty',
    title: '难度',
    width: 80,
    slots: { default: 'difficulty' },
  },
  {
    field: 'definitionJson.rules.length',
    title: '规则数',
    width: 80,
    slots: { default: 'ruleCount' },
  },
  {
    field: 'definitionJson.phases.length',
    title: '阶段数',
    width: 80,
    slots: { default: 'phaseCount' },
  },
  {
    field: 'definitionJson.caseMeta.estimatedDurationMin',
    title: '时长(分钟)',
    width: 90,
    slots: { default: 'duration' },
  },
  {
    field: 'action',
    title: '操作',
    width: 280,
    fixed: 'right',
    slots: { default: 'action' },
  },
];

const gridOptions: VxeGridProps = {
  checkboxConfig: {
    highlight: true,
    reserve: true,
  },
  columns: customColumns,
  height: 'auto',
  keepSource: true,
  pagerConfig: {},
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues = {}) => {
        const res = await libraryItemVersionList({
          pageNum: page.currentPage,
          pageSize: page.pageSize,
          ...formValues,
        });
        return res;
      },
    },
  },
  rowConfig: {
    keyField: 'id',
  },
  id: 'system-libraryItemVersion-index',
};

const [BasicTable, tableApi] = useVbenVxeGrid({
  formOptions,
  gridOptions,
});

// ==================== 模态框（配置方案） ====================
const [ConfigureModalComponent, configureModalApi] = useVbenModal({
  connectedComponent: ConfigureModal,
});

// ==================== 模态框（LogicFlow 状态机设计器） ====================
const [LogicFlowModalComponent, logicFlowModalApi] = useVbenModal({
  connectedComponent: LogicFlowModal,
});

// ==================== 模态框（caseFlow.vue 测试） ====================
const [CaseFlowWrapperModalComponent, caseFlowWrapperModalApi] = useVbenModal({
  connectedComponent: CaseFlowWrapperModal,
});

// ==================== 操作方法 ====================

/** 打开配置方案模态框 */
function handleConfigure(row: Required<LibraryItemVersionForm>) {
  configureModalApi.setData({ id: row.id });
  configureModalApi.open();
}

/**
 * 打开对应案例的 LogicFlow 状态机
 */
function handleCaseFlow(row: Required<LibraryItemVersionForm>) {
  const caseId = row.caseType;

  if (!caseId) {
    message.error('当前方案没有配置案例类型 caseType');
    return;
  }

  console.log('[handleCaseFlow] 打开 LogicFlow，caseId =', caseId);

  logicFlowModalApi.setData({
    caseId: String(caseId),
  });

  logicFlowModalApi.open();
}
/** 打开 caseFlow.vue 测试弹窗 */
function handleTest(row: Required<LibraryItemVersionForm>) {
  caseFlowWrapperModalApi.setData({ id: String(row.caseType) });
  caseFlowWrapperModalApi.open();
}

/** 导出 Excel */
function handleDownloadExcel() {
  commonDownloadExcel(
    libraryItemVersionExport,
    '急救方案版本数据',
    tableApi.formApi.form.values,
    {},
  );
}

/** 编辑（跳转编辑页） */
function handleEdit(row: Required<LibraryItemVersionForm>) {
  router.push({
    path: '/emergency/libraryItemVersion/edit',
    query: { id: String(row.id) },
  });
}

/** 删除 */
async function handleDelete(row: Required<LibraryItemVersionForm>) {
  try {
    // await libraryItemVersionRemove(row.id);
    // tableApi.query();
    message.warning('删除接口未接入，请替换为真实 API');
  } catch {
    message.error('删除失败');
  }
}

// ==================== 状态标签辅助 ====================
const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    draft: '草稿',
    reviewing: '审核中',
    published: '已发布',
    archived: '已归档',
  };
  return map[status] || status;
};

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    draft: 'processing',
    reviewing: 'warning',
    published: 'success',
    archived: 'default',
  };
  return map[status] || 'default';
};
</script>

<template>
  <Page :auto-content-height="true">
    <BasicTable table-title="急救方案版本列表">
      <template #toolbar-tools>
        <Space>
          <a-button v-access:code="['system:libraryItemVersion:export']" @click="handleDownloadExcel">
            {{ $t('pages.common.export') }}
          </a-button>
        </Space>
      </template>

      <!-- 各列插槽 -->
      <template #caseTitle="{ row }">
        <span class="font-medium">{{ row.name || '-' }}</span>
      </template>
      <template #workflowType="{ row }">
        <span>{{ row.workflowType || '-' }}</span>
      </template>
      <template #mode="{ row }">
        <span>{{ row.mode || '-' }}</span>
      </template>
      <template #tags="{ row }">
        <span>{{ row.tags || '-' }}</span>
      </template>
      <template #difficulty="{ row }">
        <Tag :color="row.definitionJson?.caseMeta?.difficulty === '高级'
          ? 'red'
          : row.definitionJson?.caseMeta?.difficulty === '中级'
            ? 'orange'
            : 'blue'
          ">
          {{ row.definitionJson?.caseMeta?.difficulty || '未设置' }}
        </Tag>
      </template>
      <template #ruleCount="{ row }">
        <span class="font-semibold text-blue-600">
          {{ row.definitionJson?.rules?.length || 0 }}
        </span>
      </template>
      <template #phaseCount="{ row }">
        <span class="font-semibold text-emerald-600">
          {{ row.definitionJson?.phases?.length || 0 }}
        </span>
      </template>
      <template #duration="{ row }">
        {{ row.definitionJson?.caseMeta?.estimatedDurationMin || '-' }}
      </template>

      <!-- 操作列 -->
      <template #action="{ row }">
        <Space>
          <a-button type="primary" size="small" @click.stop="handleConfigure(row)">
            配置方案
          </a-button>
          <a-button size="small" @click.stop="handleCaseFlow(row)">
            案例流程
          </a-button>
          <a-button size="small" @click.stop="handleTest(row)">测试</a-button>
          <a-button v-access:code="['system:libraryItemVersion:edit']" @click.stop="handleEdit(row)">
            {{ $t('pages.common.edit') }}
          </a-button>
          <Popconfirm :get-popup-container="getVxePopupContainer" placement="left" title="确认删除？"
            @confirm="handleDelete(row)">
            <a-button danger v-access:code="['system:role:remove']">
              {{ $t('pages.common.delete') }}
            </a-button>
          </Popconfirm>
        </Space>
      </template>
    </BasicTable>

    <!-- 弹窗组件放在 Page 内部 -->
    <ConfigureModalComponent @reload="tableApi.query()" />
    <LogicFlowModalComponent />
    <CaseFlowWrapperModalComponent />
  </Page>
</template>
