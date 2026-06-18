import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Form, Input, Button, Select, Upload, message, Card, Typography, Steps, Result, Tabs, Divider, Alert, Table, Tag, Progress } from 'antd';
import { ArrowLeftOutlined, InboxOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Job, BatchImportResultItem } from '@/types';
import { getJobsApi } from '@/api/jobs';
import { parseFileApi, getParseStatusApi, updateResumeApi, batchImportResumesApi } from '@/api/resumes';

const { Title } = Typography;
const { Dragger } = Upload;

const employmentOptions = [
  { label: '在职', value: 'employed' },
  { label: '离职', value: 'unemployed' },
  { label: '应届', value: 'fresh' },
];

// ==================== 单份导入 ====================
const parseSteps = [
  { title: '上传文件', desc: '上传简历到服务器' },
  { title: '提取文本', desc: '从文件中提取文字内容' },
  { title: 'AI 识别', desc: '大模型解析简历信息' },
  { title: '填充表单', desc: '将解析结果填入表单' },
];

const SingleImport: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [form] = Form.useForm();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseStep, setParseStep] = useState(-1); // -1=未开始, 0~3=各步骤
  const [parsePercent, setParsePercent] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [fileList, setFileList] = useState<any[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const res = await getJobsApi({ page: 1, page_size: 100 });
        setJobs(res.data.data.items || []);
      } catch (error) {
        console.error('加载职位列表失败:', error);
        setJobs([]);
      }
    };
    loadJobs();
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []);

  const startPolling = useCallback((id: number) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await getParseStatusApi(id);
        const { status, parsed_data } = res.data.data;

        if (status === 'success' && parsed_data) {
          // 清理轮询和进度定时器
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null; }

          setParsePercent(95);
          setParseStep(3);

          // 填充表单
          form.setFieldsValue({
            name: parsed_data.name || '',
            phone: parsed_data.phone || '',
            email: parsed_data.email || '',
            employment_status: parsed_data.employment_status || undefined,
            expected_salary: parsed_data.expected_salary || '',
          });
          setParsePercent(100);
          await new Promise((r) => setTimeout(r, 400));

          if (parsed_data.name || parsed_data.phone || parsed_data.email) {
            message.success('简历解析成功，已自动填充信息');
          } else {
            message.warning('简历解析完成，但未提取到关键信息，请手动填写');
          }
          setParsing(false);
          setParseStep(-1);
          setParsePercent(0);
        } else if (status === 'failed') {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null; }
          setParseError('AI 解析简历内容失败，请手动填写信息');
          setParsing(false);
          setParseStep(-1);
          setParsePercent(0);
        }
        // pending / parsing 状态继续轮询
      } catch (error) {
        // 轮询请求失败，继续尝试
        console.warn('轮询解析状态失败:', error);
      }
    }, 2000); // 每 2 秒轮询一次
  }, [form]);

  const handleFileChange = async (file: File) => {
    // 先校验关联职位是否已选
    const jobId = form.getFieldValue('job_id');
    if (!jobId) {
      message.error('请先选择关联职位');
      setFileList([]);
      return;
    }

    setParseError(null);
    setParsing(true);
    setParsePercent(0);
    setResumeId(null);
    form.setFieldsValue({ name: '', phone: '', email: '', employment_status: undefined, expected_salary: '' });

    // 步骤1：上传文件
    setParseStep(0);
    try {
      const res = await parseFileApi(file, jobId);
      const { resume_id } = res.data.data;
      setResumeId(resume_id);
      setParsePercent(20);

      // 步骤2：提取文本（后端已开始异步解析）
      setParseStep(1);
      await new Promise((r) => setTimeout(r, 500));
      setParsePercent(30);

      // 步骤3：AI 识别（开始轮询 + 模拟进度）
      setParseStep(2);

      // 模拟进度推进
      progressRef.current = setInterval(() => {
        setParsePercent((prev) => {
          if (prev >= 90) return 90;
          const remaining = 90 - prev;
          const increment = Math.max(0.5, remaining * 0.03);
          return Math.min(90, prev + increment);
        });
      }, 1000);

      // 开始轮询解析状态
      startPolling(resume_id);
    } catch (error: any) {
      const errMsg = error?.response?.data?.detail || error?.response?.data?.message || error?.message || '上传文件失败';
      setParseError(errMsg);
      setParsing(false);
      setParseStep(-1);
      setParsePercent(0);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!resumeId) {
        message.error('请先上传简历文件');
        return;
      }
      setSubmitting(true);
      // 更新已有记录（而非创建新记录）
      await updateResumeApi(resumeId, {
        name: values.name || '',
        phone: values.phone || '',
        email: values.email || '',
        employment_status: values.employment_status || '',
        expected_salary: values.expected_salary || '',
      });
      message.success('导入成功');
      onSuccess();
    } catch (error: any) {
      if (error?.errorFields) return;
      console.error('导入失败:', error);
      message.error('导入失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: 600, margin: '0 auto' }}>
      <Form.Item name="job_id" label="关联职位" rules={[{ required: true, message: '请选择关联职位' }]}>
        <Select options={jobs.map((j) => ({ label: j.title, value: j.id }))} placeholder="请选择关联职位" disabled={parsing} />
      </Form.Item>
      <Form.Item label="简历文件" required>
        <Dragger
          accept=".pdf,.doc,.docx"
          maxCount={1}
          fileList={fileList}
          disabled={parsing}
          customRequest={({ file, onSuccess: onCustomSuccess }) => {
            onCustomSuccess?.({}, new XMLHttpRequest());
            handleFileChange(file as File);
          }}
          onChange={({ fileList: newFileList }) => {
            setFileList(newFileList.slice(-1));
          }}
          onRemove={() => {
            setResumeId(null);
            setParseError(null);
            setFileList([]);
          }}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持 PDF、DOC、DOCX 格式，最大 10MB</p>
        </Dragger>
      </Form.Item>

      {parsing && (
        <Card
          size="small"
          style={{ marginBottom: 16, background: '#f6f8fa' }}
          styles={{ body: { padding: '16px 20px' } }}
        >
          <Steps
            current={parseStep}
            size="small"
            items={parseSteps.map((step, idx) => ({
              title: step.title,
              description: idx < parseStep ? '已完成' : idx === parseStep ? step.desc : '',
              icon: idx < parseStep ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                    idx === parseStep ? <LoadingOutlined style={{ color: '#1677ff' }} /> : undefined,
            }))}
          />
          <Progress
            percent={Math.round(parsePercent)}
            size="small"
            status="active"
            style={{ marginTop: 12 }}
          />
          <div style={{ color: '#888', fontSize: 12, marginTop: 4, textAlign: 'center' }}>
            {parseStep === 2 ? '大模型正在分析简历内容，通常需要 10-60 秒...' : ''}
          </div>
        </Card>
      )}
      {parseError && (
        <Alert
          message="简历解析失败"
          description={parseError}
          type="warning"
          showIcon
          closable
          onClose={() => setParseError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Divider plain>以下信息由 AI 自动识别填充，可手动修改</Divider>

      <Form.Item name="name" label="候选人姓名">
        <Input placeholder="请输入姓名" />
      </Form.Item>
      <Form.Item name="phone" label="手机号">
        <Input placeholder="请输入手机号" />
      </Form.Item>
      <Form.Item name="email" label="邮箱">
        <Input placeholder="请输入邮箱" />
      </Form.Item>
      <Form.Item name="employment_status" label="在职状态">
        <Select options={employmentOptions} placeholder="请选择在职状态" allowClear />
      </Form.Item>
      <Form.Item name="expected_salary" label="期望薪资">
        <Input placeholder="请输入期望薪资" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting} block size="large">
          提交导入
        </Button>
      </Form.Item>
    </Form>
  );
};

// ==================== 批量导入 ====================
const BatchImport: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [form] = Form.useForm();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [fileList, setFileList] = useState<any[]>([]);
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    success_count: number;
    failed_count: number;
    results: BatchImportResultItem[];
  } | null>(null);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const res = await getJobsApi({ page: 1, page_size: 100 });
        setJobs(res.data.data.items || []);
      } catch (error) {
        console.error('加载职位列表失败:', error);
        setJobs([]);
      }
    };
    loadJobs();
  }, []);

  const handleBatchSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (rawFiles.length === 0) {
        message.error('请上传简历文件');
        return;
      }
      setSubmitting(true);
      const res = await batchImportResumesApi(rawFiles, values.job_id);
      setImportResult(res.data.data);
    } catch (error: any) {
      if (error?.errorFields) return;
      console.error('批量导入失败:', error);
      message.error('批量导入失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (importResult) {
    return (
      <Result
        status={importResult.failed_count > 0 ? 'warning' : 'success'}
        title="批量导入完成"
        subTitle={`共 ${importResult.total} 份简历，成功 ${importResult.success_count} 份，失败 ${importResult.failed_count} 份。系统将自动解析简历内容并填充信息。`}
        extra={[
          <Button type="primary" key="go" onClick={onSuccess}>前往简历管理</Button>,
          <Button key="back" onClick={() => { setImportResult(null); setFileList([]); setRawFiles([]); form.resetFields(); }}>继续导入</Button>,
        ]}
      >
        {importResult.failed_count > 0 && (
          <Table
            size="small"
            pagination={false}
            dataSource={importResult.results.filter((r) => r.status === 'failed')}
            rowKey="file_name"
            columns={[
              { title: '文件名', dataIndex: 'file_name', key: 'file_name' },
              { title: '状态', dataIndex: 'status', key: 'status', render: () => <Tag color="error">失败</Tag> },
              { title: '原因', dataIndex: 'error', key: 'error' },
            ]}
          />
        )}
      </Result>
    );
  }

  return (
    <Form form={form} layout="vertical" style={{ maxWidth: 600, margin: '0 auto' }}>
      <Form.Item name="job_id" label="关联职位" rules={[{ required: true, message: '请选择关联职位' }]}>
        <Select options={jobs.map((j) => ({ label: j.title, value: j.id }))} placeholder="请选择关联职位" />
      </Form.Item>
      <Form.Item label="简历文件" required>
        <Dragger
          accept=".pdf,.doc,.docx"
          multiple
          fileList={fileList}
          customRequest={({ file, onSuccess: onCustomSuccess }) => {
            onCustomSuccess?.({}, new XMLHttpRequest());
            setRawFiles((prev) => [...prev, file as File]);
          }}
          onChange={({ fileList: newFileList }) => {
            setFileList(newFileList);
          }}
          onRemove={(file) => {
            setRawFiles((prev) => prev.filter((f) => f.name !== file.name || f.size !== file.size));
          }}
          maxCount={50}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持 PDF、DOC、DOCX 格式，单文件最大 10MB，最多 50 份</p>
        </Dragger>
      </Form.Item>
      {fileList.length > 0 && (
        <Alert
          message={`已选择 ${fileList.length} 份简历文件`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Form.Item>
        <Button type="primary" onClick={handleBatchSubmit} loading={submitting} block size="large" disabled={rawFiles.length === 0}>
          批量导入（{rawFiles.length} 份）
        </Button>
      </Form.Item>
    </Form>
  );
};

// ==================== 主页面 ====================
const ResumeImport: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const handleSuccess = () => {
    setStep(1);
  };

  if (step === 1) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/resumes')} style={{ marginBottom: 16 }}>
          返回列表
        </Button>
        <Result status="success" title="导入成功" subTitle="简历已成功导入，系统将自动解析简历内容。请在简历管理中查看处理结果" extra={[
          <Button type="primary" key="go" onClick={() => navigate('/resumes')}>前往简历管理</Button>,
          <Button key="back" onClick={() => { setStep(0); }}>继续导入</Button>,
        ]} />
      </div>
    );
  }

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/resumes')} style={{ marginBottom: 16 }}>
        返回
      </Button>
      <Title level={4}>导入简历</Title>
      <Steps current={0} style={{ maxWidth: 400, margin: '0 auto 32px' }} items={[{ title: '填写信息并上传' }, { title: '导入完成' }]} />
      <Card>
        <Tabs
          items={[
            {
              key: 'single',
              label: '单份导入',
              children: <SingleImport onSuccess={handleSuccess} />,
            },
            {
              key: 'batch',
              label: '批量导入',
              children: <BatchImport onSuccess={handleSuccess} />,
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default ResumeImport;
