import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Select, Upload, Checkbox, Card, Typography, Result, Spin, Space, message, Divider } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import type { ApplyJobInfo } from '@/types';
import { getApplyJobInfoApi, submitApplyApi, getCaptchaApi } from '@/api/apply';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const employmentOptions = [
  { label: '在职', value: 'employed' },
  { label: '离职', value: 'unemployed' },
  { label: '应届', value: 'fresh' },
];

interface ApplyFormValues {
  name: string;
  phone: string;
  email: string;
  employment_status: string;
  expected_salary?: string;
  additional_message?: string;
  resume?: any;
  captcha_code: string;
  privacy_agreed: boolean;
}

const Apply: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [form] = Form.useForm();
  const [jobInfo, setJobInfo] = useState<ApplyJobInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');

  useEffect(() => {
    loadJobInfo();
    loadCaptcha();
  }, [token]);

  const loadJobInfo = async () => {
    setLoading(true);
    try {
      const res = await getApplyJobInfoApi(token!);
      setJobInfo(res.data.data);
    } catch (error) {
      console.error('加载职位信息失败:', error);
      setJobInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const loadCaptcha = async () => {
    try {
      const res = await getCaptchaApi();
      setCaptchaId(res.data.data.captcha_id);
      setCaptchaImage(res.data.data.captcha_image);
    } catch {
      // 验证码功能可选
    }
  };

  const handleSubmit = async (values: ApplyFormValues) => {
    const fileList = values.resume;
    const file = fileList?.[0]?.originFileObj;
    if (!file) {
      message.error('请上传简历文件');
      return;
    }
    setSubmitting(true);
    try {
      await submitApplyApi(token!, {
        name: values.name,
        phone: values.phone,
        email: values.email,
        employment_status: values.employment_status,
        expected_salary: values.expected_salary || undefined,
        additional_message: values.additional_message,
        resume: file,
        captcha_id: captchaId,
        captcha_code: values.captcha_code || '',
        privacy_agreed: values.privacy_agreed,
      });
      message.success('投递成功');
      setSuccess(true);
    } catch (error) {
      console.error('投递失败:', error);
      message.error('投递失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Card style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
          <Result
            status="success"
            title="投递成功！"
            subTitle="我们将在3个工作日内完成初筛，请留意手机或邮箱通知"
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '40px 16px' }}>
      <Card style={{ maxWidth: 600, margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        {jobInfo && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Title level={3} style={{ marginBottom: 8 }}>{jobInfo.title}</Title>
              <Space size="large">
                <Text type="secondary">{jobInfo.location}</Text>
                {jobInfo.salary_range && <Text type="secondary">{jobInfo.salary_range}</Text>}
              </Space>
            </div>
            {jobInfo.description && (
              <>
                <div dangerouslySetInnerHTML={{ __html: jobInfo.description }} style={{ padding: '0 8px', color: '#666', marginBottom: 16 }} />
                <Divider />
              </>
            )}
          </>
        )}
        <Title level={4}>填写投递信息</Title>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }, { min: 2, max: 20, message: '姓名长度为2-20字符' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '手机号格式不正确' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="employment_status" label="在职状态" rules={[{ required: true, message: '请选择在职状态' }]}>
            <Select options={employmentOptions} />
          </Form.Item>
          <Form.Item name="expected_salary" label="期望薪资">
            <Input />
          </Form.Item>
          <Form.Item name="additional_message" label="附加留言">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          <Form.Item
            name="resume"
            label="简历文件"
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              if (e && Array.isArray(e.fileList)) {
                return e.fileList;
              }
              return [];
            }}
            rules={[{ required: true, message: '请上传简历' }]}
          >
            <Dragger accept=".pdf,.doc,.docx" maxCount={1} beforeUpload={() => false}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">支持 PDF、DOC、DOCX 格式，最大 10MB</p>
            </Dragger>
          </Form.Item>
          {captchaImage && (
            <Form.Item name="captcha_code" label="验证码" rules={[{ required: true, message: '请输入验证码' }]}>
              <Space>
                <Input style={{ width: 150 }} />
                <img src={captchaImage} alt="验证码" style={{ height: 40, cursor: 'pointer' }} onClick={loadCaptcha} />
              </Space>
            </Form.Item>
          )}
          <Form.Item name="privacy_agreed" valuePropName="checked" rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject(new Error('请同意隐私协议')) }]}>
            <Checkbox>我已阅读并同意隐私协议</Checkbox>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block size="large">
              提交投递
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Apply;
