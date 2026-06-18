import apiClient from './index';
import type { ApiResponse, Prompt, PromptFormData, PromptType } from '@/types';

export const getPromptsApi = (type?: PromptType) =>
  apiClient.get<ApiResponse<Prompt[]>>('/prompts', { params: type ? { type } : undefined });

export const getPromptApi = (id: number) =>
  apiClient.get<ApiResponse<Prompt>>(`/prompts/${id}`);

export const createPromptApi = (data: PromptFormData) =>
  apiClient.post<ApiResponse<Prompt>>('/prompts', data);

export const updatePromptApi = (id: number, data: Partial<PromptFormData>) =>
  apiClient.put<ApiResponse<Prompt>>(`/prompts/${id}`, data);

export const deletePromptApi = (id: number) =>
  apiClient.delete<ApiResponse<null>>(`/prompts/${id}`);
