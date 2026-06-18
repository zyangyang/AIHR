import apiClient from './index';
import type {
  ApiResponse,
  Resume,
  ResumeQueryParams,
  PaginatedResponse,
  ImportFormData,
  UpdateResumeStatusParams,
  ParseFileResult,
  BatchImportResult,
  AiSearchResult,
  IndexStatus,
  EmbeddingConfig,
} from '@/types';

export const getResumesApi = (params: ResumeQueryParams) =>
  apiClient.get<ApiResponse<PaginatedResponse<Resume>>>('/resumes', { params });

export const getResumeApi = (id: number) =>
  apiClient.get<ApiResponse<Resume>>(`/resumes/${id}`);

export const importResumeApi = (data: ImportFormData & { resume: File }) => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value as string | Blob);
    }
  });
  return apiClient.post<ApiResponse<Resume>>('/resumes/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const parseFileApi = (file: File, jobId: number) => {
  const formData = new FormData();
  formData.append('resume', file);
  formData.append('job_id', String(jobId));
  return apiClient.post<ApiResponse<{ resume_id: number; parse_status: string }>>('/resumes/parse-file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    _skipErrorHandler: true,
  } as any);
};

export const getParseStatusApi = (resumeId: number) =>
  apiClient.get<ApiResponse<{ status: string; parsed_data: any }>>(`/matching/${resumeId}/parse/status`, {
    _skipErrorHandler: true,
  } as any);

export const updateResumeApi = (id: number, data: { name?: string; phone?: string; email?: string; employment_status?: string; expected_salary?: string }) => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });
  return apiClient.put<ApiResponse<Resume>>(`/resumes/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const batchImportResumesApi = (files: File[], jobId: number) => {
  const formData = new FormData();
  formData.append('job_id', String(jobId));
  files.forEach((file) => {
    formData.append('files', file);
  });
  return apiClient.post<ApiResponse<BatchImportResult>>('/resumes/batch-import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const downloadResumeFileApi = (id: number) =>
  apiClient.get(`/resumes/${id}/file`, { responseType: 'blob' });

export const updateResumeStatusApi = (id: number, params: UpdateResumeStatusParams) =>
  apiClient.patch<ApiResponse<Resume>>(`/resumes/${id}/status`, params);

// AI 搜索
export const aiSearchResumesApi = (query: string, topK?: number) =>
  apiClient.post<ApiResponse<AiSearchResult>>('/ai-search', { query, top_k: topK });

export const buildAiSearchIndexApi = () =>
  apiClient.post<ApiResponse<{ is_indexing: boolean }>>('/ai-search/index');

export const getAiSearchIndexStatusApi = () =>
  apiClient.get<ApiResponse<IndexStatus>>('/ai-search/index/status');

export const getEmbeddingConfigApi = () =>
  apiClient.get<ApiResponse<EmbeddingConfig>>('/ai-search/embedding-config');
