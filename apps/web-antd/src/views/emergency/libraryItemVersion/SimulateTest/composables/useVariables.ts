import { ref } from 'vue';

export function useVariables() {
  const variablesData = ref<Record<string, any>>({});
  const variablesLoading = ref(false);
  const variableMetaMap = ref<Record<string, string>>({});

  // 从 stateInfo 响应加载变量
  const loadFromStateInfo = (res: any) => {
    if (res.mode === 'runtime') {
      const snapshot = res.snapshot || {};
      const definitions = res.definitions || {};
      variablesData.value = snapshot.variables || {};
      if (definitions.variableMeta) {
        setVariableMeta(definitions.variableMeta);
      }
    } else {
      // design mode
      const definitions = res.definitions || {};
      variablesData.value = res.defaultVariables || {};
      if (definitions.variableMeta) {
        setVariableMeta(definitions.variableMeta);
      }
    }
  };

  // 设置变量元数据（中文名）
  const setVariableMeta = (meta: Record<string, any>) => {
    const map: Record<string, string> = {};
    if (meta) {
      Object.entries(meta).forEach(([key, val]: [string, any]) => {
        map[key] = val.name_cn || key;
      });
    }
    variableMetaMap.value = map;
  };

  // 增量更新（WebSocket）
  const mergeVariables = (updates: Record<string, any>) => {
    variablesData.value = { ...variablesData.value, ...updates };
  };

  // 重置
  const reset = () => {
    variablesData.value = {};
    variableMetaMap.value = {};
  };

  return {
    variablesData,
    variablesLoading,
    variableMetaMap,
    loadFromStateInfo,
    setVariableMeta,
    mergeVariables,
    reset,
  };
}
