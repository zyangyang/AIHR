import apiClient from './index';
import type { ApiResponse, ApplyJobInfo, CaptchaResponse, ApplyFormData } from '@/types';

export const getApplyJobInfoApi = (token: string) =>
  apiClient.get<ApiResponse<ApplyJobInfo>>(`/apply/${token}`);

export const getCaptchaApi = () =>
  apiClient.get<ApiResponse<CaptchaResponse>>('/apply/captcha');

export const submitApplyApi = (token: string, data: ApplyFormData) => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (key === 'resume') {
      formData.append('resume', value as File);
    } else {
      formData.append(key, String(value));
    }
  });
  return apiClient.post<ApiResponse<null>>(`/apply/${token}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
