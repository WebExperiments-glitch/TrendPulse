import React, { useState, useRef, useEffect } from 'react';
import { Modal, Checkbox, Button, message, Spin, Slider } from 'antd';
import { DownloadOutlined, PictureOutlined } from '@ant-design/icons';

const CANVAS_WIDTH = 800;
const CARD_HEIGHT = 90;
const HEADER_HEIGHT = 120;
const FOOTER_HEIGHT = 60;

const PosterGenerator = ({ repos, visible, onClose }) => {
  const [selected, setSelected] = useState([]);
  const [count, setCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (visible && repos.length > 0) {
      const n = Math.min(count, repos.length);
      setSelected(repos.slice(0, n).map((r, i) => ({ ...r, rank: i + 1 })));
    }
  }, [visible, repos, count]);

  const toggleRepo = (repo, idx) => {
    setSelected((prev) => {
      const exists = prev.find((r) => r.name === repo.name);
      if (exists) return prev.filter((r) => r.name !== repo.name);
      if (prev.length >= 10) return prev;
      return [...prev, { ...repo, rank: prev.length + 1 }];
    });
  };

  const drawPoster = (ctx) => {
    const w = CANVAS_WIDTH;
    const h = HEADER_HEIGHT + selected.length * CARD_HEIGHT + FOOTER_HEIGHT + 20;

    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#0d1117');
    gradient.addColorStop(0.4, '#161b22');
    gradient.addColorStop(1, '#0d1117');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    const topGrad = ctx.createLinearGradient(0, 0, w, 0);
    topGrad.addColorStop(0, '#722ed1');
    topGrad.addColorStop(0.5, '#1677ff');
    topGrad.addColorStop(1, '#13c2c2');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, w, 3);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GitHub Trending', w / 2, 48);

    ctx.font = '16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#8b949e';
    ctx.fillText('个人精选榜单', w / 2, 78);

    const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText(today, w / 2, 98);

    selected.forEach((repo, i) => {
      const y = HEADER_HEIGHT + i * CARD_HEIGHT;
      const isEven = i % 2 === 0;

      ctx.fillStyle = isEven ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)';
      ctx.fillRect(30, y + 4, w - 60, CARD_HEIGHT - 8);

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, y + CARD_HEIGHT);
      ctx.lineTo(w - 30, y + CARD_HEIGHT);
      ctx.stroke();

      ctx.fillStyle = '#8b949e';
      ctx.font = 'bold 16px "Segoe UI", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`#${i + 1}`, 70, y + 50);

      ctx.fillStyle = '#58a6ff';
      ctx.font = 'bold 17px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      const name = repo.name?.length > 40 ? repo.name.slice(0, 38) + '..' : repo.name;
      ctx.fillText(name, 100, y + 32);

      if (repo.language) {
        const langWidth = ctx.measureText(repo.language).width + 24;
        ctx.fillStyle = 'rgba(88,166,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(100, y + 44, langWidth, 22, 11);
        ctx.fill();
        ctx.fillStyle = '#79c0ff';
        ctx.font = '11px "Segoe UI", sans-serif';
        ctx.fillText(repo.language, 112, y + 59);
      }

      if (repo.description) {
        const desc = repo.description.length > 55 ? repo.description.slice(0, 53) + '..' : repo.description;
        ctx.fillStyle = '#8b949e';
        ctx.font = '11px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        const descX = 100 + (repo.language ? ctx.measureText(repo.language).width + 36 : 0);
        ctx.fillText(desc, descX, y + 59);
      }

      ctx.fillStyle = '#fadb14';
      ctx.font = 'bold 16px "Segoe UI", sans-serif';
      ctx.textAlign = 'right';
      const starsText = '⭐ ' + (repo.stars || 0).toLocaleString();
      ctx.fillText(starsText, w - 60, y + 50);
    });

    ctx.fillStyle = '#30363d';
    ctx.fillRect(0, h - FOOTER_HEIGHT, w, 1);

    ctx.fillStyle = '#484f58';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('由 GitHub Trending Viewer 生成', w / 2, h - 28);
    ctx.fillText('github-trending-viewer', w / 2, h - 12);
  };

  const handleGenerate = async () => {
    if (selected.length < 1) {
      message.warning('请至少选择 1 个仓库');
      return;
    }
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 100));

    const canvas = canvasRef.current;
    if (!canvas) { setGenerating(false); return; }

    const h = HEADER_HEIGHT + selected.length * CARD_HEIGHT + FOOTER_HEIGHT + 20;
    canvas.width = CANVAS_WIDTH;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    drawPoster(ctx);
    setGenerating(false);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `github-trending-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    message.success('海报已下载！');
  };

  const generateTimeoutRef = useRef(null);

  useEffect(() => {
    if (visible && selected.length > 0) {
      // Clear any pending generation
      if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
      // Debounce generation to avoid rapid redraws
      generateTimeoutRef.current = setTimeout(() => {
        handleGenerate();
        generateTimeoutRef.current = null;
      }, 200);
    }
    return () => {
      if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, count]);

  return (
    <Modal
      title={<span style={{ fontWeight: 700 }}><PictureOutlined style={{ marginRight: 8 }} />生成个人榜单海报</span>}
      open={visible}
      onCancel={onClose}
      width={920}
      footer={[
        <Button key="download" type="primary" icon={<DownloadOutlined />}
          onClick={handleDownload} disabled={generating || selected.length === 0}
          style={{
            background: 'var(--gradient-accent)',
            border: 'none',
            fontWeight: 600,
            borderRadius: 8,
          }}>
          下载 PNG
        </Button>,
        <Button key="close" onClick={onClose} style={{ borderRadius: 8 }}>关闭</Button>,
      ]}
      destroyOnHidden
      styles={{
        content: {
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        },
      }}
    >
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 220px', maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            选择数量
          </div>
          <Slider
            min={3}
            max={10}
            value={count}
            onChange={(v) => setCount(v)}
            marks={{ 3: '3', 5: '5', 7: '7', 10: '10' }}
            style={{ marginBottom: 16 }}
          />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            已选 {selected.length}/{count}
          </div>
          {(repos || []).slice(0, 20).map((repo, i) => (
            <div key={repo.name || i} style={{ marginBottom: 6 }}>
              <Checkbox
                checked={!!selected.find((r) => r.name === repo.name)}
                onChange={() => toggleRepo(repo, i)}
                style={{ fontSize: 12 }}
              >
                <span style={{ fontSize: 12 }}>#{i + 1} {repo.name?.slice(0, 28)}</span>
              </Checkbox>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 300, textAlign: 'center' }}>
          <div style={{ position: 'relative', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'auto', maxHeight: '65vh', background: '#0d1117', boxShadow: 'var(--shadow-md)' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
            {generating && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(13, 17, 23, 0.7)',
                backdropFilter: 'blur(4px)',
              }}>
                <Spin description="生成海报中..." />
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PosterGenerator;