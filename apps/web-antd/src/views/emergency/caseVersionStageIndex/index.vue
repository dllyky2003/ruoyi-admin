<script setup lang="ts">
import type { Recordable } from '@vben/types';

import { ref } from 'vue';

import { Page, useVbenModal, type VbenFormProps } from '@vben/common-ui';
import { getVxePopupContainer } from '@vben/utils';

import { Modal, Popconfirm, Space } from 'ant-design-vue';

import {
  useVbenVxeGrid,
  vxeCheckboxChecked,
  type VxeGridProps
} from '#/adapter/vxe-table';

import {
  caseVersionStageIndexExport,
  caseVersionStageIndexList,
  caseVersionStageIndexRemove,
} from '#/api/emergency/caseVersionStageIndex';
import type { CaseVersionStageIndexForm } from '#/api/emergency/caseVersionStageIndex/model';
import { commonDownloadExcel } from '#/utils/file/download';

import caseVersionStageIndexModal from './caseVersionStageIndex-modal.vue';
import { columns, querySchema } from './data';

const formOptions: VbenFormProps = {
  commonConfig: {
    labelWidth: 80,
    componentProps: {
      allowClear: true,
    },
  },
  schema: querySchema(),
  wrapperClass: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  // 处理区间选择器 RangePicker 时间格式映射
  // 将一个时间区间字段映射为两个独立的开始/结束时间字段，用于搜索和导出
  // 示例: 将 createTime 字段映射为 params[beginTime] 和 params[endTime]
  // fieldMappingTime: [
  //   [
  //     'createTime', // 表单中的字段名
  //     ['params[beginTime]', 'params[endTime]'], // 映射后的字段名
  //     ['YYYY-MM-DD 00:00:00', 'YYYY-MM-DD 23:59:59'], // 时间格式
  //   ],
  // ],
};

const gridOptions: VxeGridProps = {
  checkboxConfig: {
    // 高亮
    highlight: true,
    // 翻页时保留选中状态
    reserve: true,
    // 点击行选中
    // trigger: 'row',
  },
  // 需要使用i18n注意这里要改成getter形式 否则切换语言不会刷新
  // columns: columns(),
  columns,
  height: 'auto',
  keepSource: true,
  pagerConfig: {},
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues = {}) => {
        return await caseVersionStageIndexList({
          pageNum: page.currentPage,
          pageSize: page.pageSize,
          ...formValues,
        });
      },
    },
  },
  rowConfig: {
    keyField: 'caseVersionId',
  },
  // 表格全局唯一标识，用于保存列配置
  id: 'system-caseVersionStageIndex-index'
};

const [BasicTable, tableApi] = useVbenVxeGrid({
  formOptions,
  gridOptions,
});

const [CaseVersionStageIndexModal, modalApi] = useVbenModal({
  connectedComponent: caseVersionStageIndexModal,
});

function handleAdd() {
  modalApi.setData({});
  modalApi.open();
}

async function handleEdit(row: Required<CaseVersionStageIndexForm>) {
  modalApi.setData({ id: row.caseVersionId });
  modalApi.open();
}

async function handleDelete(row: Required<CaseVersionStageIndexForm>) {
  await caseVersionStageIndexRemove(row.caseVersionId);
  await tableApi.query();
}

function handleMultiDelete() {
  const rows = tableApi.grid.getCheckboxRecords();
  const ids = rows.map((row: Required<CaseVersionStageIndexForm>) => row.caseVersionId);
  Modal.confirm({
    title: '提示',
    okType: 'danger',
    content: `确认删除选中的${ids.length}条记录吗？`,
    onOk: async () => {
      await caseVersionStageIndexRemove(ids);
      await tableApi.query();
    },
  });
}

function handleDownloadExcel() {
  commonDownloadExcel(caseVersionStageIndexExport, '病例版本的阶段索引数据', tableApi.formApi.form.values, {
    fieldMappingTime: formOptions.fieldMappingTime,
  });
}
</script>

<template>
  <Page :auto-content-height="true">
    <BasicTable table-title="病例版本的阶段索引列表">
      <template #toolbar-tools>
        <Space>
          <a-button
            v-access:code="['system:caseVersionStageIndex:export']"
            @click="handleDownloadExcel"
          >
            {{ $t('pages.common.export') }}
          </a-button>
          <a-button
            :disabled="!vxeCheckboxChecked(tableApi)"
            danger
            type="primary"
            v-access:code="['system:caseVersionStageIndex:remove']"
            @click="handleMultiDelete">
            {{ $t('pages.common.delete') }}
          </a-button>
          <a-button
            type="primary"
            v-access:code="['system:caseVersionStageIndex:add']"
            @click="handleAdd"
          >
            {{ $t('pages.common.add') }}
          </a-button>
        </Space>
      </template>
      <template #action="{ row }">
        <Space>
          <ghost-button
            v-access:code="['system:caseVersionStageIndex:edit']"
            @click.stop="handleEdit(row)"
          >
            {{ $t('pages.common.edit') }}
          </ghost-button>
          <Popconfirm
            :get-popup-container="getVxePopupContainer"
            placement="left"
            title="确认删除？"
            @confirm="handleDelete(row)"
          >
            <ghost-button
              danger
              v-access:code="['system:caseVersionStageIndex:remove']"
              @click.stop=""
            >
              {{ $t('pages.common.delete') }}
            </ghost-button>
          </Popconfirm>
        </Space>
      </template>
    </BasicTable>
    <CaseVersionStageIndexModal @reload="tableApi.query()" />
  </Page>
</template>
