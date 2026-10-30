export const DictEnum = {
  SYS_COMMON_STATUS: 'sys_common_status',
  SYS_DEVICE_TYPE: 'sys_device_type', // 设备类型
  SYS_GRANT_TYPE: 'sys_grant_type', // 授权类型
  SYS_NORMAL_DISABLE: 'sys_normal_disable',
  SYS_NOTICE_STATUS: 'sys_notice_status', // 通知状态
  SYS_NOTICE_TYPE: 'sys_notice_type', // 通知类型
  SYS_OPER_TYPE: 'sys_oper_type', // 操作类型
  SYS_OSS_ACCESS_POLICY: 'oss_access_policy', // oss权限桶类型
  SYS_SHOW_HIDE: 'sys_show_hide', // 显示状态
  SYS_USER_SEX: 'sys_user_sex', // 性别
  SYS_YES_NO: 'sys_yes_no', // 是否
  WF_BUSINESS_STATUS: 'wf_business_status', // 业务状态
  WF_FORM_TYPE: 'wf_form_type', // 表单类型
  WF_TASK_STATUS: 'wf_task_status', // 任务状态
  SYS_MODEL_BILLING: 'sys_model_billing', // 计费方式
  CHAT_MODEL_CATEGORY: 'chat_model_category', // 模型分类
  EMERGENCY_CONSCIOUSNESS: 'emergency_consciousness' ,// 病人意识状态
  EMS_AIRWAY_PATENCY: 'ems_airway_patency', //气道开放状态
  EMS_RESP_PATTERN: 'ems_resp_pattern', //呼吸模式（频率/节律）
  EMS_CIRC_HEMODYNAMICS: 'ems_circ_hemodynamics',//循环状态
  EMS_EXAM_SKIN: 'ems_exam_skin', //体表与关键表现
  EMS_TEACHING_MODE: 'ems_teaching_mode',//教学模式
  EMS_TEACHING_PLAN_TYPE: 'emc_teaching_plan_type'//教学计划类型

  
} as const;

export type DictEnumKey = keyof typeof DictEnum;
