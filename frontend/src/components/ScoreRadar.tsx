import React from 'react';
import { Card, Progress, Row, Col, Statistic } from 'antd';

interface ScoreRadarProps {
  scores: {
    responsibility?: number;
    skill?: number;
    experience?: number;
    education?: number;
    soft_skill?: number;
  };
  totalScore?: number;
}

const ScoreRadar: React.FC<ScoreRadarProps> = ({ scores, totalScore }) => {
  const items = [
    { label: '核心职责', score: scores.responsibility ?? 0, color: '#1677ff' },
    { label: '硬技能', score: scores.skill ?? 0, color: '#52c41a' },
    { label: '经验质量', score: scores.experience ?? 0, color: '#faad14' },
    { label: '教育背景', score: scores.education ?? 0, color: '#722ed1' },
    { label: '软技能', score: scores.soft_skill ?? 0, color: '#13c2c2' },
  ];

  return (
    <Card title="评分详情" style={{ marginBottom: 16 }}>
      {totalScore !== undefined && (
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Statistic title="综合匹配度" value={totalScore} suffix="/ 100" valueStyle={{ color: totalScore >= 80 ? '#52c41a' : totalScore >= 60 ? '#faad14' : '#ff4d4f', fontSize: 36 }} />
        </div>
      )}
      <Row gutter={[16, 16]}>
        {items.map((item) => (
          <Col span={24} key={item.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 72, fontSize: 13, color: '#666' }}>{item.label}</span>
              <Progress
                percent={item.score}
                strokeColor={item.color}
                size="small"
                style={{ flex: 1 }}
              />
              <span style={{ width: 32, textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                {item.score}
              </span>
            </div>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

export default ScoreRadar;
