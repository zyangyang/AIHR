import apiClient from './index';
import type { ApiResponse, Job, JobFormData, JobQueryParams, PaginatedResponse } from '@/types';

export const getJobsApi = (params: JobQueryParams) =>
  apiClient.get<ApiResponse<PaginatedResponse<Job>>>('/jobs', { params });

export const getJobApi = (id: number) =>
  apiClient.get<ApiResponse<Job>>(`/jobs/${id}`);

export const createJobApi = (data: JobFormData) =>
  apiClient.post<ApiResponse<Job>>('/jobs', data);

export const updateJobApi = (id: number, data: JobFormData) =>
  apiClient.put<ApiResponse<Job>>(`/jobs/${id}`, data);

export const deleteJobApi = (id: number) =>
  apiClient.delete<ApiResponse<null>>(`/jobs/${id}`);

export const updateJobStatusApi = (id: number, status: string) =>
  apiClient.patch<ApiResponse<Job>>(`/jobs/${id}/status`, { status });
