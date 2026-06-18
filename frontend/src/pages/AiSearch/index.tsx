import React, { useEffect, useState, useCallback } from 'react';
import { Input, Button, Space, Typography, Card, List, Tag, Progress, message, Empty } from 'antd';
import { SearchOutlined, RobotOutlined, ThunderboltOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { AiSearchResultItem, IndexStatus, EmbeddingConfig } from '@/types';
import { aiSearchResumesApi, buildAiSearchIndexApi, getAiSearchIndexStatusApi, getEmbeddingConfigApi } from '@/api/resumes';

const { Title, Text } = Typography;
const { TextArea } = Input;

const AiSearch: React.FC = () => {
  const navigate = useNavigate();
  const [aiQuery, setAiQuery] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState<AiSearchResultItem[]>([]);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);
  const [indexBuilding, setIndexBuilding] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfig | null>(null);

  const loadIndexStatus = useCallback(async () => {
    try {
      const res = await getAiSearchIndexStatusApi();
      setIndexStatus(res.data.data);
    } catch {
      setIndexStatus(null);
    }
  }, []);

  const loadEmbeddingConfig = useCallback(async () => {
    try {
      const res = await getEmbeddingConfigApi();
      setEmbeddingConfig(res.data.data);
    } catch {
      setEmbeddingConfig(null);
    }
  }, []);

  useEffect(() => { loadIndexStatus(); loadEmbeddingConfig(); }, [loadIndexStatus, loadEmbeddingConfig]);

  const handleAiSearch = async () => {
    if (!aiQuery.trim()) {
      message.warning('请输入搜索内容');
      return;
    }
    setAiSearching(true);
    setHasSearched(true);
    try {
      const res = await aiSearchResumesApi(aiQuery, 20);
      setAiResults(res.data.data.items || []);
    } catch {
      message.error('AI 搜索失败，请检查索引是否已构建');
      setAiResults([]);
    } finally {
      setAiSearching(false);
    }
  };

  const handleBuildIndex = async () => {
    setIndexBuilding(true);
    try {
      const res = await buildAiSearchIndexApi();
      message.success(res.data.message || '索引构建完成');
      await loadIndexStatus();
    } catch {
      message.error('构建索引失败');
    } finally {
      setIndexBuilding(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return '#52c41a';
    if (score >= 0.6) return '#1890ff';
    if (score >= 0.4) return '#faad14';
    return '#ff4d4f';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>AI搜索简历</Title>
        <Space size="small">
          {embeddingConfig?.configured && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              <RobotOutlined /> {embeddingConfig.model_name}
              {embeddingConfig.source === 'env' && <Tag color="orange" style={{ marginLeft: 4, fontSize: 11 }}>.env</Tag>}
            </Text>
          )}
          {indexStatus && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              <DatabaseOutlined /> 已索引 {indexStatus.indexed_count}/{indexStatus.total_count}
            </Text>
          )}
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            loading={indexBuilding}
            onClick={handleBuildIndex}
          >
            构建索引
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          用自然语言描述您要查找的候选人特征
        </Text>
        <TextArea
          rows={3}
          placeholder="例如：有3年以上AI产品经验、熟悉大模型的候选人"
          value={aiQuery}
          onChange={(e) => setAiQuery(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleAiSearch();
            }
          }}
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          loading={aiSearching}
          onClick={handleAiSearch}
          style={{ marginTop: 8 }}
          block
        >
          AI 搜索
        </Button>
      </Card>

      {aiResults.length > 0 && (
        <Card title={`搜索结果（${aiResults.length} 条）`}>
          <List
            dataSource={aiResults}
            renderItem={(item) => (
              <List.Item
                style={{ cursor: 'pointer', padding: '12px 16px' }}
                onClick={() => navigate(`/resumes/${item.resume.id}`)}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{item.resume.name || '待解析'}</span>
                      <Tag color={getScoreColor(item.score)}>
                        匹配度 {Math.round(item.score * 100)}%
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space size="large" style={{ color: '#666' }}>
                      <span>{item.resume.phone || '-'}</span>
                      <span>{item.resume.email || '-'}</span>
                      <span>{item.resume.job_title || '-'}</span>
                      {item.resume.score !== undefined && item.resume.score !== null && (
                        <span>初筛得分: {item.resume.score}</span>
                      )}
                    </Space>
                  }
                />
                <div style={{ minWidth: 100 }}>
                  <Progress
                    percent={Math.round(item.score * 100)}
                    size="small"
                    strokeColor={getScoreColor(item.score)}
                    format={() => ''}
                  />
                </div>
              </List.Item>
            )}
          />
        </Card>
      )}

      {aiResults.length === 0 && hasSearched && !aiSearching && (
        <Card>
          <Empty description="未找到匹配的简历" />
        </Card>
      )}

      {!hasSearched && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <div>输入搜索条件，AI 将为您智能匹配简历</div>
            {indexStatus && indexStatus.indexed_count === 0 && (
              <div style={{ marginTop: 8 }}>
                <Text type="warning">尚未构建索引，请先点击"构建索引"按钮</Text>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AiSearch;
