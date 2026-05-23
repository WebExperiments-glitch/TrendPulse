import React, { useMemo } from 'react';
import { Select, Space } from 'antd';
import { FilterOutlined } from '@ant-design/icons';

const FilterBar = ({ repos, filters, onFilterChange }) => {
  const languages = useMemo(() => {
    const set = new Set();
    repos.forEach((r) => { if (r.language) set.add(r.language); });
    return [...set].sort();
  }, [repos]);

  const allTopics = useMemo(() => {
    const set = new Set();
    repos.forEach((r) => {
      (r.topics || []).forEach((t) => set.add(t));
    });
    return [...set].sort();
  }, [repos]);

  if (repos.length === 0) return null;

  return (
    <div style={{
      marginBottom: 20, padding: '14px 22px',
      background: 'var(--bg-filter)',
      backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
      WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <Space wrap size={[20, 8]} style={{ width: '100%' }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FilterOutlined />
          {repos.length} 个结果
        </span>
        <Select
          mode="multiple"
          placeholder="编程语言"
          value={filters.languages}
          onChange={(v) => onFilterChange({ ...filters, languages: v })}
          style={{ minWidth: 160 }}
          maxTagCount={2}
          allowClear
          size="small"
          options={languages.map((l) => ({ value: l, label: l }))}
        />
        <Select
          mode="multiple"
          placeholder="话题/领域"
          value={filters.topics}
          onChange={(v) => onFilterChange({ ...filters, topics: v })}
          style={{ minWidth: 200 }}
          maxTagCount={2}
          allowClear
          showSearch
          size="small"
          filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
          options={allTopics.map((t) => ({ value: t, label: t }))}
        />
      </Space>
    </div>
  );
};

export default FilterBar;