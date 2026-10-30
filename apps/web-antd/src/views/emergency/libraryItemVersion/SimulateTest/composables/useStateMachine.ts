import { nextTick, ref } from 'vue';

import Panzoom from '@panzoom/panzoom';
import mermaid from 'mermaid';

export function useStateMachine() {
  const mermaidContainer = ref<HTMLDivElement | null>(null);
  const loading = ref(true);
  const error = ref('');
  const currentNode = ref<null | string>(null);
  const executedNodes = ref<Set<string>>(new Set());
  const executedEdges = ref<Set<string>>(new Set());

  let panzoomInstance: null | ReturnType<typeof Panzoom> = null;
  let svgElement: null | SVGSVGElement = null;

  // --- 工具函数 ---
  const toSafeId = (state: string): string => {
    if (!state) return state;
    return state.replaceAll(/\W/g, '_');
  };

  const getNodeElement = (nodeId: string): null | SVGGElement => {
    if (!svgElement) return null;
    const safeId = toSafeId(nodeId);
    let el = svgElement.querySelector(
      `[id^="flowchart-${safeId}-"]`,
    ) as null | SVGGElement;
    if (el) return el;
    el = svgElement.querySelector(
      `[id*="flowchart-${safeId}"]`,
    ) as null | SVGGElement;
    if (el) return el;
    const groups = svgElement.querySelectorAll<SVGGElement>(
      'g[id^="flowchart-"]',
    );
    for (const g of groups) {
      if (g.id.includes(`flowchart-${safeId}`)) {
        return g;
      }
    }
    return null;
  };

  // --- 样式操作 ---
  const setNodeColor = (nodeId: string, color: string) => {
    const node = getNodeElement(nodeId);
    if (!node) return;
    let shape = node.querySelector('rect, path, polygon, ellipse, circle, use');
    if (!shape) {
      const all = node.querySelectorAll('*');
      for (const el of all) {
        if (
          el.hasAttribute('fill') ||
          ['circle', 'ellipse', 'path', 'polygon', 'rect'].includes(
            el.tagName.toLowerCase(),
          )
        ) {
          shape = el;
          break;
        }
      }
    }
    if (shape) {
      (shape as HTMLElement).style.setProperty('fill', color, 'important');
      shape.setAttribute('fill', color);
    }
  };

  const setNodeStroke = (nodeId: string, color: string, width = '1') => {
    const node = getNodeElement(nodeId);
    if (!node) return;
    let shape = node.querySelector('rect, polygon, ellipse, circle, path, use');
    if (!shape) {
      const all = node.querySelectorAll('*');
      for (const el of all) {
        if (
          el.hasAttribute('stroke') ||
          el.tagName === 'rect' ||
          el.tagName === 'path'
        ) {
          shape = el;
          break;
        }
      }
    }
    if (shape) {
      (shape as HTMLElement).style.setProperty('stroke', color, 'important');
      (shape as HTMLElement).style.setProperty(
        'stroke-width',
        width,
        'important',
      );
      shape.setAttribute('stroke', color);
      shape.setAttribute('stroke-width', width);
    }
  };

  const setNodeTextColor = (nodeId: string, color: string) => {
    const node = getNodeElement(nodeId);
    if (!node) return;
    const labelEls = node.querySelectorAll(
      'foreignObject span, foreignObject div',
    );
    if (labelEls.length > 0) {
      labelEls.forEach((el) => {
        (el as HTMLElement).style.setProperty('color', color, 'important');
      });
      return;
    }
    const textEls = node.querySelectorAll('text, tspan');
    textEls.forEach((el) => {
      (el as HTMLElement).style.setProperty('fill', color, 'important');
      el.setAttribute('fill', color);
    });
  };

  const setEdgeColor = (
    from: string,
    to: string,
    color: string,
    width = '2',
  ) => {
    if (!svgElement) return;
    const fromSafe = toSafeId(from);
    const toSafe = toSafeId(to);
    const possibleIds = [
      `L-${fromSafe}-${toSafe}`,
      `L-${fromSafe}---${toSafe}`,
      `flowchart-${fromSafe}-${toSafe}`,
      `L-${fromSafe}_${toSafe}`,
    ];
    let edge: Element | null = null;
    for (const id of possibleIds) {
      edge = svgElement.querySelector(`[id^="${id}"]`);
      if (edge) break;
    }
    if (!edge) {
      const allLinks = svgElement.querySelectorAll(
        '.flowchart-link, [id^="L-"]',
      );
      for (const el of allLinks) {
        if (el.id.includes(fromSafe) && el.id.includes(toSafe)) {
          edge = el;
          break;
        }
      }
    }
    if (edge) {
      const path = edge.querySelector('path') || edge;
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', width);
      (path as HTMLElement).style.setProperty('stroke', color, 'important');
      (path as HTMLElement).style.setProperty(
        'stroke-width',
        width,
        'important',
      );
    }
  };

  const resetAllStyles = () => {
    if (!svgElement) return;
    svgElement.querySelectorAll('[id^="flowchart-"]').forEach((el) => {
      const shape = el.querySelector(
        'rect, path, polygon, ellipse, circle, use',
      );
      if (shape) {
        shape.removeAttribute('fill');
        shape.removeAttribute('stroke');
        shape.removeAttribute('stroke-width');
        (shape as HTMLElement).style.removeProperty('fill');
        (shape as HTMLElement).style.removeProperty('stroke');
        (shape as HTMLElement).style.removeProperty('stroke-width');
      }
      const textEls = el.querySelectorAll('text, tspan');
      textEls.forEach((text) => {
        text.removeAttribute('fill');
        (text as HTMLElement).style.removeProperty('fill');
      });
      const labelEls = el.querySelectorAll(
        'foreignObject span, foreignObject div',
      );
      labelEls.forEach((label) => {
        (label as HTMLElement).style.removeProperty('color');
      });
    });
    svgElement.querySelectorAll('.flowchart-link, [id^="L-"]').forEach((el) => {
      const path = el.querySelector('path') || el;
      path.removeAttribute('stroke');
      path.removeAttribute('stroke-width');
      (path as HTMLElement).style.removeProperty('stroke');
      (path as HTMLElement).style.removeProperty('stroke-width');
    });
  };

  const addCheckMark = (nodeId: string) => {
    const node = getNodeElement(nodeId);
    if (!node || node.querySelector('.check-mark')) return;
    const svgNS = 'http://www.w3.org/2000/svg';
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('class', 'check-mark');
    text.setAttribute('x', '-10');
    text.setAttribute('y', '-5');
    text.setAttribute('fill', '#28a745');
    text.setAttribute('font-size', '14');
    text.setAttribute('font-weight', 'bold');
    text.textContent = '✓';
    node.append(text);
  };

  const removeAllCheckMarks = () => {
    if (!svgElement) return;
    svgElement.querySelectorAll('.check-mark').forEach((el) => el.remove());
  };

  // --- 高亮函数 ---
  const highlightNode = (nodeId: string) => {
    if (!svgElement) return;
    if (nodeId && !executedNodes.value.has(nodeId)) {
      executedNodes.value.add(nodeId);
      setNodeColor(nodeId, '#FFE0E0');
      setNodeStroke(nodeId, '#DC3545', '1.5');
      setNodeTextColor(nodeId, '#000000');
      addCheckMark(nodeId);
    }
    currentNode.value = nodeId;
    if (nodeId) {
      setNodeColor(nodeId, '#28a745');
      setNodeStroke(nodeId, '#1e7e34', '2');
      setNodeTextColor(nodeId, '#FFFFFF');
    }
  };

  const highlightEdge = (from: string, to: string, color = '#1890ff') => {
    if (!svgElement) return;
    const edgeKey = `${from}-${to}`;
    if (executedEdges.value.has(edgeKey)) return;
    executedEdges.value.add(edgeKey);
    setEdgeColor(from, to, color, '2');
  };

  const resetHighlights = () => {
    resetAllStyles();
    removeAllCheckMarks();
    executedNodes.value.clear();
    executedEdges.value.clear();
    currentNode.value = null;
  };

  // --- 渲染 Mermaid ---
  const renderMermaid = async (mermaidCode: string) => {
    if (!mermaidContainer.value) return;
    try {
      loading.value = true;

      // ===== 关键：初始化 Mermaid，禁用 htmlLabels =====
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: 'sans-serif',
        flowchart: {
          htmlLabels: false, // 强制使用纯 SVG 文本（默认为黑色）
          useMaxWidth: false,
        },
      });

      const { svg } = await mermaid.render('mermaid-svg', mermaidCode);
      mermaidContainer.value.innerHTML = svg;
      await nextTick();
      svgElement = mermaidContainer.value.querySelector('svg');

      if (panzoomInstance) {
        panzoomInstance.destroy();
        panzoomInstance = null;
      }

      if (svgElement) {
        // 计算尺寸（保持不变）
        let naturalHeight = 0;
        let naturalWidth = 0;
        const viewBox = svgElement.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.split(/\s+/).map(Number);
          if (parts.length === 4) {
            naturalWidth = parts[2];
            naturalHeight = parts[3];
          }
        }
        if (!naturalWidth || !naturalHeight) {
          try {
            const bbox = svgElement.getBBox();
            naturalWidth = bbox.width;
            naturalHeight = bbox.height;
          } catch {}
        }

        svgElement.style.display = 'block';
        svgElement.style.width = '100%';
        svgElement.style.height = 'auto';
        svgElement.style.maxWidth = 'none';
        svgElement.style.maxHeight = 'none';

        await nextTick();
        const container = mermaidContainer.value;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        let startScale = 1;
        if (
          naturalWidth &&
          naturalHeight &&
          containerWidth &&
          containerHeight
        ) {
          const scaleX = containerWidth / naturalWidth;
          const scaleY = containerHeight / naturalHeight;
          startScale = Math.min(scaleX, scaleY) * 0.8;
          startScale = Math.max(startScale, 0.5);
        }

        panzoomInstance = Panzoom(svgElement, {
          contain: 'outside',
          cursor: 'grab',
          step: 0.1,
          minScale: 0.5,
          maxScale: 10,
          startScale,
        });

        container.addEventListener('wheel', (event: WheelEvent) => {
          panzoomInstance?.zoomWithWheel(event);
        });
      }
      error.value = '';
    } catch (error_) {
      console.error('渲染流程图失败', error_);
      error.value = '流程图渲染失败';
    } finally {
      loading.value = false;
    }
  };

  // --- 缩放控制 ---
  const zoomIn = () => panzoomInstance?.zoomIn();
  const zoomOut = () => panzoomInstance?.zoomOut();
  const resetZoom = () => panzoomInstance?.reset();

  // --- 销毁 ---
  const destroy = () => {
    panzoomInstance?.destroy();
    panzoomInstance = null;
    svgElement = null;
  };

  return {
    mermaidContainer,
    loading,
    error,
    currentNode,
    executedNodes,
    executedEdges,
    renderMermaid,
    highlightNode,
    highlightEdge,
    resetHighlights,
    zoomIn,
    zoomOut,
    resetZoom,
    destroy,
  };
}
