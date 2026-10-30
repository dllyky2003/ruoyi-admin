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
    fieldName: 'caseCode',
    label: '',
  },
  {
    component: 'Input',
    fieldName: 'organizationId',
    label: '机构/单位隔离维度',
  },
  {
    component: 'Input',
    fieldName: 'name',
    label: '',
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      optionType: 'button',
    },
    fieldName: 'status',
    label: '',
  },
  {
    component: 'Input',
    fieldName: 'currentPublishedVersionId',
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
    field: 'caseCode',
  },
  {
    title: '机构/单位隔离维度',
    field: 'organizationId',
  },
  {
    title: '',
    field: 'name',
  },
  {
    title: '',
    field: 'status',
  },
  {
    title: '',
    field: 'currentPublishedVersionId',
  },
  {
    field: 'action',
    fixed: 'right',
    slots: { default: 'action' },
    title: '操作',
    width: 180,
  },
];

