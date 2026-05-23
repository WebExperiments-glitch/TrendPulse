# 贡献指南

感谢你对 **TrendPulse** 的关注！我们欢迎任何形式的贡献，包括但不限于 Bug 修复、功能增强、文档改进、UI 优化等。

在开始贡献之前，请花几分钟阅读本指南，以确保协作流程顺畅高效。

---

## 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
  - [报告 Bug](#报告-bug)
  - [提出功能建议](#提出功能建议)
  - [提交代码](#提交代码)
- [开发环境搭建](#开发环境搭建)
- [项目架构概览](#项目架构概览)
- [代码规范](#代码规范)
  - [前端规范](#前端规范)
  - [后端规范](#后端规范)
  - [Commit 规范](#commit-规范)
- [Pull Request 流程](#pull-request-流程)
- [测试指南](#测试指南)
- [发布流程](#发布流程)

---

## 行为准则

- 保持尊重和包容的交流态度
- 建设性地提出批评和建议
- 关注问题本身，而非个人
- 帮助新人融入社区

---

## 如何贡献

### 报告 Bug

如果你发现了 Bug，请通过 **GitHub Issues** 提交，并包含以下信息：

1. **标题**：简洁描述问题（如 `fix: 仓库卡片在移动端布局错乱`）
2. **环境信息**：
   - 操作系统（Windows / macOS / Linux）
   - 浏览器及版本
   - Python 版本
   - Node.js 版本
3. **复现步骤**：详细描述触发 Bug 的操作步骤
4. **预期行为**：描述你期望发生什么
5. **实际行为**：描述实际发生了什么
6. **截图/日志**：如有，附上截图或控制台错误日志

### 提出功能建议

功能建议同样通过 **GitHub Issues** 提交，建议包含：

1. **使用场景**：这个功能解决什么问题？
2. **方案描述**：你期望的实现方式
3. **替代方案**：考虑过的其他方案
4. **附加信息**：相关的截图、参考链接等

### 提交代码

1. **Fork** 本仓库到你的 GitHub 账户
2. 克隆你的 Fork 到本地
3. 创建特性分支（见下方分支命名规范）
4. 进行开发并提交
5. 推送到你的 Fork
6. 提交 Pull Request

---

## 开发环境搭建

### 前置条件

| 工具 | 最低版本 | 说明 |
|------|----------|------|
| Python | 3.7+ | 后端运行环境 |
| Node.js | 16+ | 前端运行环境 |
| npm | 8+ | 包管理器 |
| Git | 2.x | 版本控制 |

### 克隆项目

```bash
git clone https://github.com/YOUR_USERNAME/trendpulse.git
cd trendpulse
```

### 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 安装前端依赖

```bash
cd frontend
npm install
```

### 启动开发环境

需要同时运行两个终端：

**终端 1 - 后端：**

```bash
cd backend
python app.py
# 服务运行在 http://localhost:5000
```

**终端 2 - 前端：**

```bash
cd frontend
npm run dev
# 服务运行在 http://localhost:5173
```

> **提示**：前端已通过 Vite 代理配置将 `/api` 请求转发到后端，无需额外配置。

### 可选：配置 GitHub Token

设置环境变量可提升 API 调用限额：

```bash
# Windows PowerShell
$env:GITHUB_TOKEN = "your_github_token"

# Linux / macOS
export GITHUB_TOKEN="your_github_token"
```

---

## 项目架构概览

在开始编码之前，建议先了解项目的整体架构：

```
┌─────────────────────────────────────────────────┐
│                   前端 (React)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Pages   │ │Components│ │ Contexts / Utils │ │
│  │ 7 个页面 │ │ 15 个组件│ │ Theme / Watch    │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
│                      │                           │
│              Axios (baseURL: /api)               │
└──────────────────────┼──────────────────────────┘
                       │ Vite Proxy
┌──────────────────────┼──────────────────────────┐
│                   后端 (Flask)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ API 路由 │ │ Scraper  │ │ APScheduler      │ │
│  │ 12 个端点│ │ 爬虫模块 │ │ 定时更新任务     │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
│                      │                           │
│              MemoryStorage (JSON)                │
└──────────────────────┼──────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────┐
│                   外部服务                        │
│  GitHub Trending Page  │  GitHub REST API       │
└─────────────────────────────────────────────────┘
```

### 关键文件说明

| 文件 | 作用 | 修改频率 |
|------|------|----------|
| `backend/app.py` | API 路由、健康度算法、Star 历史生成 | 高 |
| `backend/scraper.py` | GitHub Trending 页面解析 | 中 |
| `backend/tasks.py` | 定时任务调度 | 低 |
| `backend/models.py` | 数据存储层 | 低 |
| `frontend/src/api/api.js` | 前端 API 封装（含重试逻辑） | 中 |
| `frontend/src/index.css` | CSS 变量体系 & 全局样式 | 中 |
| `frontend/src/App.jsx` | 路由配置 & 主题 | 低 |

---

## 代码规范

### 前端规范

#### 组件结构

```jsx
// ✅ 推荐：清晰的组件结构
import React, { useState, useEffect } from 'react';
import { Button, Spin } from 'antd';
import { SomeIcon } from '@ant-design/icons';

const MyComponent = ({ data, onAction }) => {
  const [state, setState] = useState(initialValue);

  useEffect(() => {
    // 副作用逻辑
    return () => { /* 清理 */ };
  }, [deps]);

  const handleClick = () => {
    onAction(data);
  };

  if (!data) return <Spin />;

  return (
    <div className="my-component">
      <Button onClick={handleClick}>操作</Button>
    </div>
  );
};

export default MyComponent;
```

#### 样式规范

- 使用项目已有的 **CSS 变量**（定义在 `index.css`），不要硬编码颜色值
- 组件专属样式放在对应的 `.css` 文件中
- 内联样式仅用于动态值

```css
/* ✅ 使用 CSS 变量 */
.my-card {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-smooth);
}

/* ❌ 避免硬编码 */
.my-card {
  background: #ffffff;
  color: #1a1a2e;
}
```

#### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `RepositoryCard.jsx` |
| CSS 文件 | 与组件同名 | `RepositoryCard.css` |
| 工具函数 | camelCase | `getCachedData()` |
| 常量 | UPPER_SNAKE_CASE | `CACHE_PREFIX` |
| CSS 类名 | kebab-case | `.repo-card` |

### 后端规范

#### API 路由

```python
# ✅ 推荐：清晰的错误处理
@app.route('/api/example')
def example():
    param = request.args.get('param', '')
    if not param:
        return jsonify({'error': '参数不能为空'}), 400
    try:
        result = do_something(param)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

#### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 函数 | snake_case | `fetch_trending()` |
| 类 | PascalCase | `GitHubTrendingScraper` |
| 常量 | UPPER_SNAKE_CASE | `BASE_URL` |
| 私有方法 | `_` 前缀 | `_parse_migration_hint()` |

### Commit 规范

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

#### Type 类型

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: add repository comparison page` |
| `fix` | Bug 修复 | `fix: resolve card layout issue on mobile` |
| `style` | 样式调整 | `style: update card hover animation` |
| `refactor` | 代码重构 | `refactor: extract health scoring to separate module` |
| `docs` | 文档更新 | `docs: add API documentation` |
| `perf` | 性能优化 | `perf: add health score caching` |
| `test` | 测试相关 | `test: add scraper unit tests` |
| `chore` | 构建/工具 | `chore: update dependencies` |

#### Scope 范围（可选）

| Scope | 说明 |
|-------|------|
| `frontend` | 前端相关 |
| `backend` | 后端相关 |
| `api` | API 接口 |
| `ui` | UI 组件 |
| `config` | 配置相关 |

#### 示例

```bash
git commit -m "feat(frontend): add poster generator component"
git commit -m "fix(backend): handle GitHub API rate limit gracefully"
git commit -m "style(ui): improve card glass morphism effect"
git commit -m "docs: update README with architecture diagram"
```

---

## Pull Request 流程

### 分支命名

```
feature/<功能描述>    # 新功能
fix/<问题描述>        # Bug 修复
refactor/<重构内容>   # 代码重构
docs/<文档内容>       # 文档更新
```

示例：
- `feature/repo-health-badge`
- `fix/mobile-layout-overflow`
- `refactor/api-error-handling`

### PR 提交清单

在提交 PR 之前，请确认：

- [ ] 代码遵循项目规范
- [ ] 新功能有适当的注释说明
- [ ] 没有引入新的 lint 错误（运行 `npm run lint`）
- [ ] 前端构建成功（运行 `npm run build`）
- [ ] 后端服务正常启动（运行 `python app.py`）
- [ ] PR 标题符合 Conventional Commits 规范
- [ ] PR 描述清晰说明了改动内容和原因

### PR 描述模板

```markdown
## 改动类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 样式调整
- [ ] 代码重构
- [ ] 文档更新

## 改动说明
简要描述本次改动的目的和内容。

## 相关 Issue
Closes #123

## 截图（如适用）
| Before | After |
|--------|-------|
| ![before](url) | ![after](url) |

## 测试步骤
1. 步骤一
2. 步骤二
3. 预期结果
```

---

## 测试指南

### 后端测试

```bash
cd backend

# 测试爬虫功能
python test_scraper.py

# 测试 API 性能（需先启动后端服务）
python test_performance.py
```

### 前端测试

```bash
cd frontend

# 代码检查
npm run lint

# 构建检查
npm run build

# 预览构建结果
npm run preview
```

### 手动测试清单

在提交 PR 前，建议手动验证以下功能：

| 功能 | 验证点 |
|------|--------|
| 每日热点 | 数据正常加载、卡片渲染正确 |
| 每周热点 | 数据正常加载、与每日数据不同 |
| 上升趋势 | 数据正常加载、趋势图方向正确 |
| 下降趋势 | 下降原因标签显示正确 |
| 仓库搜索 | 搜索返回正确结果 |
| 仓库对比 | 两个仓库数据正确对比 |
| 我的雷达 | 关注/取消关注、波动告警 |
| 筛选功能 | 语言筛选、话题筛选 |
| 话题云 | 话题点击筛选 |
| 随机发现 | 随机抽取功能 |
| 海报生成 | Canvas 渲染、PNG 下载 |
| 数据导出 | Markdown/CSV/JSON/HTML 导出 |
| 手动刷新 | 刷新按钮、缓存更新 |
| 响应式布局 | 移动端/平板/桌面端适配 |

---

## 发布流程

1. 在 `main` 分支上确认所有测试通过
2. 更新版本号（如有需要）
3. 创建 Git Tag：`git tag v1.x.x`
4. 推送 Tag：`git push origin v1.x.x`
5. 在 GitHub Releases 页面创建发布说明

---

## 获取帮助

如果你在贡献过程中遇到任何问题，可以通过以下方式获取帮助：

- 在 **GitHub Issues** 中提问
- 查阅 [README.md](./README.md) 中的项目文档
- 查看现有代码中的注释和实现参考

---

再次感谢你的贡献！🎉