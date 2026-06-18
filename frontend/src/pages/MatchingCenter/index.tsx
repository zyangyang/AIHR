import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, Row, Col, Card, Typography, message, Popconfirm } from 'antd';
import { SearchOutlined, SyncOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Resume } from '@/types';
import { getResumesApi, updateResumeStatusApi } from '@/api/resumes';
import { triggerParseApi } from '@/api/matching';
import StatusTag from '@/components/StatusTag';
import dayjs from 'dayjs';

const { Title } = Typography;

const statusOptions = [
  { label: '全部', value: '' },
  { label: '新投递', value: 'new' },
  { label: '待处理', value: 'pending' },
  { label: '已进入面试', value: 'interview' },
  { label: '已淘汰', value: 'rejected' },
];

const MatchingCenter: React.FC = () => {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = { page, page_size: pageSize };
      if (keyword) params.keyword = keyword;
      if (statusFilter) params.status = statusFilter;
      const res = await getResumesApi(params as any);
      setResumes(res.data.data.items || []);
      setTotal(res.data.data.total || 0);
    } catch (error) {
      console.error('加载匹配数据失败:', error);
      setResumes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page, keyword, statusFilter]);

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updateResumeStatusApi(id, { status: status as any });
      message.success('操作成功');
      loadData();
    } catch (error) {
      message.error('操作失败，请重试');
      loadData();
    }
  };

  const handleReparse = async (id: number) => {
    try {
      await triggerParseApi(id);
      message.info('识别任务已提交');
      loadData();
    } catch {
      message.error('提交任务失败');
    }
  };

  const columns: ColumnsType<Resume> = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '应聘职位', dataIndex: 'job_title', key: 'job_title', width: 150, ellipsis: true },
    {
      title: '解析状态',
      dataIndex: 'parse_status',
      key: 'parse_status',
      width: 100,
      render: (v: string) => <StatusTag status={v} type="parse" />,
    },
    { title: '初筛得分', dataIndex: 'score', key: 'score', width: 100, align: 'center' },
    {
      title: '简历状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <StatusTag status={v} type="resume" />,
    },
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
      width: 250,
      render: (_, record) => (
        <Space wrap>
          <Button type="link" size="small" onClick={() => window.location.href = `/resumes/${record.id}`}>
            详情
          </Button>
          {record.parse_status === 'success' && record.status === 'new' && (
            <>
              <Popconfirm title="确认淘汰？" onConfirm={() => handleStatusChange(record.id, 'rejected')}>
                <Button type="link" size="small" danger>淘汰</Button>
              </Popconfirm>
              <Button type="link" size="small" onClick={() => handleStatusChange(record.id, 'pending')}>待定</Button>
              <Button type="link" size="small" onClick={() => handleStatusChange(record.id, 'interview')}>进入面试</Button>
            </>
          )}
          {record.parse_status === 'pending' && (
            <Button type="link" size="small" icon={<SyncOutlined />} onClick={() => handleReparse(record.id)}>
              触发识别
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>匹配处理中心</Title>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Input
            placeholder="搜索姓名/邮箱"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            prefix={<SearchOutlined />}
            allowClear
          />
        </Col>
        <Col span={4}>
          <Select
            placeholder="状态筛选"
            style={{ width: '100%' }}
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
          />
        </Col>
        <Col span={4}>
          <Button type="primary" onClick={loadData} block>刷新</Button>
        </Col>
      </Row>
      <Card>
        <Table
          columns={columns}
          dataSource={resumes}
          rowKey="id"
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: setPage,
          }}
        />
      </Card>
    </div>
  );
};

export default MatchingCenter;
