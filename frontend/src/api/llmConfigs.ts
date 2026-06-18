import apiClient from './index';
import type { ApiResponse, LLMConfig, LLMConfigFormData, TokenUsageResponse } from '@/types';

export const getLLMConfigsApi = () =>
  apiClient.get<ApiResponse<LLMConfig[]>>('/llm-configs');

export const createLLMConfigApi = (data: LLMConfigFormData) =>
  apiClient.post<ApiResponse<LLMConfig>>('/llm-configs', data);

export const updateLLMConfigApi = (id: number, data: LLMConfigFormData) =>
  apiClient.put<ApiResponse<LLMConfig>>(`/llm-configs/${id}`, data);

export const deleteLLMConfigApi = (id: number) =>
  apiClient.delete<ApiResponse<null>>(`/llm-configs/${id}`);

export const getTokenUsageApi = (startDate?: string, endDate?: string) =>
  apiClient.get<ApiResponse<TokenUsageResponse>>('/llm-configs/token-usage', {
    params: { start_date: startDate, end_date: endDate },
  });
