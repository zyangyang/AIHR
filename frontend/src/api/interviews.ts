import apiClient from './index';
import type {
  ApiResponse,
  InterviewRecord,
  PaginatedResponse,
  InterviewStatusResponse,
  TaskResponse,
  ScoreParams,
} from '@/types';

export const generateInterviewApi = (resumeId: number, params: ScoreParams) =>
  apiClient.post<ApiResponse<TaskResponse>>(`/interviews/${resumeId}/generate`, params);

export const getInterviewStatusApi = (resumeId: number) =>
  apiClient.get<ApiResponse<InterviewStatusResponse>>(`/interviews/${resumeId}/status`);

export const downloadInterviewPdfApi = (resumeId: number) =>
  apiClient.get(`/interviews/${resumeId}/download/pdf`, { responseType: 'blob' });

export const downloadInterviewDocxApi = (resumeId: number) =>
  apiClient.get(`/interviews/${resumeId}/download/docx`, { responseType: 'blob' });

export const getInterviewsApi = (params?: { page?: number; page_size?: number; status?: string }) =>
  apiClient.get<ApiResponse<PaginatedResponse<InterviewRecord>>>('/interviews', { params });
