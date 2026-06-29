import React, { useEffect, useState } from 'react';
import { Modal, Spin, Button, message, Tag, Segmented } from 'antd';
import { CopyOutlined, FileTextOutlined } from '@ant-design/icons';
import { getSummary } from '../api/api';

const PERIOD_LABELS = {
  daily: '每日热点',
  weekly: '每周热点',
  rising: '上升趋势',
  declining: '下降趋势',
};

const TONE_OPTIONS = [
  { label: '📰 日报', value: 'daily' },
  { label: '🐶 吐槽', value: 'roast' },
  { label: '⚡ 极简', value: 'minimal' },
];

function renderMarkdownLine(line, key) {
  if (/^### /.test(line)) {
    const text = line.replace(/^### /, '');
    return (
      <h4 key={key} style={{ margin: '18px 0 8px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
        {renderInline(text)}
      </h4>
    );
  }
  if (/^#### /.test(line)) {
    const text = line.replace(/^#### /, '');
    return (
      <h5 key={key} style={{ margin: '14px 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
        {renderInline(text)}
      </h5>
    );
  }
  if (/^## /.test(line)) {
    const text = line.replace(/^## /, '');
    return (
      <h3 key={key} style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: 8 }}>
        {renderInline(text)}
      </h3>
    );
  }
  if (line === '---') {
    return <hr key={key} style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '16px 0' }} />;
  }
  if (/^\|.*\|$/.test(line)) {
    const cells = line.split('|').filter((c) => c.trim() !== '').map((c) => c.trim());
    const isHeaderSep = cells.every((c) => /^-+$/.test(c));
    if (isHeaderSep) return null;
    const isHeader = cells.length > 0 && cells.every((c) => c.startsWith('---') === false);
    const cellStyle = {
      padding: '4px 12px',
      border: '1px solid var(--border-color)',
      fontSize: 13,
      textAlign: 'left',
    };
    const headerStyle = { ...cellStyle, fontWeight: 700, background: 'rgba(0,0,0,0.04)' };
    return (
      <tr key={key}>
        {cells.map((cell, ci) => (
          <td key={ci} style={isHeader ? headerStyle : cellStyle}>
            {renderInline(cell)}
          </td>
        ))}
      </tr>
    );
  }
  if (/^> /.test(line)) {
    const text = line.replace(/^> /, '');
    return (
      <div key={key} style={{
        borderLeft: '3px solid var(--color-primary)',
        padding: '6px 12px',
        margin: '8px 0',
        background: 'rgba(22,119,255,0.04)',
        borderRadius: '0 6px 6px 0',
        fontSize: 13,
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
      }}>
        {renderInline(text)}
      </div>
    );
  }
  if (/^- /.test(line)) {
    const text = line.replace(/^- /, '');
    return (
      <div key={key} style={{ paddingLeft: 12, fontSize: 13, lineHeight: 2, color: 'var(--text-primary)' }}>
        {renderInline(text)}
      </div>
    );
  }
  if (/^　　/.test(line)) {
    return (
      <div key={key} style={{ paddingLeft: 24, fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
        {renderInline(line.replace(/^　　/, ''))}
      </div>
    );
  }
  if (line === '') {
    return <div key={key} style={{ height: 4 }} />;
  }
  return (
    <p key={key} style={{ margin: '2px 0', fontSize: 13, lineHeight: 1.8, color: 'var(--text-primary)' }}>
      {renderInline(line)}
    </p>
  );
}

function renderInline(text) {
  const parts = [];
  let remaining = text;
  let idx = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={idx++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code key={idx++} style={{
          background: 'rgba(0,0,0,0.06)',
          padding: '1px 6px',
          borderRadius: 4,
          fontSize: 12,
          fontFamily: 'monospace',
        }}>
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a key={idx++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }
    const nextSpecial = remaining.search(/[\*\[]|`/);
    if (nextSpecial === -1) {
      parts.push(<span key={idx++}>{remaining}</span>);
      break;
    }
    if (nextSpecial > 0) {
      parts.push(<span key={idx++}>{remaining.slice(0, nextSpecial)}</span>);
    }
    remaining = remaining.slice(nextSpecial);
  }

  return parts;
}

const SummaryModal = ({ period, visible, onClose }) => {
  const [summary, setSummary] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [tone, setTone] = useState('daily');

  useEffect(() => {
    if (!visible || !period) return;
    setLoading(true);
    setSummary('');
    setStats(null);
    const controller = new AbortController();
    getSummary(period, tone, controller.signal)
      .then((res) => {
        setSummary(res.data.summary);
        setStats(res.data.stats);
      })
      .catch((err) => {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        message.error('生成总结失败: ' + (err.message || '未知错误'));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [visible, period, tone]);

  const handleCopy = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(summary);
      message.success('总结已复制到剪贴板');
    } catch {
      message.error('复制失败，请手动复制');
    } finally {
      setCopying(false);
    }
  };

  function renderGroupedLines(lines) {
  const elements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 表格检测：直接收拢所有连续的 |...| 行
    if (/^\|.*\|$/.test(line)) {
      const tableRows = [];
      let j = i;
      while (j < lines.length && /^\|.*\|$/.test(lines[j])) {
        const rowResult = renderMarkdownLine(lines[j], j);
        if (rowResult !== null) {
          tableRows.push(rowResult);
        }
        j++;
      }
      if (tableRows.length > 0) {
        elements.push(
          <table key={`table-${i}`} style={{ width: '100%', borderCollapse: 'collapse', margin: '8px 0' }}>
            <tbody>{tableRows}</tbody>
          </table>
        );
      }
      i = j;
    } else {
      elements.push(renderMarkdownLine(line, i));
      i++;
    }
  }
  return elements;
}

  const lines = summary ? summary.split('\n') : [];

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileTextOutlined style={{ color: 'var(--color-primary)' }} />
          {PERIOD_LABELS[period] || period} · 趋势总结
          <Segmented
            value={tone}
            onChange={(val) => setTone(val)}
            options={TONE_OPTIONS}
            size="small"
            style={{ marginLeft: 8 }}
          />
        </span>
      }
      open={visible}
      onCancel={onClose}
      width={680}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {stats && (
              <>
                <Tag color="blue">收录 {stats.total_repos} 个仓库</Tag>
                {stats.has_history && (
                  <>
                    <Tag color="green">新进 {stats.new_entries} 个</Tag>
                    <Tag color="orange">跌出 {stats.dropped_entries} 个</Tag>
                  </>
                )}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button icon={<CopyOutlined />} onClick={handleCopy} loading={copying} disabled={!summary}>
              复制 Markdown
            </Button>
            <Button onClick={onClose}>关闭</Button>
          </div>
        </div>
      }
      styles={{
        body: {
          maxHeight: '65vh',
          overflowY: 'auto',
          padding: '16px 24px',
        },
      }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" description="正在生成总结..." />
        </div>
      ) : summary ? (
        <div style={{ lineHeight: 1.8 }}>
          {renderGroupedLines(lines)}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          暂无数据
        </div>
      )}
    </Modal>
  );
};

export default SummaryModal;