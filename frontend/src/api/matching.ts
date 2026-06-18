import apiClient from './index';
import type { ApiResponse, TaskResponse, ParseStatusResponse, ScoreStatusResponse, ScoreParams } from '@/types';

export const triggerParseApi = (resumeId: number) =>
  apiClient.post<ApiResponse<TaskResponse>>(`/matching/${resumeId}/parse`);

export const getParseStatusApi = (resumeId: number) =>
  apiClient.get<ApiResponse<ParseStatusResponse>>(`/matching/${resumeId}/parse/status`);

export const triggerScoreApi = (resumeId: number, params: ScoreParams) =>
  apiClient.post<ApiResponse<TaskResponse>>(`/matching/${resumeId}/score`, params);

export const getScoreStatusApi = (resumeId: number) =>
  apiClient.get<ApiResponse<ScoreStatusResponse>>(`/matching/${resumeId}/score/status`);

export const triggerRescoreApi = (resumeId: number, params: ScoreParams) =>
  apiClient.post<ApiResponse<TaskResponse>>(`/matching/${resumeId}/rescore`, params);

export const downloadScorePdfApi = (resumeId: number) =>
  apiClient.get(`/matching/${resumeId}/download/score-pdf`, { responseType: 'blob' });
