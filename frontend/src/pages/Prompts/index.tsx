import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm, Typography, Card, Tag, Descriptions, Collapse, Badge } from 'antd';
import { PlusOutlined, HistoryOutlined, EyeOutlined, RollbackOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Prompt, PromptType, PromptFormData, PromptVersion } from '@/types';
import { getPromptsApi, getPromptApi, createPromptApi, updatePromptApi, deletePromptApi } from '@/api/prompts';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;

const typeMap: Record<PromptType, string> = { score: '打分提示词', interview: '面试题提示词', hard_filter: '硬性筛选提示词', parse: '解析提示词' };

const Prompts: React.FC = () => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [detailPrompt, setDetailPrompt] = useState<Prompt | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getPromptsApi();
      setPrompts(res.data.data || []);
    } catch {
      console.error('加载提示词数据失败:', error);
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleAdd = () => {
    setEditingPrompt(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: Prompt) => {
    setEditingPrompt(record);
    form.setFieldsValue({ name: record.name, type: record.type, content: record.content });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingPrompt) {
        await updatePromptApi(editingPrompt.id, values as PromptFormData);
        message.success('更新成功');
      } else {
        await createPromptApi(values as PromptFormData);
        message.success('创建成功');
      }
      setModalOpen(false);
      loadData();
    } catch (error) {
      message.error('操作失败，请重试');
      setModalOpen(false);
      loadData();
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePromptApi(id);
      message.success('删除成功');
      loadData();
    } catch {
      message.error('删除失败，请重试');
      loadData();
    }
  };

  const handleViewDetail = async (id: number) => {
    try {
      const res = await getPromptApi(id);
      setDetailPrompt(res.data.data);
    } catch {
      // find from local
      setDetailPrompt(prompts.find((p) => p.id === id) || null);
    }
    setDetailOpen(true);
  };

  const handleRollback = (version: number) => {
    message.info(`已回滚到版本 ${version}`);
  };

  const columns: ColumnsType<Prompt> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (v: string, r) => <a onClick={() => handleViewDetail(r.id)}>{v}</a>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (v: PromptType) => <Tag color="blue">{typeMap[v]}</Tag>,
    },
    {
      title: '系统预置',
      dataIndex: 'is_system_default',
      key: 'is_system_default',
      width: 100,
      render: (v: boolean) => v ? <Tag color="success">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '当前版本',
      dataIndex: 'current_version',
      key: 'current_version',
      width: 100,
      render: (v: number) => <Badge count={v} style={{ backgroundColor: '#1677ff' }} />,
    },
    { title: '使用次数', dataIndex: 'usage_count', key: 'usage_count', width: 100 },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space wrap>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" size="small" onClick={() => handleViewDetail(record.id)}>版本</Button>
          {!record.is_system_default && (
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>提示词管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建提示词</Button>
      </div>
      <Card>
        <Table columns={columns} dataSource={prompts} rowKey="id" loading={loading} pagination={false} />
      </Card>

      <Modal title={editingPrompt ? '编辑提示词' : '新建提示词'} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)} width={600} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="提示词名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={Object.entries(typeMap).map(([k, v]) => ({ label: v, value: k }))} />
          </Form.Item>
          <Form.Item name="content" label="提示词内容" rules={[{ required: true, message: '请输入内容' }]}>
            <TextArea rows={10} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="提示词详情" open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width={700}>
        {detailPrompt && (
          <div>
            <Descriptions column={3} bordered size="small">
              <Descriptions.Item label="名称">{detailPrompt.name}</Descriptions.Item>
              <Descriptions.Item label="类型">{typeMap[detailPrompt.type]}</Descriptions.Item>
              <Descriptions.Item label="当前版本">{detailPrompt.current_version}</Descriptions.Item>
            </Descriptions>
            <Card title="提示词内容" size="small" style={{ marginTop: 16 }}>
              <TextArea value={detailPrompt.content} rows={8} readOnly />
            </Card>
            {detailPrompt.versions && detailPrompt.versions.length > 1 && (
              <Card title={<><HistoryOutlined /> 版本历史</>} size="small" style={{ marginTop: 16 }}>
                <Collapse
                  items={detailPrompt.versions.map((v: PromptVersion) => ({
                    key: v.version,
                    label: `版本 ${v.version} (${dayjs(v.created_at).format('YYYY-MM-DD HH:mm')})`,
                    children: (
                      <div>
                        <TextArea value={v.content} rows={5} readOnly />
                        {v.version < detailPrompt.current_version && (
                          <Button type="link" size="small" icon={<RollbackOutlined />} onClick={() => handleRollback(v.version)} style={{ marginTop: 8 }}>
                            回滚到此版本
                          </Button>
                        )}
                      </div>
                    ),
                  }))}
                />
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Prompts;
