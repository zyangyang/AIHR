import React, { useEffect, useState, useCallback } from 'react';
import { Table, Input, Select, Button, Space, Row, Col, Typography, Card } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import type { Resume, ResumeStatus, ParseStatus, Job } from '@/types';
import { getResumesApi } from '@/api/resumes';
import { getJobsApi } from '@/api/jobs';
import StatusTag from '@/components/StatusTag';
import dayjs from 'dayjs';

const { Title } = Typography;

const statusOptions: { label: string; value: ResumeStatus }[] = [
  { label: '新投递', value: 'new' },
  { label: '已淘汰', value: 'rejected' },
  { label: '待定', value: 'pending' },
  { label: '进入面试', value: 'interview' },
];

const parseStatusOptions: { label: string; value: ParseStatus }[] = [
  { label: '待识别', value: 'pending' },
  { label: '识别中', value: 'parsing' },
  { label: '识别成功', value: 'success' },
  { label: '识别失败', value: 'failed' },
];

const Resumes: React.FC = () => {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [parseStatusFilter, setParseStatusFilter] = useState<string | undefined>(undefined);
  const [jobFilter, setJobFilter] = useState<number | undefined>(undefined);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobSearch, setJobSearch] = useState('');

  const loadJobs = useCallback(async (search?: string) => {
    try {
      const res = await getJobsApi({ page: 1, page_size: 20, keyword: search });
      setJobs(res.data.data.items || []);
    } catch {
      setJobs([]);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getResumesApi({
        page, page_size: pageSize,
        status: statusFilter as ResumeStatus,
        parse_status: parseStatusFilter as ParseStatus,
        keyword, job_id: jobFilter,
      });
      setResumes(res.data.data.items || []);
      setTotal(res.data.data.total || 0);
    } catch {
      setResumes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter, parseStatusFilter, jobFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearch = () => { setPage(1); loadData(); };

  const handleJobSearch = (value: string) => {
    setJobSearch(value);
    loadJobs(value);
  };

  const columns: ColumnsType<Resume> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      render: (v: string) => v || <span style={{ color: '#999' }}>待解析</span>,
    },
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 130, render: (v: string) => v || '-' },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: 200, ellipsis: true, render: (v: string) => v || '-' },
    { title: '应聘职位', dataIndex: 'job_title', key: 'job_title', width: 150, ellipsis: true },
    {
      title: '简历状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <StatusTag status={v} type="resume" />,
    },
    {
      title: '解析状态',
      dataIndex: 'parse_status',
      key: 'parse_status',
      width: 100,
      render: (v: string) => <StatusTag status={v} type="parse" />,
    },
    {
      title: '初筛状态',
      dataIndex: 'score_status',
      key: 'score_status',
      width: 100,
      render: (v: string) => <StatusTag status={v || 'pending'} type="score" />,
    },
    {
      title: '面试题状态',
      dataIndex: 'interview_status',
      key: 'interview_status',
      width: 110,
      render: (v: string) => <StatusTag status={v || 'pending'} type="interview" />,
    },
    { title: '初筛得分', dataIndex: 'score', key: 'score', width: 100, align: 'center' },
    {
      title: '投递时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => navigate(`/resumes/${record.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>简历管理</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/resumes/import')}>导入简历</Button>
        </Space>
      </div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={5}>
          <Input
            placeholder="搜索姓名/手机号/邮箱"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
            allowClear
          />
        </Col>
        <Col span={4}>
          <Select
            placeholder="应聘岗位"
            style={{ width: '100%' }}
            allowClear
            showSearch
            filterOption={false}
            value={jobFilter}
            onSearch={handleJobSearch}
            onChange={(v) => { setJobFilter(v); setPage(1); }}
            options={jobs.map((j) => ({ label: j.title, value: j.id }))}
          />
        </Col>
        <Col span={4}>
          <Select
            placeholder="简历状态"
            style={{ width: '100%' }}
            allowClear
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={statusOptions}
          />
        </Col>
        <Col span={4}>
          <Select
            placeholder="解析状态"
            style={{ width: '100%' }}
            allowClear
            value={parseStatusFilter}
            onChange={(v) => { setParseStatusFilter(v); setPage(1); }}
            options={parseStatusOptions}
          />
        </Col>
        <Col span={3}>
          <Button type="primary" onClick={handleSearch} block>搜索</Button>
        </Col>
      </Row>
      <Card>
        <Table
          columns={columns}
          dataSource={resumes}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1350 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </Card>
    </div>
  );
};

export default Resumes;
