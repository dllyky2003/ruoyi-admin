import { computed, ref } from 'vue';

export function useIntent() {
  const intentDefinitions = ref<any[]>([]);
  const loadingIntents = ref(false);
  const selectedSubDomain = ref<null | string>(null);

  // 从 stateInfo 响应加载意图
  const loadFromStateInfo = (res: any) => {
    const definitions = res.definitions || {};
    console.log(definitions);
    if (definitions.intentDefinitions) {
      intentDefinitions.value = definitions.intentDefinitions;
      // 自动选中第一个子域
      if (intentDefinitions.value.length > 0 && !selectedSubDomain.value) {
        selectedSubDomain.value = intentDefinitions.value[0].subDomainName;
      }
    }
  };

  // 外部设置
  const setIntentDefinitions = (defs: any[]) => {
    intentDefinitions.value = defs;
    if (defs.length > 0 && !selectedSubDomain.value) {
      selectedSubDomain.value = defs[0].subDomainName;
    }
  };

  const selectSubDomain = (name: string) => {
    selectedSubDomain.value = name;
  };

  const currentIntents = computed(() => {
    if (!selectedSubDomain.value) return [];
    const def = intentDefinitions.value.find(
      (d) => d.subDomainName === selectedSubDomain.value,
    );
    return def ? def.intents : [];
  });

  const reset = () => {
    intentDefinitions.value = [];
    selectedSubDomain.value = null;
  };

  return {
    intentDefinitions,
    loadingIntents,
    selectedSubDomain,
    currentIntents,
    loadFromStateInfo,
    setIntentDefinitions,
    selectSubDomain,
    reset,
  };
}
