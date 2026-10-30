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
    fieldName: 'organizationId',
    label: '',
  },
  {
    component: 'Select',
    componentProps: {
    },
    fieldName: 'assetType',
    label: 'image/audio/video/ecg/pdf/waveform',
  },
  {
    component: 'Textarea',
    fieldName: 'storageKey',
    label: '',
  },
  {
    component: 'Input',
    fieldName: 'originalFilename',
    label: '',
  },
  {
    component: 'Select',
    componentProps: {
    },
    fieldName: 'mimeType',
    label: '',
  },
  {
    component: 'Input',
    fieldName: 'byteSize',
    label: '',
  },
  {
    component: 'Input',
    fieldName: 'sha256',
    label: '',
  },
  {
    component: 'Input',
    fieldName: 'metadataJson',
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
    field: 'organizationId',
  },
  {
    title: 'image/audio/video/ecg/pdf/waveform',
    field: 'assetType',
  },
  {
    title: '',
    field: 'storageKey',
  },
  {
    title: '',
    field: 'originalFilename',
  },
  {
    title: '',
    field: 'mimeType',
  },
  {
    title: '',
    field: 'byteSize',
  },
  {
    title: '',
    field: 'sha256',
  },
  {
    title: '',
    field: 'metadataJson',
  },
  {
    field: 'action',
    fixed: 'right',
    slots: { default: 'action' },
    title: '操作',
    width: 180,
  },
];

