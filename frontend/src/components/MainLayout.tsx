import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  SettingOutlined,
  BulbOutlined,
  RobotOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';

const { Sider, Content, Header } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '数据概览' },
  { key: '/jobs', icon: <TeamOutlined />, label: '职位管理' },
  { key: '/resumes', icon: <FileTextOutlined />, label: '简历管理' },
  { key: '/ai-search', icon: <RobotOutlined />, label: 'AI搜索简历' },
  { key: '/prompts', icon: <BulbOutlined />, label: '提示词管理' },
  { key: '/llm-configs', icon: <SettingOutlined />, label: '大模型管理' },
];

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark">
        <div style={{ height: 32, margin: 16, color: '#fff', fontSize: collapsed ? 14 : 16, fontWeight: 'bold', textAlign: 'center', lineHeight: '32px' }}>
          {collapsed ? 'HR-AI' : 'HR智能招聘平台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} />
              <Text>管理员</Text>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
