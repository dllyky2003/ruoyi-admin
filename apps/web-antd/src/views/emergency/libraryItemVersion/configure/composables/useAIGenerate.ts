import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

// composables/useAIGenerate.ts
import { message } from 'ant-design-vue';

export interface GenerateDraftRequest {
  caseName: string;
  patientGender: string;
  patientAge: number; // 补全类型
  mainFlowType: string;
  difficultyLevel: string;
  estimatedDurationMinutes: string;
  learningObjectives: string;
  modelName: string;
}

let generating = false;

/**
 * 调用后端 AI 生成接口
 * @param params 请求参数
 * @returns 解析后的案例数据对象，失败返回 null
 */
export async function doGenerateDraft(params: GenerateDraftRequest) {
  if (!params.modelName?.trim()) {
    message.error('请指定模型');
    return null;
  }

  if (generating) {
    message.warning('正在生成中，请稍候...');
    return null;
  }

  generating = true;
  try {
    const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
    const accessStore = useAccessStore();
    const token = accessStore.accessToken
      ? `Bearer ${accessStore.accessToken}`
      : '';
    if (!token) {
      message.warning('请先登录');
      return null;
    }

    const url = `${apiURL}/emergency/libraryItemVersion/aiGenerate`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const result = await response.json();
    console.log('完整响应:', result);

    if (result.code !== 200) {
      throw new Error(result.msg || 'AI 生成失败');
    }

    // 核心修改：解析 msg 并返回解析后的对象
    try {
      const parsed = JSON.parse(result.msg);
      console.info('解析后的案例数据:', JSON.stringify(parsed, null, 2));
      return parsed; // 返回解析后的对象
    } catch (parseError) {
      console.error('JSON 解析失败:', parseError);
      message.error('返回数据格式异常，请联系管理员');
      return null;
    }
  } catch (error: any) {
    console.error('AI 生成失败:', error);
    message.error(error.message || 'AI 生成失败，请重试');
    return null;
  } finally {
    generating = false;
  }
}
