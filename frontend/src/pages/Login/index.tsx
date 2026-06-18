import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined, RobotOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface LoginFormValues {
  username: string;
  password: string;
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card
        style={{ width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
        title={
          <div style={{ textAlign: 'center', fontSize: 20 }}>
            <RobotOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            HR智能招聘平台
          </div>
        }
      >
        <Form onFinish={onFinish} size="large" initialValues={{ username: '', password: '' }}>
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
