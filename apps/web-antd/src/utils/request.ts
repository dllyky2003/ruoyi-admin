/**
 * Axios 请求封装
 *
 * 适配 RuoYi-Admin / Vben 框架
 * 统一处理：
 * 1. 请求拦截器（Token 注入）
 * 2. 响应拦截器（错误处理、数据解构）
 * 3. 全局 Loading 状态（可选）
 */

import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

import { useAccessStore } from '@vben/stores';

// ==================== 请求拦截器 ====================
import axios from 'axios';

// ==================== 类型定义 ====================

/** 响应数据结构（根据实际后端调整） */
export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
  success?: boolean;
}

/** 请求配置选项 */
export interface RequestOptions {
  /** 是否显示错误提示，默认 true */
  showError?: boolean;
  /** 是否显示成功提示 */
  showSuccess?: boolean;
  /** 是否自动处理 401 跳转登录，默认 true */
  autoHandle401?: boolean;
  /** 请求超时时间（毫秒），默认 30000 */
  timeout?: number;
}

// ==================== 默认配置 ====================

const DEFAULT_OPTIONS: RequestOptions = {
  showError: true,
  showSuccess: false,
  autoHandle401: true,
  timeout: 30_000,
};
function getClientIdFromToken(token: string): null | string {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64URL 转标准 Base64
    let base64 = parts[1].replaceAll('-', '+').replaceAll('_', '/');
    // 补齐填充（Base64 需要 4 的倍数）
    while (base64.length % 4 !== 0) base64 += '=';
    const payload = JSON.parse(atob(base64));
    return payload.clientid || null;
  } catch (error) {
    console.warn('[Request] 解析 clientid 失败:', error);
    return null;
  }
}
// ==================== 创建 Axios 实例 ====================

export const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json;charset=UTF-8',
  },
}); // 新增导入

// ... 其他代码不变 ...

// ==================== 请求拦截器 ====================
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessStore = useAccessStore();
    let token = accessStore.accessToken;
    if (!token) {
      token =
        localStorage.getItem('access_token') ||
        sessionStorage.getItem('access_token');
    }

    if (token) {
      // 1. 设置 Authorization 头 (Bearer 前缀)
      config.headers.Authorization = `Bearer ${token}`;

      // 2. 解析 clientid 并添加到请求头
      const clientId = getClientIdFromToken(token);
      if (clientId) {
        config.headers.clientid = clientId; // 根据后端要求，可能为 'client-id' 或 'clientId'
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ==================== 响应拦截器 ====================

request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const { data, config } = response;

    // 如果响应不是标准格式，直接返回
    if (data === undefined || data === null) {
      return response;
    }

    // 检查后端返回的 code
    const code = data.code ?? data.status ?? 200;
    const message = data.msg ?? data.message ?? '操作成功';

    // 成功状态码（根据实际后端调整）
    if (code === 200 || code === 0) {
      // 如果配置了显示成功提示
      const options = (config as any)._options as RequestOptions;
      if (options?.showSuccess) {
        console.log(message);
      }
      return data;
    }

    // ===== 业务错误处理 =====
    const options = (config as any)._options as RequestOptions;

    // 401 未授权 → 跳转登录
    if (code === 401) {
      if (options?.autoHandle401 !== false) {
        handleUnauthorized();
      }
      return Promise.reject(new Error('未授权，请重新登录'));
    }

    // 其他业务错误
    if (options?.showError !== false) {
      console.error(message || '请求失败');
    }

    return Promise.reject(new Error(message || '请求失败'));
  },
  (error: AxiosError) => {
    // ===== HTTP 错误处理 =====
    const config = error.config as any;
    const options = (config?._options as RequestOptions) || DEFAULT_OPTIONS;

    // 取消的请求不处理
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    // 网络错误
    if (!error.response) {
      if (options.showError !== false) {
        console.error('网络连接异常，请检查网络设置');
      }
      return Promise.reject(new Error('网络连接异常'));
    }

    const { status } = error.response;

    // 根据 HTTP 状态码处理
    let errorMessage = error.message || '请求失败';

    switch (status) {
      case 400: {
        errorMessage = '请求参数错误';
        break;
      }
      case 401: {
        errorMessage = '未授权，请重新登录';
        if (options.autoHandle401 !== false) {
          handleUnauthorized();
        }
        break;
      }
      case 403: {
        errorMessage = '没有权限访问该资源';
        break;
      }
      case 404: {
        errorMessage = '请求的资源不存在';
        break;
      }
      case 500: {
        errorMessage = '服务器内部错误';
        break;
      }
      case 502: {
        errorMessage = '网关错误';
        break;
      }
      case 503: {
        errorMessage = '服务不可用';
        break;
      }
      case 504: {
        errorMessage = '网关超时';
        break;
      }
      default: {
        errorMessage = error.message || `请求失败 (${status})`;
      }
    }

    if (options.showError !== false) {
      console.error(errorMessage);
    }

    console.error('[Request] 响应错误:', error);
    return Promise.reject(new Error(errorMessage));
  },
);

// ==================== 辅助函数 ====================

/**
 * 处理未授权（401）
 * 清除用户信息并跳转到登录页
 */
function handleUnauthorized() {
  // 清除 Token
  localStorage.removeItem('access_token');
  sessionStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');

  // 清空用户 Store（如果有）
  try {
    const userStore = useUserStore?.();
    if (userStore && typeof userStore.resetState === 'function') {
      userStore.resetState();
    }
  } catch {
    // ignore
  }

  // 跳转到登录页
  const currentPath = window.location.pathname + window.location.search;
  if (!currentPath.includes('/login')) {
    console.log('登录已过期，请重新登录', '提示', {
      confirmButtonText: '确定',
      callback: () => {
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      },
    });
  }
}

/**
 * 创建带选项的请求（支持自定义配置）
 */
export function createRequest<T = any>(
  config: AxiosRequestConfig,
  options: RequestOptions = {},
): Promise<T> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  // 将选项附加到 config 中，供拦截器使用
  (config as any)._options = mergedOptions;
  return request.request<T>(config);
}

// ==================== 快捷方法 ====================

/**
 * GET 请求
 */
export function get<T = any>(
  url: string,
  params?: any,
  options?: RequestOptions,
): Promise<T> {
  return createRequest<T>(
    {
      method: 'GET',
      url,
      params,
    },
    options,
  );
}

/**
 * POST 请求
 */
export function post<T = any>(
  url: string,
  data?: any,
  options?: RequestOptions,
): Promise<T> {
  return createRequest<T>(
    {
      method: 'POST',
      url,
      data,
    },
    options,
  );
}

/**
 * PUT 请求
 */
export function put<T = any>(
  url: string,
  data?: any,
  options?: RequestOptions,
): Promise<T> {
  return createRequest<T>(
    {
      method: 'PUT',
      url,
      data,
    },
    options,
  );
}

/**
 * DELETE 请求
 */
export function del<T = any>(
  url: string,
  params?: any,
  options?: RequestOptions,
): Promise<T> {
  return createRequest<T>(
    {
      method: 'DELETE',
      url,
      params,
    },
    options,
  );
}

// ==================== 导出默认 ====================

export default request;

// 声明全局类型（给 Vite 使用）
declare global {
  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
    readonly VITE_APP_TITLE: string;
    // ... 其他环境变量
  }
}
