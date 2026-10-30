import type { FormSchemaGetter } from '#/adapter/form';
import type { VxeGridProps } from '#/adapter/vxe-table';


export const querySchema: FormSchemaGetter = () => [
  {
    component: 'Input',
    fieldName: 'deptId',
    label: '部门id',
  },
  {
    component: 'Input',
    fieldName: 'userId',
    label: '用户id',
  },
  {
    component: 'Input',
    fieldName: 'orderNum',
    label: '排序号',
  },
  {
    component: 'Input',
    fieldName: 'sessionId',
    label: '',
  },
  {
    component: 'Input',
    fieldName: 'sequenceNo',
    label: '',
  },
  {
    component: 'DatePicker',
    componentProps: {
      showTime: true,
      format: 'YYYY-MM-DD HH:mm:ss',
      valueFormat: 'YYYY-MM-DD HH:mm:ss',
    },
    fieldName: 'occurredAt',
    label: '',
  },
  {
    component: 'Select',
    componentProps: {
    },
    fieldName: 'eventType',
    label: '',
  },
  {
    component: 'Select',
    componentProps: {
    },
    fieldName: 'sourceType',
    label: 'device/user/asr/instructor/rule_engine/system',
  },
  {
    component: 'Input',
    fieldName: 'sourceId',
    label: '',
  },
  {
    component: 'Input',
    fieldName: 'payloadJson',
    label: '',
  },
  {
    component: 'Input',
    fieldName: 'decisionJson',
    label: '',
  },
  {
    component: 'DatePicker',
    componentProps: {
      showTime: true,
      format: 'YYYY-MM-DD HH:mm:ss',
      valueFormat: 'YYYY-MM-DD HH:mm:ss',
    },
    fieldName: 'createdAt',
    label: '',
  },
];

/**
 * 表格列配置
 * 如果需要使用 i18n 国际化，请使用 getter 函数形式，否则切换语言时列配置不会刷新
 * 使用方式: export const columns: () => VxeGridProps['columns'] = () => [...]
 */
export const columns: VxeGridProps['columns'] = [
  { type: 'checkbox', width: 60 },
  {
    title: '',
    field: 'id',
  },
  {
    title: '部门id',
    field: 'deptId',
  },
  {
    title: '用户id',
    field: 'userId',
  },
  {
    title: '排序号',
    field: 'orderNum',
  },
  {
    title: '',
    field: 'sessionId',
  },
  {
    title: '',
    field: 'sequenceNo',
  },
  {
    title: '',
    field: 'occurredAt',
  },
  {
    title: '',
    field: 'eventType',
  },
  {
    title: 'device/user/asr/instructor/rule_engine/system',
    field: 'sourceType',
  },
  {
    title: '',
    field: 'sourceId',
  },
  {
    title: '',
    field: 'payloadJson',
  },
  {
    title: '',
    field: 'decisionJson',
  },
  {
    title: '',
    field: 'createdAt',
  },
  {
    field: 'action',
    fixed: 'right',
    slots: { default: 'action' },
    title: '操作',
    width: 180,
  },
];

