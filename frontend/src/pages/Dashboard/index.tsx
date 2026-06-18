import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Typography, Space } from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  SyncOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { Resume } from '@/types';
import { getResumesApi } from '@/api/resumes';
import { getJobsApi } from '@/api/jobs';
import StatusTag from '@/components/StatusTag';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  const [activeJobs, setActiveJobs] = useState(0);
  const [recentResumes, setRecentResumes] = useState<Resume[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [interviewCount, setInterviewCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsRes, resumesRes, pendingRes, interviewRes] = await Promise.all([
        getJobsApi({ page: 1, page_size: 100, status: 'published' }),
        getResumesApi({ page: 1, page_size: 5 }),
        getResumesApi({ page: 1, page_size: 1, status: 'new' }),
        getResumesApi({ page: 1, page_size: 1, status: 'interview' }),
      ]);
      setActiveJobs(jobsRes.data.data.total || 0);
      setRecentResumes(resumesRes.data.data.items || []);
      setPendingCount(pendingRes.data.data.total || 0);
      setInterviewCount(interviewRes.data.data.total || 0);
    } catch (error) {
      console.error('加载数据失败:', error);
      setActiveJobs(0);
      setRecentResumes([]);
      setPendingCount(0);
      setInterviewCount(0);
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<Resume> = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '应聘职位', dataIndex: 'job_title', key: 'job_title' },
    { title: '初筛得分', dataIndex: 'score', key: 'score', render: (v: number) => v ?? '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <StatusTag status={v} type="resume" />,
    },
    {
      title: '投递时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>数据概览</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="在招职位" value={activeJobs} prefix={<TeamOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="今日投递" value={recentResumes.length} prefix={<FileTextOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="待处理简历" value={pendingCount} prefix={<SyncOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="面试中" value={interviewCount} prefix={<QuestionCircleOutlined />} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>
      <Card title="最近投递">
        <Table
          columns={columns}
          dataSource={recentResumes}
          rowKey="id"
          pagination={false}
          loading={loading}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
