import type { ContractData } from '#/api/ems/types';

// src/views/emergency/libraryItemVersion/SimulateTest/composables/useContract.ts
import { ref } from 'vue';

import { requestClient } from '#/api/request';

export type GraphMode = 'default' | 'diagnostics' | 'intents' | 'variables';

/** 边标签转义：| 和换行 */
function escapeEdgeLabel(s: string): string {
  return s.replaceAll('|', '/').replaceAll('\n', ' ');
}

/** 提取 SpEL condition 中的变量名（去前缀），最多 2 个 */
function extractKeyVars(condition: null | string | undefined): string {
  if (!condition) return '';
  const matches = condition.matchAll(/#([a-z_][\w.]*)/gi);
  const business: string[] = []; // 业务变量
  const derived: string[] = []; // derived 变量

  for (const m of matches) {
    const full = m[1];
    if (!full) continue;
    const short = full.split('.').pop() || full;
    if (full.startsWith('derived.')) {
      if (!derived.includes(short)) derived.push(short);
    } else {
      if (!business.includes(short)) business.push(short);
    }
  }

  // 优先业务变量，最多 2 个；不足再补 derived
  const result = business.slice(0, 2);
  while (result.length < 2 && derived.length > 0) {
    result.push(derived.shift()!);
  }
  return result.join(' & ');
}

/** 生成边标签（优先级：意图 > 事件 > 条件变量 > exitReason） */
function buildEdgeLabel(t: ContractTransition): string {
  // 1) 意图：去掉 IA_xxx_ 前缀
  if (t.intentCode) {
    return t.intentCode.replace(/^IA_\d+_/, '');
  }

  // 2) 系统事件
  if (t.event) {
    return `⚡${t.event}`;
  }

  // 3) 从 condition 提取关键变量
  const vars = extractKeyVars(t.guardExpression);
  if (vars) {
    return vars;
  }

  // 4) 有 exitReason 就标出来
  if (t.exitReason) {
    return `→${t.exitReason}`;
  }

  // 5) 什么都没有（真死转移）
  return '';
}

/** 兼容后端字段名（stateContracts vs states） */
function normalizeContract(raw: any): ContractData {
  if (!raw) return raw as any;
  return {
    ...raw,
    caseId: raw.caseId,
    states: raw.states || raw.stateContracts || {},
    transitions: raw.transitions || raw.transitionContracts || {},
    intents: raw.intents || raw.intentContracts || {},
    variables: raw.variables || raw.variableContracts || {},
    derivedVars: raw.derivedVars || raw.derivedVarContracts || {},
    diagnostics: raw.diagnostics || {
      undefinedDerivedVars: [],
      deadTransitions: [],
      selfLoops: [],
      unwritableVariables: [],
      orphanVariables: [],
      emptyIntents: [],
      circularDependencies: [],
    },
  } as ContractData;
}

/** 与后端 toSafeId 一致 */
function toSafeId(s: string): string {
  return s.replaceAll(/\W/g, '_');
}

/** 转义 Mermaid 标签里的双引号 */
function escapeLabel(s: string): string {
  return s.replaceAll('"', "'").replaceAll('\n', ' ');
}

/** 从契约数据生成 Mermaid */
function buildMermaid(contract: ContractData): string {
  if (!contract || !contract.states) return '';

  const lines: string[] = ['flowchart TD'];
  const stateIds = Object.keys(contract.states);

  // ============ 1. 声明节点 ============
  for (const sid of stateIds) {
    const st = contract.states[sid];
    const safeId = toSafeId(sid);
    const label = st.stateDescription || sid;
    lines.push(`  ${safeId}["${escapeLabel(label)}"]`);
  }

  // ============ 2. 声明转移 ============
  for (const tid of Object.keys(contract.transitions || {})) {
    const t = contract.transitions[tid];
    if (!t || !t.sourceState || !t.targetState) continue;
    const from = toSafeId(t.sourceState);
    const to = toSafeId(t.targetState);
    const edgeLabel = buildEdgeLabel(t);
    if (edgeLabel) {
      lines.push(`  ${from} -->|${escapeEdgeLabel(edgeLabel)}| ${to}`);
    } else {
      lines.push(`  ${from} --> ${to}`);
    }
  }

  // ============ 3. ★ 每个节点独立 style ============
  for (const sid of stateIds) {
    const st = contract.states[sid];
    const safeId = toSafeId(sid);
    const trans = st.transitions || [];

    // —— 判断节点类型 ——
    const isGlobal = sid.startsWith('F-000'); // 全局继承
    const isInitial = st.initialState;
    const isEnd = st.endState;
    const isDead = trans.some((t) => t.dead);
    const isWarn = trans.some((t) => t.selfLoop);

    // —— 底色：全局 vs 案例（对比更明显）——
    const fill = isGlobal ? '#e8eef5' : '#d9f0ea'; // 灰蓝 / 青绿
    let stroke = isGlobal ? '#7a8ba3' : '#189a86'; // 边框
    const textColor = isGlobal ? '#2c3e50' : '#005e54'; // 文字

    let strokeWidth = '2px';
    let dashArray = '';

    // —— 特殊状态覆盖 ——
    if (isInitial) {
      stroke = '#1890ff';
      strokeWidth = '3.5px';
    }
    if (isEnd) {
      stroke = '#52c41a';
      strokeWidth = '3.5px';
    }
    if (isDead) {
      stroke = '#ff4d4f';
      strokeWidth = '3px';
      dashArray = '4,3';
    } else if (isWarn) {
      stroke = '#fa8c16';
      strokeWidth = '3px';
      dashArray = '4,3';
    }

    // —— 组装 style ——
    const parts: string[] = [
      `fill:${fill}`,
      `stroke:${stroke}`,
      `stroke-width:${strokeWidth}`,
      `color:${textColor}`,
    ];
    if (dashArray) {
      parts.push(`stroke-dasharray:${dashArray}`);
    }

    lines.push(`  style ${safeId} ${parts.join(',')}`);
  }

  return lines.join('\n');
}

export function useContract() {
  const caseId = ref<string>('stable_narrow');
  const contract = ref<ContractData | null>(null);
  const mermaidCode = ref<string>('');
  const loading = ref(false);
  const error = ref('');

  const selectedStateId = ref<null | string>(null);
  const selectedTransitionId = ref<null | string>(null);
  const mode = ref<GraphMode>('default');

  async function loadContract() {
    loading.value = true;
    error.value = '';
    selectedStateId.value = null;
    selectedTransitionId.value = null;

    try {
      // ★ 只调 detail，不再调 /mermaid
      const detailRes = await requestClient.get('/ems/contract/detail', {
        params: { caseId: caseId.value },
      });

      console.log('[useContract] detailRes =', detailRes);

      contract.value = normalizeContract(detailRes as any);

      // ★ 前端自己生成 Mermaid
      mermaidCode.value = buildMermaid(contract.value);

      // console.log(
      //   '[useContract] mermaidCode 已生成，长度:',
      //   mermaidCode.value.length,
      // );
      // console.log(
      //   '[useContract] mermaidCode 前 200 字符:',
      //   mermaidCode.value.slice(0, 200),
      // );
    } catch (error_: any) {
      console.error('[useContract] 加载契约失败', error_);
      error.value = error_?.message || '加载失败';
    } finally {
      loading.value = false;
    }
  }

  async function reloadAll() {
    try {
      await requestClient.post('/ems/contract/reloadAll');
      await loadContract();
      return true;
    } catch {
      return false;
    }
  }

  return {
    caseId,
    contract,
    mermaidCode,
    loading,
    error,
    selectedStateId,
    selectedTransitionId,
    mode,
    loadContract,
    reloadAll,
  };
}
