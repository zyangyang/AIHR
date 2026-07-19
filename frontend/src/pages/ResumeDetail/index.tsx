import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, Descriptions, Typography, Space, message, Tabs, Spin, Alert, Popconfirm, Progress, Result, Tag, Table } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, SyncOutlined, LoadingOutlined, FileTextOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Resume, ScoreRecord, ParseStatusResponse, InterviewQuestionsData } from '@/types';
import { getResumeApi, updateResumeStatusApi, downloadResumeFileApi } from '@/api/resumes';
import { triggerParseApi, triggerScoreApi, getParseStatusApi, getScoreStatusApi, downloadScorePdfApi } from '@/api/matching';
import { generateInterviewApi, downloadInterviewPdfApi, downloadInterviewDocxApi, getInterviewStatusApi } from '@/api/interviews';
import StatusTag from '@/components/StatusTag';
import ScoreRadar from '@/components/ScoreRadar';

const { Title, Text, Paragraph } = Typography;

const parseStatusText: Record<string, string> = {
  pending: '等待解析',
  parsing: '正在解析中...',
  success: '解析完成',
  failed: '解析失败',
};

const employmentStatusMap: Record<string, string> = {
  employed: '在职',
  unemployed: '离职',
  fresh: '应届',
};

const ResumeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [parseStatus, setParseStatus] = useState<string | null>(null);
  const [interviewStatus, setInterviewStatus] = useState<string | null>(null);
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestionsData | null>(null);
  const parseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interviewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getResumeApi(Number(id));
      setResume(res.data.data);
    } catch (error) {
      console.error('加载简历失败:', error);
      setResume(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadInterviewStatus();
    return () => {
      if (parseTimerRef.current) clearInterval(parseTimerRef.current);
      if (scoreTimerRef.current) clearInterval(scoreTimerRef.current);
      if (interviewTimerRef.current) clearInterval(interviewTimerRef.current);
    };
  }, [id]);

  // 当解析状态变化时更新
  useEffect(() => {
    setParseStatus(resume?.parse_status || null);
  }, [resume?.parse_status]);

  const startParsePolling = () => {
    if (parseTimerRef.current) clearInterval(parseTimerRef.current);

    parseTimerRef.current = setInterval(async () => {
      if (!id) return;
      try {
        const res = await getParseStatusApi(Number(id));
        const data: ParseStatusResponse = res.data.data;
        setParseStatus(data.status);
        if (data.status === 'success' || data.status === 'failed') {
          if (parseTimerRef.current) clearInterval(parseTimerRef.current);
          setProcessing((p) => ({ ...p, parse: false }));
          await loadData();
          message.destroy('parse');
          if (data.status === 'success') {
            message.success('简历解析完成！');
          } else {
            message.error('简历解析失败，请查看解析状态了解详情');
          }
        }
      } catch {
        // 静默处理
      }
    }, 2000);
  };

  const handleStatusChange = async (status: string) => {
    if (!id || !resume) return;
    try {
      await updateResumeStatusApi(Number(id), { status: status as any });
      message.success(`已标记为${status === 'rejected' ? '淘汰' : status === 'pending' ? '待定' : '进入面试'}`);
      
      // 如果进入面试，自动触发生成面试题
      if (status === 'interview') {
        try {
          await generateInterviewApi(Number(id), {});
          message.info('已自动触发生成面试题');
        } catch {
          message.warning('自动触发生成面试题失败，请到面试题库手动生成');
        }
      }
      
      loadData();
    } catch (error) {
      console.error('更新状态失败:', error);
      message.error('操作失败，请重试');
    }
  };

  const handleParse = async () => {
    if (!id) return;
    setProcessing((p) => ({ ...p, parse: true }));
    setParseStatus('parsing');
    try {
      await triggerParseApi(Number(id));
      message.loading({ content: '正在解析简历，请稍候...', key: 'parse', duration: 0 });
      startParsePolling();
    } catch (error: any) {
      console.error('提交识别任务失败:', error);
      message.error(error?.response?.data?.detail || '提交失败，请重试');
      setProcessing((p) => ({ ...p, parse: false }));
      setParseStatus(resume?.parse_status || null);
    }
  };

  const handleScore = async () => {
    if (!id) return;
    if (!resume || resume.parse_status !== 'success') {
      message.warning('请先完成简历解析');
      return;
    }
    setProcessing((p) => ({ ...p, score: true }));
    try {
      await triggerScoreApi(Number(id), {});
      message.loading({ content: '正在打分，请稍候...', key: 'score', duration: 0 });

      scoreTimerRef.current = setInterval(async () => {
        if (!id) return;
        try {
          const res = await getScoreStatusApi(Number(id));
          const data = res.data.data;
          if (data.status === 'success') {
            if (scoreTimerRef.current) clearInterval(scoreTimerRef.current);
            setProcessing((p) => ({ ...p, score: false }));
            message.destroy('score');
            message.success('打分完成！');
            await loadData();
          } else if (data.status === 'failed') {
            if (scoreTimerRef.current) clearInterval(scoreTimerRef.current);
            setProcessing((p) => ({ ...p, score: false }));
            message.destroy('score');
            message.error('打分失败，请重试');
          }
        } catch {
          // 静默处理
        }
      }, 3000);
    } catch (error: any) {
      console.error('提交打分任务失败:', error);
      message.error(error?.response?.data?.detail || '提交失败，请重试');
      setProcessing((p) => ({ ...p, score: false }));
    }
  };

  const handleDownload = async () => {
    if (!id) return;
    try {
      const res = await downloadResumeFileApi(Number(id));
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = resume?.file_name || 'resume.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
      message.error('下载失败');
    }
  };

  const handleDownloadScoreReport = async () => {
    if (!id) return;
    try {
      const res = await downloadScorePdfApi(Number(id));
      const disposition = res.headers['content-disposition'];
      let filename = `初筛报告.pdf`;
      if (disposition) {
        const match = disposition.match(/filename\*?=([^;]+)/);
        if (match) {
          let raw = match[1].trim();
          raw = raw.replace(/^(?:UTF-8|utf-8)''/i, '');
          raw = raw.replace(/^["']|["']$/g, '');
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
      console.error('下载初筛报告失败:', error);
      message.error('下载失败');
    }
  };

  const loadInterviewStatus = async () => {
    if (!id) return;
    try {
      const res = await getInterviewStatusApi(Number(id));
      setInterviewStatus(res.data.data.status);
      if (res.data.data.questions) {
        setInterviewQuestions(res.data.data.questions);
      }
    } catch {
      // 静默处理
    }
  };

  const handleGenerateInterview = async () => {
    if (!id) return;
    setProcessing((p) => ({ ...p, interview: true }));
    setInterviewStatus('generating');
    try {
      await generateInterviewApi(Number(id), {});
      message.info('生成任务已提交');
      startInterviewPolling();
    } catch (error: any) {
      console.error('生成面试题失败:', error);
      message.error(error?.response?.data?.detail || '提交失败，请重试');
      setProcessing((p) => ({ ...p, interview: false }));
      setInterviewStatus('pending');
    }
  };

  const startInterviewPolling = () => {
    if (interviewTimerRef.current) clearInterval(interviewTimerRef.current);

    interviewTimerRef.current = setInterval(async () => {
      if (!id) return;
      try {
        const res = await getInterviewStatusApi(Number(id));
        const data = res.data.data;
        setInterviewStatus(data.status);
        if (data.questions) {
          setInterviewQuestions(data.questions);
        }
        if (data.status === 'success' || data.status === 'failed') {
          if (interviewTimerRef.current) clearInterval(interviewTimerRef.current);
          setProcessing((p) => ({ ...p, interview: false }));
          if (data.status === 'success') {
            await loadData();
            message.success('面试题生成完成！');
          } else {
            message.error('面试题生成失败，请重试');
          }
        }
      } catch {
        // 静默处理
      }
    }, 2000);
  };

  const handleDownloadInterview = async (format: 'pdf' | 'docx') => {
    if (!id) return;
    try {
      const apiFn = format === 'pdf' ? downloadInterviewPdfApi : downloadInterviewDocxApi;
      const res = await apiFn(Number(id));
      
      const disposition = res.headers['content-disposition'];
      let filename = `面试题.${format}`;
      if (disposition) {
        const match = disposition.match(/filename\*?=([^;]+)/);
        if (match) {
          let raw = match[1].trim();
          raw = raw.replace(/^(?:UTF-8|utf-8)''/i, '');
          raw = raw.replace(/^["']|["']$/g, '');
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

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />;
  if (!resume) return <Alert type="error" message="简历不存在" />;

  const latestScore = resume.scores?.[resume.scores.length - 1];

  // 解析内容 tab 的渲染
  const renderParsedTab = () => {
    if (resume.parse_status === 'parsing') {
      return (
        <Result
          icon={<LoadingOutlined spin style={{ fontSize: 48, color: '#1677ff' }} />}
          title="正在解析简历"
          subTitle="AI 正在提取简历中的工作经历、教育背景和技能信息，请稍候..."
        />
      );
    }
    if (resume.parse_status === 'failed') {
      return (
        <Result
          status="error"
          title="解析失败"
          subTitle="请检查 LLM 配置是否正确，或点击简历解析按钮重试"
        />
      );
    }
    if (resume.parsed_data) {
      return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card title="教育背景" size="small">
            {resume.parsed_data.education?.map((edu, i) => (
              <Descriptions key={i} column={3} size="small" bordered style={{ marginBottom: 8 }}>
                <Descriptions.Item label="学校">{edu.school}</Descriptions.Item>
                <Descriptions.Item label="学历">{edu.degree}</Descriptions.Item>
                <Descriptions.Item label="专业">{edu.major}</Descriptions.Item>
              </Descriptions>
            ))}
          </Card>
          <Card title="工作经历" size="small">
            {resume.parsed_data.work_experience?.map((exp, i) => (
              <Descriptions key={i} column={3} size="small" bordered style={{ marginBottom: 8 }}>
                <Descriptions.Item label="公司">{exp.company}</Descriptions.Item>
                <Descriptions.Item label="职位">{exp.position}</Descriptions.Item>
                <Descriptions.Item label="时间">{exp.start_date} ~ {exp.end_date}</Descriptions.Item>
                <Descriptions.Item label="描述" span={3}>{exp.description}</Descriptions.Item>
              </Descriptions>
            ))}
          </Card>
          <Card title="技能" size="small">
            <Space wrap>
              {resume.parsed_data.skills?.map((s, i) => <span key={i} style={{ padding: '4px 12px', background: '#e6f4ff', borderRadius: 4, fontSize: 13 }}>{s}</span>)}
            </Space>
          </Card>
        </Space>
      );
    }
    return <Text type="secondary">暂无解析数据，点击"简历解析"开始解析</Text>;
  };

  // 面试题 tab 的渲染
  const renderInterviewTab = () => {
    if (!interviewStatus || interviewStatus === 'pending') {
      return (
        <Result
          status="info"
          title="暂未生成面试题"
          subTitle="点击“生成面试题”按钮开始生成"
          extra={
            <Button type="primary" icon={<FileTextOutlined />} onClick={handleGenerateInterview} loading={processing.interview}>
              生成面试题
            </Button>
          }
        />
      );
    }
    if (interviewStatus === 'generating') {
      return (
        <Result
          icon={<LoadingOutlined spin style={{ fontSize: 48, color: '#1677ff' }} />}
          title="正在生成面试题"
          subTitle="AI 正在根据简历和职位要求生成面试题目，请稍候..."
        />
      );
    }
    if (interviewStatus === 'failed') {
      return (
        <Result
          status="error"
          title="面试题生成失败"
          subTitle="请检查配置后重试"
          extra={
            <Button type="primary" onClick={handleGenerateInterview} loading={processing.interview}>
              重新生成
            </Button>
          }
        />
      );
    }
    if (interviewStatus === 'success' && interviewQuestions) {
      const moduleNames: Record<string, string> = {
        module_1: '一、基础信息核实',
        module_2: '二、专业能力考察',
        module_3: '三、项目经验深挖',
        module_4: '四、综合素质评估',
      };

      return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {(Object.keys(interviewQuestions) as Array<keyof InterviewQuestionsData>).map((moduleKey) => {
            const questions = interviewQuestions[moduleKey];
            if (!questions || questions.length === 0) return null;
            return (
              <Card key={moduleKey} title={moduleNames[moduleKey] || moduleKey} size="small">
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {questions.map((q, i) => (
                    <div key={i} style={{ paddingLeft: 8, borderLeft: '3px solid #1677ff' }}>
                      <Paragraph strong style={{ marginBottom: 4 }}>
                        问题 {i + 1}：{q.question}
                      </Paragraph>
                      <Paragraph type="secondary" style={{ marginBottom: 4 }}>
                        <Text strong>考察意图：</Text>{q.intent}
                      </Paragraph>
                      <Paragraph style={{ marginBottom: 0 }}>
                        <Text strong>评估要点：</Text>
                        {q.evaluation_points.map((point, j) => (
                          <Tag key={j} style={{ margin: '2px 4px 2px 0' }}>{point}</Tag>
                        ))}
                      </Paragraph>
                    </div>
                  ))}
                </Space>
              </Card>
            );
          })}
        </Space>
      );
    }
    return <Text type="secondary">未知状态</Text>;
  };

  // Token消耗 tab 的渲染
  const renderTokenTab = () => {
    const records: { key: string; stage: string; model: string; tokens: number; cost: number | null; time: string }[] = [];

    // 解析内容
    if (resume.parse_tokens_used) {
      records.push({
        key: 'parse',
        stage: '解析内容',
        model: resume.parse_model_name || '-',
        tokens: resume.parse_tokens_used,
        cost: resume.parse_estimated_cost ?? null,
        time: dayjs(resume.created_at).format('YYYY-MM-DD HH:mm'),
      });
    }

    // 初筛报告（可能多次）
    resume.scores?.forEach((s: ScoreRecord) => {
      records.push({
        key: `score-${s.id}`,
        stage: '初筛报告',
        model: s.model_name || '-',
        tokens: s.tokens_used,
        cost: s.estimated_cost ?? null,
        time: dayjs(s.scored_at).format('YYYY-MM-DD HH:mm'),
      });
    });

    // 面试题生成
    if (resume.interview_question?.tokens_used) {
      records.push({
        key: 'interview',
        stage: '面试题生成',
        model: resume.interview_question.model_name || '-',
        tokens: resume.interview_question.tokens_used,
        cost: resume.interview_question.estimated_cost ?? null,
        time: dayjs(resume.interview_question.generated_at).format('YYYY-MM-DD HH:mm'),
      });
    }

    // 向量化存储
    if (resume.embedding_tokens_used) {
      records.push({
        key: 'embedding',
        stage: '向量化存储',
        model: resume.embedding_model_name || '-',
        tokens: resume.embedding_tokens_used,
        cost: resume.embedding_estimated_cost ?? null,
        time: dayjs(resume.created_at).format('YYYY-MM-DD HH:mm'),
      });
    }

    const totalTokens = records.reduce((sum, r) => sum + r.tokens, 0);
    const totalCost = records.reduce((sum, r) => sum + (r.cost || 0), 0);

    const columns = [
      { title: '环节', dataIndex: 'stage', key: 'stage', width: 120 },
      { title: '模型', dataIndex: 'model', key: 'model', width: 180 },
      { title: 'Token消耗', dataIndex: 'tokens', key: 'tokens', width: 120, align: 'right' as const },
      {
        title: '成本估算', dataIndex: 'cost', key: 'cost', width: 120, align: 'right' as const,
        render: (v: number | null) => v != null ? `¥${v.toFixed(4)}` : '-',
      },
      { title: '时间', dataIndex: 'time', key: 'time', width: 180 },
    ];

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Table
          columns={columns}
          dataSource={records}
          pagination={false}
          size="small"
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><strong>合计</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={1} />
              <Table.Summary.Cell index={2} align="right"><strong>{totalTokens.toLocaleString()}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right"><strong>¥{totalCost.toFixed(4)}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={4} />
            </Table.Summary.Row>
          )}
        />
        {records.length === 0 && <Text type="secondary">暂无Token消耗记录</Text>}
      </Space>
    );
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/resumes')}>返回</Button>
        <Title level={4} style={{ margin: 0 }}>{resume.name} - 简历详情</Title>
      </Space>
      <Card style={{ marginBottom: 16 }}>
        <Descriptions title="基本信息" column={3} bordered>
          <Descriptions.Item label="姓名">{resume.name}</Descriptions.Item>
          <Descriptions.Item label="手机号">{resume.phone}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{resume.email}</Descriptions.Item>
          <Descriptions.Item label="应聘职位">{resume.job_title}</Descriptions.Item>
          <Descriptions.Item label="在职状态">{resume.employment_status ? (employmentStatusMap[resume.employment_status] || resume.employment_status) : '-'}</Descriptions.Item>
          <Descriptions.Item label="期望薪资">{resume.expected_salary ?? ''}</Descriptions.Item>
          <Descriptions.Item label="简历状态">
            <StatusTag status={resume.status} type="resume" />
          </Descriptions.Item>
          <Descriptions.Item label="解析状态">
            <Space>
              <StatusTag status={resume.parse_status} type="parse" />
              {processing.parse && <Text type="secondary" style={{ fontSize: 12 }}>{parseStatusText[parseStatus || 'pending']}</Text>}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="面试题状态">
            <Space>
              <StatusTag status={interviewStatus || 'pending'} type="interview" />
              {processing.interview && <Text type="secondary" style={{ fontSize: 12 }}>生成中...</Text>}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="初筛报告状态">
            <Space>
              <StatusTag status={processing.score ? 'scoring' : (latestScore ? 'success' : 'pending')} type="score" />
              {processing.score && <Text type="secondary" style={{ fontSize: 12 }}>打分中...</Text>}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="投递时间" span={2}>{dayjs(resume.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
        </Descriptions>
        <Space style={{ marginTop: 16 }}>
          <Button icon={<DownloadOutlined />} onClick={handleDownload}>下载简历</Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadScoreReport} disabled={!latestScore}>
            下载初筛报告
          </Button>
          {interviewStatus === 'success' && (
            <Button icon={<DownloadOutlined />} onClick={() => handleDownloadInterview('pdf')}>
              下载面试题
            </Button>
          )}
          <Button icon={<SyncOutlined />} onClick={handleParse} loading={processing.parse} disabled={resume.parse_status === 'parsing'}>
            {resume.parse_status === 'parsing' ? '解析中...' : '简历解析'}
          </Button>
          <Button icon={<SyncOutlined />} onClick={handleScore} loading={processing.score} disabled={resume.parse_status !== 'success'}>
            初筛打分
          </Button>
          <Button icon={<FileTextOutlined />} onClick={handleGenerateInterview} loading={processing.interview}>
            生成面试题
          </Button>
          <Popconfirm title="确认淘汰？" onConfirm={() => handleStatusChange('rejected')}>
            <Button danger>淘汰</Button>
          </Popconfirm>
          <Button onClick={() => handleStatusChange('pending')}>待定</Button>
          <Button type="primary" onClick={() => handleStatusChange('interview')}>进入面试</Button>
        </Space>
      </Card>

      <Tabs
        items={[
          {
            key: 'parsed',
            label: processing.parse ? (
              <span><LoadingOutlined /> 解析中...</span>
            ) : '解析内容',
            children: renderParsedTab(),
          },
          {
            key: 'score',
            label: '初筛报告',
            children: latestScore ? (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <ScoreRadar
                  scores={{
                    responsibility: latestScore.responsibility_score,
                    skill: latestScore.skill_score,
                    experience: latestScore.experience_score,
                    education: latestScore.education_score,
                    soft_skill: latestScore.soft_skill_score,
                  }}
                  totalScore={latestScore.total_score}
                />
                <Card title="关键优势" size="small">
                  <Paragraph>{latestScore.advantages}</Paragraph>
                </Card>
                <Card title="关键差距" size="small">
                  <Paragraph type="danger">{latestScore.disadvantages}</Paragraph>
                </Card>
                <Card title="总结" size="small">
                  <Paragraph>{latestScore.summary}</Paragraph>
                </Card>
                <Descriptions column={3} size="small">
                  <Descriptions.Item label="使用提示词">{latestScore.prompt_name}</Descriptions.Item>
                  <Descriptions.Item label="使用模型">{latestScore.model_name}</Descriptions.Item>
                  <Descriptions.Item label="Token消耗">{latestScore.tokens_used}</Descriptions.Item>
                </Descriptions>
              </Space>
            ) : <Text type="secondary">暂无评分数据</Text>,
          },
          {
            key: 'interview',
            label: '面试题',
            children: renderInterviewTab(),
          },
          {
            key: 'tokens',
            label: 'Token消耗',
            children: renderTokenTab(),
          },
        ]}
      />
    </div>
  );
};

export default ResumeDetail;
