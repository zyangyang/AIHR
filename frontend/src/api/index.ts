import axios from 'axios';
import { message } from 'antd';

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：自动添加 token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：处理错误
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 跳过全局错误提示（由调用方自行处理）
    if (error.config?._skipErrorHandler) {
      return Promise.reject(error);
    }
    if (error.response) {
      const { status, data } = error.response;
      // 公开接口（如投递页面）有 mock 数据回退，静默处理 404
      const isPublicEndpoint = error.config?.url?.includes('/apply/');
      if (status === 401) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        message.error('登录已过期，请重新登录');
      } else if (status === 403) {
        message.error('权限不足');
      } else if (status === 404) {
        if (!isPublicEndpoint) {
          message.error('资源不存在');
        }
      } else if (status === 429) {
        message.error('请求过于频繁，请稍后再试');
      } else {
        message.error(data?.message || '请求失败');
      }
    } else {
      message.error('网络错误，请检查网络连接');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
