import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Switch, Space, message, Popconfirm, Typography, Card, Descriptions, Statistic, Row, Col, Tag, Select, DatePicker } from 'antd';
import { PlusOutlined, LineChartOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { LLMConfig, LLMConfigFormData, TokenUsageByFunction, TokenUsageByDay } from '@/types';
import { getLLMConfigsApi, createLLMConfigApi, updateLLMConfigApi, deleteLLMConfigApi, getTokenUsageApi } from '@/api/llmConfigs';
import dayjs from 'dayjs';

const { Title } = Typography;

const providerOptions = [
  { label: '硅基流动', value: 'silicon_flow' },
  { label: 'OpenAI', value: 'openai' },
  { label: '自定义', value: 'custom' },
];

const configTypeOptions = [
  { label: '对话模型', value: 'chat' },
  { label: '嵌入模型', value: 'embedding' },
];

const LLMConfigs: React.FC = () => {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null);
  const [form] = Form.useForm();
  const [tokenUsage, setTokenUsage] = useState<{
    total_tokens: number;
    total_cost: number;
    by_function: TokenUsageByFunction[];
    by_day: TokenUsageByDay[];
  } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageRange, setUsageRange] = useState('today');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getLLMConfigsApi();
      setConfigs(res.data.data || []);
    } catch (error) {
      console.error('加载配置失败:', error);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleAdd = () => {
    setEditingConfig(null);
    form.resetFields();
    form.setFieldValue('is_active', true);
    form.setFieldValue('config_type', 'chat');
    form.setFieldValue('price_per_million_tokens', 10);
    setModalOpen(true);
  };

  const handleEdit = (record: LLMConfig) => {
    setEditingConfig(record);
    form.setFieldsValue({
      name: record.name,
      provider: record.provider,
      model_name: record.model_name,
      base_url: record.base_url,
      price_per_million_tokens: record.price_per_million_tokens,
      is_active: record.is_active,
      config_type: record.config_type || 'chat',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingConfig) {
        await updateLLMConfigApi(editingConfig.id, values as LLMConfigFormData);
        message.success('更新成功');
      } else {
        await createLLMConfigApi(values as LLMConfigFormData);
        message.success('创建成功');
      }
      setModalOpen(false);
      loadData();
    } catch (error: any) {
      // 如果是表单验证错误，不显示错误消息（antd 会自动处理）
      if (error?.errorFields) {
        return;
      }
      message.error('操作失败，请重试');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteLLMConfigApi(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败，请重试');
    }
  };

  const loadTokenUsage = async () => {
    setUsageLoading(true);
    try {
      let startDate: string | undefined;
      let endDate: string | undefined;
      const today = dayjs().format('YYYY-MM-DD');
      if (usageRange === 'today') {
        startDate = today;
        endDate = today;
      } else if (usageRange === 'month') {
        startDate = dayjs().startOf('month').format('YYYY-MM-DD');
        endDate = today;
      }
      const res = await getTokenUsageApi(startDate, endDate);
      setTokenUsage(res.data.data);
    } catch (error) {
      console.error('加载Token统计失败:', error);
      setTokenUsage(null);
      message.error('加载统计数据失败');
    } finally {
      setUsageLoading(false);
    }
  };

  const handleShowUsage = () => {
    setUsageModalOpen(true);
    loadTokenUsage();
  };

  const columns: ColumnsType<LLMConfig> = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '提供商', dataIndex: 'provider', key: 'provider', width: 120 },
    { title: '模型名称', dataIndex: 'model_name', key: 'model_name', width: 120 },
    {
      title: '类型',
      dataIndex: 'config_type',
      key: 'config_type',
      width: 100,
      render: (v: string) => v === 'embedding'
        ? <Tag color="green">嵌入模型</Tag>
        : <Tag color="blue">对话模型</Tag>,
    },
    { title: 'Base URL', dataIndex: 'base_url', key: 'base_url', width: 250, ellipsis: true },
    { title: '价格(百万Token)', dataIndex: 'price_per_million_tokens', key: 'price_per_million_tokens', width: 130, render: (v: number) => `¥${v.toFixed(2)}` },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (v: boolean) => v ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
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
        <Title level={4} style={{ margin: 0 }}>大模型管理</Title>
        <Space>
          <Button icon={<LineChartOutlined />} onClick={handleShowUsage}>Token统计</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建配置</Button>
        </Space>
      </div>
      <Card>
        <Table columns={columns} dataSource={configs} rowKey="id" loading={loading} pagination={false} />
      </Card>

      <Modal title={editingConfig ? '编辑配置' : '新建配置'} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)} width={500} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="配置名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="config_type" label="配置类型" rules={[{ required: true, message: '请选择配置类型' }]}>
            <Select options={configTypeOptions} />
          </Form.Item>
          <Form.Item name="provider" label="提供商" rules={[{ required: true, message: '请选择提供商' }]}>
            <Select options={providerOptions} />
          </Form.Item>
          <Form.Item name="model_name" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="api_key" label="API密钥" rules={[{ required: !editingConfig, message: '请输入API密钥' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="base_url" label="Base URL" rules={[{ required: true, message: '请输入Base URL' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="price_per_million_tokens" label="价格（每百万Token，元）" rules={[{ required: true, message: '请输入价格' }]}>
            <Input type="number" step="0.01" />
          </Form.Item>
          <Form.Item name="is_active" label="是否启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Token消耗统计" open={usageModalOpen} onCancel={() => setUsageModalOpen(false)} footer={null} width={700}>
        <Space style={{ marginBottom: 16 }}>
          <span>时间范围：</span>
          <Select value={usageRange} onChange={(v) => { setUsageRange(v); }} style={{ width: 120 }} options={[
            { label: '今日', value: 'today' },
            { label: '本月', value: 'month' },
          ]} />
          <Button type="primary" onClick={loadTokenUsage} loading={usageLoading}>查询</Button>
        </Space>
        {tokenUsage && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card>
                  <Statistic title="总Token消耗" value={tokenUsage.total_tokens.toLocaleString()} suffix="tokens" />
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Statistic title="预估费用" value={tokenUsage.total_cost} prefix="¥" precision={2} />
                </Card>
              </Col>
            </Row>
            <Card title="按功能模块" size="small">
              <Table
                dataSource={tokenUsage.by_function}
                rowKey="function_type"
                pagination={false}
                size="small"
                columns={[
                  { title: '功能', dataIndex: 'function_type', render: (v: string) => ({ parse: '简历识别', score: 'AI打分', interview: '面试题生成' }[v] || v) },
                  { title: 'Token消耗', dataIndex: 'tokens', render: (v: number) => v.toLocaleString() },
                  { title: '费用', dataIndex: 'cost', render: (v: number) => `¥${v.toFixed(2)}` },
                ]}
              />
            </Card>
            <Card title="按日期" size="small" style={{ marginTop: 16 }}>
              <Table
                dataSource={tokenUsage.by_day}
                rowKey="date"
                pagination={false}
                size="small"
                columns={[
                  { title: '日期', dataIndex: 'date' },
                  { title: 'Token消耗', dataIndex: 'tokens', render: (v: number) => v.toLocaleString() },
                  { title: '费用', dataIndex: 'cost', render: (v: number) => `¥${v.toFixed(2)}` },
                ]}
              />
            </Card>
          </>
        )}
      </Modal>
    </div>
  );
};

export default LLMConfigs;
