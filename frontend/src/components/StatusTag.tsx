import React from 'react';
import { Tag } from 'antd';

type StatusType = 'job' | 'resume' | 'parse' | 'interview' | 'task' | 'score';

interface StatusTagProps {
  status: string;
  type: StatusType;
}

const statusMap: Record<StatusType, Record<string, { color: string; text: string }>> = {
  job: {
    draft: { color: 'default', text: '草稿' },
    published: { color: 'success', text: '已发布' },
    paused: { color: 'warning', text: '已暂停' },
    closed: { color: 'error', text: '已关闭' },
  },
  resume: {
    new: { color: 'processing', text: '新投递' },
    rejected: { color: 'error', text: '已淘汰' },
    pending: { color: 'warning', text: '待定' },
    interview: { color: 'success', text: '进入面试' },
  },
  parse: {
    pending: { color: 'default', text: '待识别' },
    parsing: { color: 'processing', text: '识别中' },
    success: { color: 'success', text: '识别成功' },
    failed: { color: 'error', text: '识别失败' },
  },
  interview: {
    pending: { color: 'default', text: '待生成' },
    success: { color: 'success', text: '已生成' },
    failed: { color: 'error', text: '生成失败' },
  },
  task: {
    pending: { color: 'default', text: '排队中' },
    running: { color: 'processing', text: '执行中' },
    success: { color: 'success', text: '成功' },
    failed: { color: 'error', text: '失败' },
  },
  score: {
    pending: { color: 'default', text: '待打分' },
    scoring: { color: 'processing', text: '打分中' },
    success: { color: 'success', text: '已生成' },
    failed: { color: 'error', text: '打分失败' },
  },
};

const StatusTag: React.FC<StatusTagProps> = ({ status, type }) => {
  const config = statusMap[type]?.[status] || { color: 'default', text: status };
  return <Tag color={config.color}>{config.text}</Tag>;
};

export default StatusTag;
