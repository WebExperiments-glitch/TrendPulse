import React, { useState } from 'react';
import { Button } from 'antd';
import { ShakeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import './RandomDiscover.css';

const RandomDiscover = ({ repos, onPick }) => {
  const [animating, setAnimating] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleClick = () => {
    if (!repos || repos.length === 0) return;
    setAnimating(true);

    const quickShuffle = setInterval(() => {
      const idx = Math.floor(Math.random() * repos.length);
      setPreview(repos[idx]);
    }, 80);

    setTimeout(() => {
      clearInterval(quickShuffle);
      const idx = Math.floor(Math.random() * repos.length);
      const picked = repos[idx];
      setPreview(picked);
      setAnimating(false);
      setTimeout(() => {
        setPreview(null);
        onPick(picked);
      }, 400);
    }, 1200);
  };

  return (
    <div className="random-discover-wrapper">
      {preview && animating && (
        <div className="random-preview">
          <ThunderboltOutlined className="random-preview-icon" />
          <span className="random-preview-name">{preview.name}</span>
        </div>
      )}
      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<ShakeOutlined spin={animating} />}
        onClick={handleClick}
        className={`random-discover-btn ${animating ? 'animating' : ''}`}
        title="随机发现一个仓库"
      />
      {!animating && <span className="random-discover-label">随机逛逛</span>}
    </div>
  );
};

export default RandomDiscover;