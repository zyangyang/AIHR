import apiClient from './index';
import type { ApiResponse, LoginParams, LoginResponse, ChangePasswordParams, User } from '@/types';

export const loginApi = (params: LoginParams) =>
  apiClient.post<ApiResponse<LoginResponse>>('/auth/login', params);

export const changePasswordApi = (params: ChangePasswordParams) =>
  apiClient.post<ApiResponse<null>>('/auth/change-password', params);

export const getUserInfoApi = () =>
  apiClient.get<ApiResponse<User>>('/auth/me');
