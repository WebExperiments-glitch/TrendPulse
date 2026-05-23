import React from 'react';
import { Tooltip, Progress } from 'antd';
import {
  TrophyOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  StarOutlined,
  BugOutlined,
  ThunderboltOutlined,
  TeamOutlined,
} from '@ant-design/icons';

const HEALTH_CONFIG = {
  excellent: { color: '#389e0d', bgColor: 'rgba(82,196,26,0.1)', icon: <TrophyOutlined />, label: '优秀', glow: 'rgba(82,196,26,0.3)' },
  healthy: { color: '#52c41a', bgColor: 'rgba(115,209,61,0.08)', icon: <CheckCircleOutlined />, label: '健康', glow: 'rgba(115,209,61,0.2)' },
  fair: { color: '#d48806', bgColor: 'rgba(250,173,20,0.08)', icon: <WarningOutlined />, label: '一般', glow: 'rgba(250,173,20,0.2)' },
  at_risk: { color: '#cf1322', bgColor: 'rgba(255,77,79,0.08)', icon: <CloseCircleOutlined />, label: '风险', glow: 'rgba(255,77,79,0.2)' },
};

const CHAOSS_DIMENSION_ICONS = {
  activity: <RocketOutlined />,
  responsiveness: <ThunderboltOutlined />,
  maturity: <StarOutlined />,
  maintenance: <BugOutlined />,
  inclusivity: <TeamOutlined />,
};

const formatDays = (days) => {
  if (days == null) return '未知';
  if (days < 1) return '今天';
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 月前`;
  return `${Math.floor(days / 365)} 年前`;
};

const computeFallback = (repo) => {
  const stars = repo.stars || repo.forks || 0;
  let score;
  if (stars > 50000) score = 85;
  else if (stars > 10000) score = 75;
  else if (stars > 1000) score = 60;
  else if (stars > 100) score = 45;
  else if (stars > 10) score = 30;
  else score = 15;

  let days_since_push = null;
  if (repo.pushed_at) {
    days_since_push = Math.floor((Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    score,
    level: score >= 60 ? 'healthy' : score >= 40 ? 'fair' : 'at_risk',
    activity_score: null,
    maturity_score: Math.min(100, score + 10),
    maintenance_score: null,
    release_score: null,
    days_since_push,
  };
};

const DimensionRow = ({ icon, name, score, weight, goal, question, details }) => {
  const dimColor = score >= 80 ? '#52c41a' : score >= 60 ? '#73d13d' : score >= 40 ? '#faad14' : '#ff4d4f';

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ fontWeight: 600, fontSize: 12 }}>
          {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
          {name}
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>(×{weight * 100}%)</span>
        </span>
        <span style={{ fontWeight: 700, color: dimColor, fontSize: 12 }}>{score}/100</span>
      </div>
      <Progress percent={score} showInfo={false} size="small" strokeColor={dimColor} trailColor="rgba(255,255,255,0.1)" />
      {goal && (
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1, lineHeight: 1.3 }}>
          {goal}
        </div>
      )}
      {details && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          {Object.entries(details).map(([k, v]) => (
            <span key={k} style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 8,
              background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
            }}>
              {k.replace(/_/g, ' ')}: {typeof v === 'boolean' ? (v ? '✓' : '✗') : v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const HealthBadge = ({ health, repo }) => {
  const effectiveHealth = health || (repo ? computeFallback(repo) : null);
  if (!effectiveHealth) return null;

  const isChaoss = effectiveHealth.framework === 'CHAOSS';
  const config = HEALTH_CONFIG[effectiveHealth.level] || HEALTH_CONFIG.fair;

  const scoreColor =
    effectiveHealth.score >= 80 ? '#52c41a' :
    effectiveHealth.score >= 60 ? '#73d13d' :
    effectiveHealth.score >= 40 ? '#faad14' : '#ff4d4f';

  const tooltipContent = isChaoss ? (
    <div style={{ fontSize: 12, lineHeight: 1.6, minWidth: 260 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginBottom: 6,
        padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.15)',
      }}>
        <div>
          <strong style={{ fontSize: 13 }}>健康评分 · {effectiveHealth.framework}</strong>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>目标-问题-指标 (GQM) 框架</div>
        </div>
        <strong style={{ fontSize: 16, color: scoreColor }}>{effectiveHealth.score}</strong>
      </div>

      {effectiveHealth.dimensions && Object.entries(effectiveHealth.dimensions).map(([key, dim]) => (
        <DimensionRow
          key={key}
          icon={CHAOSS_DIMENSION_ICONS[key]}
          name={dim.name}
          score={dim.score}
          weight={dim.weight}
          goal={dim.goal}
          question={dim.question}
          details={dim.details}
        />
      ))}

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', margin: '4px 0', paddingTop: 4 }}>
        {effectiveHealth.meta?.days_since_push != null && (
          <div><ClockCircleOutlined style={{ marginRight: 4 }} />最近推送: {formatDays(effectiveHealth.meta.days_since_push)}</div>
        )}
        {effectiveHealth.meta?.days_since_release != null && (
          <div>📦 最近发布: {formatDays(effectiveHealth.meta.days_since_release)}</div>
        )}
        {effectiveHealth.meta?.release_count > 0 && (
          <div>📋 近期发布: {effectiveHealth.meta.release_count} 个版本</div>
        )}
        {effectiveHealth.meta?.release_frequency_days && (
          <div>🔄 发布间隔: 约{effectiveHealth.meta.release_frequency_days}天</div>
        )}
        {effectiveHealth.meta?.archived && <div style={{ color: '#ff4d4f', marginTop: 2 }}>⚠️ 仓库已归档</div>}
      </div>
    </div>
  ) : (
    <div style={{ fontSize: 12, lineHeight: 2, minWidth: 200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <strong>综合评分</strong>
        <strong style={{ color: scoreColor }}>{effectiveHealth.score}/100</strong>
      </div>
      <Progress
        percent={effectiveHealth.score}
        showInfo={false}
        size="small"
        strokeColor={scoreColor}
        railColor="rgba(255,255,255,0.2)"
        style={{ marginBottom: 8 }}
      />

      {effectiveHealth.activity_score != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><RocketOutlined style={{ marginRight: 4 }} />活跃度</span>
          <span>{effectiveHealth.activity_score}/100</span>
        </div>
      )}
      {effectiveHealth.maturity_score != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><StarOutlined style={{ marginRight: 4 }} />成熟度</span>
          <span>{effectiveHealth.maturity_score}/100</span>
        </div>
      )}
      {effectiveHealth.maintenance_score != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><BugOutlined style={{ marginRight: 4 }} />维护度</span>
          <span>{effectiveHealth.maintenance_score}/100</span>
        </div>
      )}
      {effectiveHealth.release_score != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>🚀 发布频率</span>
          <span>{effectiveHealth.release_score}/100</span>
        </div>
      )}

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', margin: '4px 0' }} />

      <div><ClockCircleOutlined style={{ marginRight: 4 }} />最近推送: {formatDays(effectiveHealth.days_since_push)}</div>

      {effectiveHealth.days_since_release != null && (
        <div>📦 最近发布: {formatDays(effectiveHealth.days_since_release)}</div>
      )}
      {effectiveHealth.release_count > 0 && (
        <div>📋 近期发布: {effectiveHealth.release_count} 个版本</div>
      )}
      {effectiveHealth.release_frequency_days && (
        <div>🔄 发布间隔: 约{effectiveHealth.release_frequency_days}天</div>
      )}
      {effectiveHealth.archived && <div style={{ color: '#ff4d4f', marginTop: 2 }}>⚠️ 仓库已归档</div>}
    </div>
  );

  return (
    <Tooltip title={tooltipContent} styles={{ root: { maxWidth: isChaoss ? 340 : 300 } }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 11, color: config.color, cursor: 'pointer',
        padding: '3px 10px', borderRadius: 20,
        background: config.bgColor,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${config.color}30`,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: `0 0 0 0 ${config.glow}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 3px ${config.glow}`;
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 0 ${config.glow}`;
        e.currentTarget.style.transform = 'scale(1)';
      }}>
        {config.icon}
        {config.label}
        {isChaoss && <span style={{ fontSize: 9, opacity: 0.6, margin: '0 1px' }}>CHAOSS</span>}
        <span style={{
          fontWeight: 700,
          color: scoreColor,
          marginLeft: 2,
        }}>
          {effectiveHealth.score}
        </span>
      </span>
    </Tooltip>
  );
};

export default HealthBadge;