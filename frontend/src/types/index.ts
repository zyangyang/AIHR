// ==================== 通用类型 ====================

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface PageParams {
  page?: number;
  page_size?: number;
}

// ==================== 用户 ====================

export interface User {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ChangePasswordParams {
  old_password: string;
  new_password: string;
}

// ==================== 职位 ====================

export type JobStatus = 'draft' | 'published' | 'paused' | 'closed';

export interface HardRequirements {
  min_education?: string;
  min_years?: number;
  required_skills?: string[];
}

export interface Job {
  id: number;
  title: string;
  category: string;
  location: string;
  salary_range?: string;
  description: string;
  hard_requirements?: HardRequirements;
  status: JobStatus;
  apply_token: string;
  resume_count: number;
  created_at: string;
  updated_at: string;
}

export interface JobFormData {
  title: string;
  category: string;
  location: string;
  salary_range?: string;
  description: string;
  hard_requirements?: HardRequirements;
  status?: JobStatus;
}

export interface JobQueryParams extends PageParams {
  status?: JobStatus;
  keyword?: string;
}

// ==================== 简历 ====================

export type ResumeStatus = 'new' | 'rejected' | 'pending' | 'interview';
export type ParseStatus = 'pending' | 'parsing' | 'success' | 'failed';

export interface WorkExperience {
  company: string;
  position: string;
  start_date: string;
  end_date: string;
  description: string;
}

export interface Education {
  school: string;
  degree: string;
  major: string;
  start_date: string;
  end_date: string;
}

export interface ParsedData {
  name: string;
  phone: string;
  email: string;
  work_experience: WorkExperience[];
  education: Education[];
  skills: string[];
}

export interface ScoreRecord {
  id: number;
  total_score: number;
  responsibility_score: number;
  skill_score: number;
  experience_score: number;
  education_score: number;
  soft_skill_score: number;
  advantages: string;
  disadvantages: string;
  summary: string;
  prompt_name: string;
  model_name: string;
  tokens_used: number;
  estimated_cost?: number;
  scored_at: string;
}

export interface Resume {
  id: number;
  name: string;
  phone: string;
  email: string;
  employment_status?: string;
  expected_salary?: string;
  additional_message?: string;
  job_id: number;
  job_title: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  parse_status: ParseStatus;
  parse_tokens_used?: number;
  parse_model_name?: string;
  parse_estimated_cost?: number;
  embedding_tokens_used?: number;
  embedding_model_name?: string;
  embedding_estimated_cost?: number;
  score_status: string;
  interview_status: string;
  parsed_data?: ParsedData;
  status: ResumeStatus;
  reject_reason?: string;
  score?: number;
  scores?: ScoreRecord[];
  interview_question?: {
    id: number;
    status: string;
    tokens_used?: number;
    model_name?: string;
    estimated_cost?: number;
    generated_at?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ResumeQueryParams extends PageParams {
  job_id?: number;
  status?: ResumeStatus;
  parse_status?: ParseStatus;
  keyword?: string;
  start_date?: string;
  end_date?: string;
}

export interface ImportFormData {
  name?: string;
  phone?: string;
  email?: string;
  employment_status?: string;
  expected_salary?: string;
  job_id: number;
}

export interface ParseFileResult {
  name?: string;
  phone?: string;
  email?: string;
  employment_status?: string;
  expected_salary?: string;
}

export interface BatchImportResultItem {
  file_name: string;
  resume_id?: number;
  status: 'success' | 'failed';
  error?: string;
}

export interface BatchImportResult {
  total: number;
  success_count: number;
  failed_count: number;
  results: BatchImportResultItem[];
}

export interface UpdateResumeStatusParams {
  status: ResumeStatus;
  reject_reason?: string;
}

// ==================== 匹配处理 ====================

export interface ScoreParams {
  prompt_id?: number;
  llm_config_id?: number;
}

export interface TaskResponse {
  task_id: string;
}

export interface ParseStatusResponse {
  status: ParseStatus;
  parsed_data?: ParsedData;
}

export interface ScoreStatusResponse {
  status: 'pending' | 'running' | 'success' | 'failed';
  score?: ScoreRecord;
}

// ==================== 面试题 ====================

export type InterviewStatus = 'pending' | 'generating' | 'success' | 'failed';

export interface InterviewQuestion {
  question: string;
  intent: string;
  evaluation_points: string[];
}

export interface InterviewQuestionsData {
  module_1: InterviewQuestion[];
  module_2: InterviewQuestion[];
  module_3: InterviewQuestion[];
  module_4: InterviewQuestion[];
}

export interface InterviewStatusResponse {
  status: InterviewStatus;
  questions?: InterviewQuestionsData;
  tokens_used?: number;
  model_name?: string;
  estimated_cost?: number;
  generated_at?: string;
}

export interface InterviewRecord {
  id: number;
  resume_id: number;
  name: string;
  phone: string;
  email: string;
  job_title: string;
  score?: number;
  status: InterviewStatus;
  generated_at?: string;
}

// ==================== 提示词 ====================

export type PromptType = 'score' | 'interview' | 'hard_filter' | 'parse';

export interface PromptVersion {
  version: number;
  content: string;
  created_at: string;
}

export interface Prompt {
  id: number;
  name: string;
  type: PromptType;
  content: string;
  is_system_default: boolean;
  current_version: number;
  usage_count: number;
  versions?: PromptVersion[];
  created_at: string;
  updated_at: string;
}

export interface PromptFormData {
  name: string;
  type: PromptType;
  content: string;
}

// ==================== 大模型配置 ====================

export interface LLMConfig {
  id: number;
  name: string;
  provider: string;
  model_name: string;
  api_key?: string;
  base_url: string;
  price_per_million_tokens: number;
  is_active: boolean;
  config_type: 'chat' | 'embedding';
  created_at: string;
  updated_at: string;
}

export interface LLMConfigFormData {
  name: string;
  provider: string;
  model_name: string;
  api_key: string;
  base_url: string;
  price_per_million_tokens: number;
  is_active: boolean;
  config_type?: string;
}

export interface TokenUsageByFunction {
  function_type: string;
  tokens: number;
  cost: number;
}

export interface TokenUsageByDay {
  date: string;
  tokens: number;
  cost: number;
}

export interface TokenUsageResponse {
  total_tokens: number;
  total_cost: number;
  by_function: TokenUsageByFunction[];
  by_day: TokenUsageByDay[];
}

// ==================== 投递 ====================

export interface ApplyJobInfo {
  job_id: number;
  title: string;
  location: string;
  salary_range?: string;
  description: string;
  status: JobStatus;
}

export interface CaptchaResponse {
  captcha_id: string;
  captcha_image: string;
}

export interface ApplyFormData {
  name: string;
  phone: string;
  email: string;
  employment_status: string;
  expected_salary?: string;
  additional_message?: string;
  resume: File;
  captcha_id: string;
  captcha_code: string;
  privacy_agreed: boolean;
}

// ==================== Dashboard ====================

export interface DashboardStats {
  active_jobs: number;
  today_applications: number;
  pending_resumes: number;
  interview_resumes: number;
}

// ==================== AI 搜索 ====================

export interface AiSearchResultItem {
  resume: Resume;
  score: number;
}

export interface AiSearchResult {
  items: AiSearchResultItem[];
  total: number;
}

export interface IndexStatus {
  indexed_count: number;
  total_count: number;
}

export interface EmbeddingConfig {
  configured: boolean;
  config_name?: string;
  model_name?: string;
  base_url?: string;
  source?: 'database' | 'env';
}
