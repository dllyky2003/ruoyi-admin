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
    fieldName: 'caseId',
    label: '',
  },
  {
    component: 'Input',
    fieldName: 'versionNo',
    label: '',
  },
  {
    component: 'Input',
    fieldName: 'schemaVersion',
    label: '',
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      optionType: 'button',
    },
    fieldName: 'status',
    label: 'draft/reviewing/published/archived',
  },
  {
    component: 'Input',
    fieldName: 'definitionJson',
    label: '病例方案唯一事实源',
  },
  {
    component: 'Input',
    fieldName: 'definitionHash',
    label: '',
  },
  {
    component: 'Input',
    fieldName: 'basedOnVersionId',
    label: '',
  },
  {
    component: 'Textarea',
    fieldName: 'changeSummary',
    label: '',
  },
  {
    component: 'Input',
    fieldName: 'reviewedBy',
    label: '',
  },
  {
    component: 'DatePicker',
    componentProps: {
      showTime: true,
      format: 'YYYY-MM-DD HH:mm:ss',
      valueFormat: 'YYYY-MM-DD HH:mm:ss',
    },
    fieldName: 'reviewedAt',
    label: '',
  },
  {
    component: 'Input',
    fieldName: 'publishedBy',
    label: '',
  },
  {
    component: 'DatePicker',
    componentProps: {
      showTime: true,
      format: 'YYYY-MM-DD HH:mm:ss',
      valueFormat: 'YYYY-MM-DD HH:mm:ss',
    },
    fieldName: 'publishedAt',
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
    field: 'caseId',
  },
  {
    title: '',
    field: 'versionNo',
  },
  {
    title: '',
    field: 'schemaVersion',
  },
  {
    title: 'draft/reviewing/published/archived',
    field: 'status',
  },
  {
    title: '病例方案唯一事实源',
    field: 'definitionJson',
  },
  {
    title: '',
    field: 'definitionHash',
  },
  {
    title: '',
    field: 'basedOnVersionId',
  },
  {
    title: '',
    field: 'changeSummary',
  },
  {
    title: '',
    field: 'reviewedBy',
  },
  {
    title: '',
    field: 'reviewedAt',
  },
  {
    title: '',
    field: 'publishedBy',
  },
  {
    title: '',
    field: 'publishedAt',
  },
  {
    field: 'action',
    fixed: 'right',
    slots: { default: 'action' },
    title: '操作',
    width: 180,
  },
];

