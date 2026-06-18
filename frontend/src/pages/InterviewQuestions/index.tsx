import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Card, Typography, message, Select, Tag } from 'antd';
import { DownloadOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { InterviewRecord } from '@/types';
import { getInterviewsApi, generateInterviewApi, downloadInterviewPdfApi, downloadInterviewDocxApi } from '@/api/interviews';
import StatusTag from '@/components/StatusTag';
import dayjs from 'dayjs';

const { Title } = Typography;

const InterviewQuestions: React.FC = () => {
  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getInterviewsApi({ page, page_size: pageSize, status: statusFilter });
      setRecords(res.data.data.items || []);
      setTotal(res.data.data.total || 0);
    } catch (error) {
      console.error('加载面试题数据失败:', error);
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page, statusFilter]);

  const handleGenerate = async (resumeId: number) => {
    try {
      await generateInterviewApi(resumeId, {});
      message.success('生成任务已提交');
      loadData();
    } catch (error) {
      console.error('生成失败:', error);
      message.error('提交失败，请重试');
    }
  };

  const handleDownload = async (resumeId: number, format: 'pdf' | 'docx') => {
    try {
      const apiFn = format === 'pdf' ? downloadInterviewPdfApi : downloadInterviewDocxApi;
      const res = await apiFn(resumeId);
      
      // 从响应头中提取文件名
      const disposition = res.headers['content-disposition'];
      let filename = `面试题.${format}`;
      if (disposition) {
        // 匹配 filename*=UTF-8''xxx 或 filename="xxx" 格式
        const match = disposition.match(/filename\*?=([^;]+)/);
        if (match) {
          let raw = match[1].trim();
          // 去掉 UTF-8'' 前缀
          raw = raw.replace(/^(?:UTF-8|utf-8)''/i, '');
          // 去掉引号
          raw = raw.replace(/^["']|["']$/g, '');
          // URL解码
          filename = decodeURIComponent(raw);
        }
      }
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
      message.error('下载失败');
    }
  };

  const handlePreview = (_record: InterviewRecord) => {
    message.info('预览功能待实现');
  };

  const columns: ColumnsType<InterviewRecord> = [
    { title: '应聘职位', dataIndex: 'job_title', key: 'job_title', width: 150, ellipsis: true },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: 200, ellipsis: true },
    { title: '初筛得分', dataIndex: 'score', key: 'score', width: 100, align: 'center', render: (v) => v ?? '-' },
    {
      title: '生成状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <StatusTag status={v} type="interview" />,
    },
    {
      title: '生成时间',
      dataIndex: 'generated_at',
      key: 'generated_at',
      width: 180,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <Space wrap>
          {record.status === 'pending' && (
            <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleGenerate(record.resume_id)}>
              生成
            </Button>
          )}
          {record.status === 'success' && (
            <>
              <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record)}>
                预览
              </Button>
              <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record.resume_id, 'pdf')}>
                PDF
              </Button>
              <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record.resume_id, 'docx')}>
                Word
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>面试题管理</Title>
      </div>
      <Space style={{ marginBottom: 16 }}>
        <span>状态筛选：</span>
        <Select
          style={{ width: 150 }}
          allowClear
          placeholder="全部"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: '待生成', value: 'pending' },
            { label: '已生成', value: 'success' },
            { label: '生成失败', value: 'failed' },
          ]}
        />
      </Space>
      <Card>
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1100 }}
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

export default InterviewQuestions;
