import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Input, Select, Space, Modal, Form, message,
  Typography, Popconfirm, Tag, Row, Col, Card,
} from 'antd';
import { PlusOutlined, SearchOutlined, CopyOutlined, LinkOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Job, JobFormData, JobStatus, HardRequirements } from '@/types';
import { getJobsApi, createJobApi, updateJobApi, deleteJobApi, updateJobStatusApi } from '@/api/jobs';
import StatusTag from '@/components/StatusTag';

const { Title } = Typography;
const { TextArea } = Input;

const statusOptions: { label: string; value: JobStatus }[] = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已暂停', value: 'paused' },
  { label: '已关闭', value: 'closed' },
];

const categoryOptions = [
  '技术研发', '产品设计', '市场营销', '人力资源', '财务', '运营', '其他',
];

const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getJobsApi({ page, page_size: pageSize, status: statusFilter as JobStatus, keyword });
      setJobs(res.data.data.items || []);
      setTotal(res.data.data.total || 0);
    } catch (error) {
      console.error('加载职位数据失败:', error);
      setJobs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearch = () => { setPage(1); loadData(); };

  const handleAdd = () => {
    setEditingJob(null);
    form.resetFields();
    form.setFieldValue('status', 'draft');
    setModalOpen(true);
  };

  const handleEdit = (record: Job) => {
    setEditingJob(record);
    form.setFieldsValue({
      title: record.title,
      category: record.category,
      location: record.location,
      salary_range: record.salary_range,
      description: record.description,
      hard_requirements: record.hard_requirements,
      status: record.status,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteJobApi(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败，请重试');
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updateJobStatusApi(id, status);
      message.success('状态更新成功');
      loadData();
    } catch {
      message.error('状态更新失败，请重试');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data: JobFormData = {
        ...values,
        hard_requirements: values.hard_requirements ? JSON.parse(values.hard_requirements) : undefined,
      };
      if (editingJob) {
        await updateJobApi(editingJob.id, data);
        message.success('更新成功');
      } else {
        await createJobApi(data);
        message.success('创建成功');
      }
      setModalOpen(false);
      loadData();
    } catch (error: any) {
      // 表单验证错误不需要额外提示
      if (error?.errorFields) {
        return;
      }
      console.error('保存失败:', error);
      message.error(editingJob ? '更新失败，请重试' : '创建失败，请重试');
    }
  };

  const copyApplyLink = (token: string) => {
    const url = `${window.location.origin}/apply/${token}`;
    navigator.clipboard?.writeText(url);
    message.success('投递链接已复制');
  };

  const columns: ColumnsType<Job> = [
    { title: '职位名称', dataIndex: 'title', key: 'title', width: 180, ellipsis: true },
    { title: '类别', dataIndex: 'category', key: 'category', width: 100 },
    { title: '工作地点', dataIndex: 'location', key: 'location', width: 100 },
    { title: '薪资范围', dataIndex: 'salary_range', key: 'salary_range', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => <StatusTag status={v} type="job" />,
    },
    { title: '投递数', dataIndex: 'resume_count', key: 'resume_count', width: 70, align: 'center' },
    {
      title: '投递链接',
      dataIndex: 'apply_token',
      key: 'apply_token',
      width: 100,
      render: (v: string) => (
        <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => copyApplyLink(v)}>
          复制
        </Button>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <Space wrap>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          {record.status !== 'published' && (
            <Select
              size="small"
              style={{ width: 80 }}
              value={record.status}
              options={statusOptions}
              onChange={(v) => handleStatusChange(record.id, v)}
            />
          )}
          {record.status === 'published' && (
            <Popconfirm title="确认暂停该职位？" onConfirm={() => handleStatusChange(record.id, 'paused')}>
              <Button type="link" size="small">暂停</Button>
            </Popconfirm>
          )}
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>职位管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建职位</Button>
      </div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Input
            placeholder="搜索职位名称"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
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
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={statusOptions}
          />
        </Col>
        <Col span={4}>
          <Button type="primary" onClick={handleSearch} block>搜索</Button>
        </Col>
      </Row>
      <Card>
        <Table
          columns={columns}
          dataSource={jobs}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
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
      <Modal
        title={editingJob ? '编辑职位' : '新建职位'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="职位名称" rules={[{ required: true, message: '请输入职位名称' }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="职位类别" rules={[{ required: true, message: '请选择类别' }]}>
                <Select options={categoryOptions.map((c) => ({ label: c, value: c }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label="工作地点" rules={[{ required: true, message: '请输入工作地点' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="salary_range" label="薪资范围">
            <Input placeholder="如：20k-35k" />
          </Form.Item>
          <Form.Item name="description" label="职位描述" rules={[{ required: true, message: '请输入职位描述' }]}>
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item name="hard_requirements" label="硬性要求（JSON格式）">
            <TextArea rows={3} placeholder='{"min_education":"本科","min_years":3,"required_skills":["Python"]}' />
          </Form.Item>
          {!editingJob && (
            <Form.Item name="status" label="状态">
              <Select options={statusOptions} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default Jobs;
