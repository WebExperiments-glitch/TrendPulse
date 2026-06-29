import re
import os
import json
import random
import math
import threading
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

app = Flask(__name__)
# 允许所有 localhost/127.0.0.1 的任意端口（开发场景），生产环境应在反向代理处收敛来源
# flask-cors 6.x 使用 try_match_any_pattern，支持正则字符串
CORS(app, origins=[
    r'^https?://localhost(:\d+)?$',
    r'^https?://127\.0\.0\.1(:\d+)?$',
])
from models import storage, HISTORY_DIR
from tasks import start_scheduler
from scraper import GitHubTrendingScraper
from chaoss_health import compute_chaoss_health, CHAOSS_METRICS
from star_history import fetch_real_star_history

scheduler = start_scheduler()

GITHUB_API_HEADERS = {'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'GithubTrendingAnalyzer'}

VERSION = '0.1.0'
APP_NAME = 'TrendPulse'

def generate_star_history(current_stars, period, days=90):
    """根据当前星标数和趋势类型生成90天模拟历史数据"""
    rng = random.Random(hash(f"{current_stars}-{period}") % (2**31))
    history = []
    today = datetime.now()

    if period == 'rising':
        end_stars = current_stars
        start_stars = int(current_stars * 0.15)
    elif period == 'declining':
        end_stars = current_stars
        start_stars = int(current_stars * 1.3)
    else:
        end_stars = current_stars
        start_stars = max(100, int(current_stars * 0.4))

    base_growth = (end_stars - start_stars) / days

    for d in range(days):
        date = today - timedelta(days=days - 1 - d)
        progress = d / (days - 1) if days > 1 else 0

        if period == 'rising':
            growth_factor = 1 + 4 * progress**2
        elif period == 'declining':
            growth_factor = max(0.1, 1 - 1.5 * progress)
        else:
            growth_factor = 1 + 1.5 * progress * (0.7 + 0.3 * math.sin(progress * math.pi * 3))

        daily_noise = rng.gauss(0, abs(base_growth) * 0.15)
        base_val = start_stars + base_growth * d * growth_factor
        val = max(0, int(base_val + daily_noise + rng.randint(-5, 5)))

        history.append({
            'date': date.strftime('%Y-%m-%d'),
            'stars': val
        })

    if history:
        history[-1]['stars'] = current_stars

    return history

def _parse_migration_hint(readme_text):
    """从README前200行中检测迁移/弃用提示"""
    if not readme_text:
        return None
    lines = readme_text[:6000].split('\n')
    keywords = [
        'no longer maintained', 'deprecated', 'deprecation',
        'not maintained', 'archived', 'moved to', 'please use',
        'please switch', 'please migrate', 'use.*instead',
        'this project is no longer',
        'this repository is no longer',
        'successor', 'superseded by',
        '本项目不再维护', '已弃用', '请使用', '已迁移至',
        '不再更新', '已停止维护', '请转向',
    ]
    for i, line in enumerate(lines):
        line_lower = line.lower().strip()
        for kw in keywords:
            if kw in line_lower:
                return line.strip()[:200]
    return None

def _classify_decline_reason(repo_info, readme_text):
    """综合判定下降原因"""
    reasons = []
    if repo_info.get('archived'):
        reasons.append({'type': 'archived', 'label': '已归档', 'color': 'default'})
    if repo_info.get('pushed_at'):
        pushed = datetime.strptime(repo_info['pushed_at'], '%Y-%m-%dT%H:%M:%SZ')
        months_inactive = (datetime.now() - pushed).days // 30
        if months_inactive >= 6:
            reasons.append({'type': 'inactive', 'label': f'停更{months_inactive}个月', 'color': 'warning'})
        elif months_inactive >= 3:
            reasons.append({'type': 'slow', 'label': f'{months_inactive}个月未推送', 'color': 'processing'})
    hint = _parse_migration_hint(readme_text)
    if hint:
        reasons.append({'type': 'migration', 'label': hint[:50] + ('...' if len(hint) > 50 else ''), 'color': 'purple'})
    if not reasons:
        reasons.append({'type': 'natural', 'label': '自然回落', 'color': 'default'})
    return reasons

# 添加默认数据（优先使用真实GitHub数据）
def add_default_data():
    # 检查是否已有数据
    if len(storage.get_repos_by_period('daily')) == 0:
        # 尝试获取真实的daily趋势数据
        print("正在获取真实的GitHub每日趋势数据...")
        daily_repos = GitHubTrendingScraper.fetch_trending('daily')
        
        # 如果获取成功且有数据
        if len(daily_repos) > 0:
            print(f"成功获取 {len(daily_repos)} 个每日趋势仓库")
            for repo in daily_repos:
                storage.add_repo(repo)
        else:
            print("获取每日趋势数据失败，使用备用数据")
            # 使用备用数据
            default_daily = []
            for i in range(1, 51):
                default_daily.append({
                    'name': f'user/repo{i}',
                    'author': f'user{i}',
                    'repo_name': f'repo{i}',
                    'url': f'https://github.com/user/repo{i}',
                    'description': f'This is a sample repository #{i}',
                    'stars': 100000 - i * 1000,
                    'language': ['JavaScript', 'Python', 'Go', 'TypeScript', 'C++', 'Rust', 'Java', 'C#'][i % 8],
                    'topics': [],
                    'period': 'daily'
                })
            for repo in default_daily:
                storage.add_repo(repo)
    
    if len(storage.get_repos_by_period('weekly')) == 0:
        # 尝试获取真实的weekly趋势数据
        print("正在获取真实的GitHub每周趋势数据...")
        weekly_repos = GitHubTrendingScraper.fetch_trending('weekly')
        
        # 如果获取成功且有数据
        if len(weekly_repos) > 0:
            print(f"成功获取 {len(weekly_repos)} 个每周趋势仓库")
            for repo in weekly_repos:
                storage.add_repo(repo)
        else:
            print("获取每周趋势数据失败，使用备用数据")
            # 使用备用数据
            default_weekly = []
            for i in range(1, 51):
                default_weekly.append({
                    'name': f'user/repo{i}',
                    'author': f'user{i}',
                    'repo_name': f'repo{i}',
                    'url': f'https://github.com/user/repo{i}',
                    'description': f'This is a sample repository #{i}',
                    'stars': 100000 - i * 1000,
                    'language': ['JavaScript', 'Python', 'Go', 'TypeScript', 'C++', 'Rust', 'Java', 'C#'][i % 8],
                    'topics': [],
                    'period': 'weekly'
                })
            for repo in default_weekly:
                storage.add_repo(repo)

    if len(storage.get_repos_by_period('rising')) == 0:
        print("正在获取真实的上升趋势热点数据...")
        rising_repos = GitHubTrendingScraper.fetch_rising()

        if len(rising_repos) > 0:
            print(f"成功获取 {len(rising_repos)} 个上升趋势仓库")
            for repo in rising_repos:
                storage.add_repo(repo)
        else:
            print("获取上升趋势数据失败，使用备用数据")
            default_rising = []
            for i in range(1, 51):
                default_rising.append({
                    'name': f'user/trending-repo{i}',
                    'author': f'user{i}',
                    'repo_name': f'trending-repo{i}',
                    'url': f'https://github.com/user/trending-repo{i}',
                    'description': f'This is a rapidly growing repository #{i}',
                    'stars': 50000 - i * 500,
                    'language': ['Python', 'Rust', 'TypeScript', 'Go', 'Zig', 'Mojo', 'Swift', 'Kotlin'][i % 8],
                    'topics': [],
                    'period': 'rising'
                })
            for repo in default_rising:
                storage.add_repo(repo)

    if len(storage.get_repos_by_period('declining')) == 0:
        print("正在获取真实的下降趋势仓库数据...")
        declining_repos = GitHubTrendingScraper.fetch_declining()

        if len(declining_repos) > 0:
            print(f"成功获取 {len(declining_repos)} 个下降趋势仓库")
            for repo in declining_repos:
                storage.add_repo(repo)
        else:
            print("获取下降趋势数据失败，使用备用数据")
            default_declining = []
            for i in range(1, 51):
                default_declining.append({
                    'name': f'user/legacy-repo{i}',
                    'author': f'user{i}',
                    'repo_name': f'legacy-repo{i}',
                    'url': f'https://github.com/user/legacy-repo{i}',
                    'description': f'This is a legacy repository #{i} with declining activity',
                    'stars': 80000 - i * 800,
                    'language': ['C++', 'Java', 'PHP', 'Ruby', 'Perl', 'Objective-C', 'Scala', 'Haskell'][i % 8],
                    'topics': [],
                    'period': 'declining'
                })
            for repo in default_declining:
                storage.add_repo(repo)

# 添加默认数据
add_default_data()

@app.route('/api/version')
def get_version():
    return jsonify({'app': APP_NAME, 'version': VERSION})

@app.route('/api/trending/daily')
def get_daily():
    repos = storage.get_repos_by_period('daily')
    sorted_repos = sorted(repos, key=lambda x: x['stars'], reverse=True)
    return jsonify(sorted_repos[:50])

@app.route('/api/trending/weekly')
def get_weekly():
    repos = storage.get_repos_by_period('weekly')
    sorted_repos = sorted(repos, key=lambda x: x['stars'], reverse=True)
    return jsonify(sorted_repos[:50])

@app.route('/api/trending/rising')
def get_rising():
    repos = storage.get_repos_by_period('rising')
    sorted_repos = sorted(repos, key=lambda x: x['stars'], reverse=True)
    return jsonify(sorted_repos[:50])

@app.route('/api/trending/declining')
def get_declining():
    repos = storage.get_repos_by_period('declining')
    sorted_repos = sorted(repos, key=lambda x: x['stars'], reverse=True)
    return jsonify(sorted_repos[:50])

@app.route('/api/trending/hottest')
def get_hottest():
    all_repos = []
    seen = set()
    for period in ['daily', 'weekly', 'rising']:
        repos = storage.get_repos_by_period(period)
        for r in repos:
            name = r.get('name', '')
            if name and name not in seen:
                seen.add(name)
                all_repos.append(r)
    sorted_repos = sorted(all_repos, key=lambda x: x['stars'], reverse=True)
    return jsonify(sorted_repos[:50])

@app.route('/api/repo/star-history')
def get_star_history():
    current_stars = request.args.get('stars', 0, type=int)
    period = request.args.get('period', 'daily')
    days = request.args.get('days', 90, type=int)
    days = min(days, 365)
    repo = request.args.get('repo', '')

    if repo:
        try:
            real_history = fetch_real_star_history(repo, days)
            if real_history:
                return jsonify({
                    'history': real_history,
                    'source': 'star-history.com / GitHub API',
                    'count': len(real_history),
                })
        except Exception:
            pass

    history = generate_star_history(current_stars, period, days)
    return jsonify({'history': history, 'source': 'simulated', 'count': len(history)})


@app.route('/api/repo/real-star-history')
def get_real_star_history():
    repo = request.args.get('repo', '')
    days = request.args.get('days', 365, type=int)
    days = min(days, 730)
    if not repo:
        return jsonify({'error': '请提供 repo 参数'}), 400

    history = fetch_real_star_history(repo, days)
    if history:
        return jsonify({
            'repo': repo,
            'history': history,
            'source': 'star-history.com / GitHub API',
            'count': len(history),
        })
    return jsonify({'error': '无法获取真实 Star 历史', 'repo': repo}), 404

@app.route('/api/repo/detail')
def get_repo_detail():
    owner_repo = request.args.get('repo', '')
    if not owner_repo or '/' not in owner_repo:
        return jsonify({'error': '请提供 owner/repo 格式的仓库名'}), 400
    try:
        url = f'https://api.github.com/repos/{owner_repo}'
        headers = dict(GITHUB_API_HEADERS)
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return jsonify({'error': f'仓库不存在或API限制: {resp.status_code}'}), resp.status_code
        data = resp.json()
        return jsonify({
            'name': data.get('full_name', owner_repo),
            'stars': data.get('stargazers_count', 0),
            'language': data.get('language'),
            'description': data.get('description', ''),
            'archived': data.get('archived', False),
            'pushed_at': data.get('pushed_at'),
            'created_at': data.get('created_at'),
            'topics': data.get('topics', []),
            'forks': data.get('forks_count', 0),
            'open_issues': data.get('open_issues_count', 0),
        })
    except Exception as e:
        return jsonify({'error': f'请求失败: {str(e)}'}), 500

@app.route('/api/repo/readme')
def get_repo_readme():
    owner_repo = request.args.get('repo', '')
    if not owner_repo or '/' not in owner_repo:
        return jsonify({'error': '请提供 owner/repo 格式的仓库名'}), 400
    try:
        url = f'https://api.github.com/repos/{owner_repo}/readme'
        headers = {'Accept': 'application/vnd.github.v3.raw', 'User-Agent': 'GithubTrendingAnalyzer'}
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return jsonify({'content': ''})
        content = resp.text[:8000]
        return jsonify({'content': content})
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/compare')
def compare_repos():
    repo1 = request.args.get('repo1', '')
    repo2 = request.args.get('repo2', '')
    if not repo1 or not repo2:
        return jsonify({'error': '需要两个仓库名'}), 400
    try:
        headers = dict(GITHUB_API_HEADERS)
        data = {'repo1': None, 'repo2': None, 'error': None}
        for key, repo in [('repo1', repo1), ('repo2', repo2)]:
            url = f'https://api.github.com/repos/{repo}'
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                r = resp.json()
                data[key] = {
                    'name': r.get('full_name', repo),
                    'stars': r.get('stargazers_count', 0),
                    'language': r.get('language'),
                    'description': r.get('description', ''),
                    'archived': r.get('archived', False),
                    'pushed_at': r.get('pushed_at'),
                    'created_at': r.get('created_at'),
                    'forks': r.get('forks_count', 0),
                    'open_issues': r.get('open_issues_count', 0),
                }
            else:
                return jsonify({'error': f'仓库 {repo} 不存在或API限制'}), resp.status_code
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': f'请求失败: {str(e)}'}), 500

@app.route('/api/repo/insights')
def get_repo_insights():
    owner_repo = request.args.get('repo', '')
    if not owner_repo or '/' not in owner_repo:
        return jsonify({'error': '请提供 owner/repo 格式的仓库名'}), 400
    try:
        headers = dict(GITHUB_API_HEADERS)
        url = f'https://api.github.com/repos/{owner_repo}'
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return jsonify({'error': f'仓库不存在: {resp.status_code}'}), resp.status_code
        repo_info = resp.json()
        readme_url = f'https://api.github.com/repos/{owner_repo}/readme'
        readme_headers = {'Accept': 'application/vnd.github.v3.raw', 'User-Agent': 'GithubTrendingAnalyzer'}
        readme_resp = requests.get(readme_url, headers=readme_headers, timeout=10)
        readme_text = readme_resp.text[:8000] if readme_resp.status_code == 200 else ''
        reasons = _classify_decline_reason(repo_info, readme_text)
        return jsonify({
            'name': repo_info.get('full_name', owner_repo),
            'stars': repo_info.get('stargazers_count', 0),
            'archived': repo_info.get('archived', False),
            'pushed_at': repo_info.get('pushed_at'),
            'created_at': repo_info.get('created_at'),
            'language': repo_info.get('language'),
            'description': repo_info.get('description', ''),
            'reasons': reasons,
            'migration_hint': _parse_migration_hint(readme_text),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/repo/releases')
def get_repo_releases():
    owner_repo = request.args.get('repo', '')
    if not owner_repo or '/' not in owner_repo:
        return jsonify({'error': '请提供 owner/repo 格式的仓库名'}), 400
    try:
        url = f'https://api.github.com/repos/{owner_repo}/releases?per_page=5'
        headers = dict(GITHUB_API_HEADERS)
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return jsonify({'error': f'获取Releases失败: {resp.status_code}'}), resp.status_code
        data = resp.json()
        releases = [{
            'tag_name': r.get('tag_name', ''),
            'name': r.get('name') or r.get('tag_name', ''),
            'published_at': r.get('published_at'),
            'html_url': r.get('html_url'),
            'prerelease': r.get('prerelease', False),
            'body_preview': (r.get('body') or '')[:200],
        } for r in data[:5]]
        return jsonify(releases)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/search')
def search():
    keyword = request.args.get('q', '').strip()
    if not keyword:
        return jsonify([])
    
    # 输入验证
    if len(keyword) > 100:
        return jsonify({'error': '搜索关键词过长，请缩短后重试'}), 400
    
    # 调用GitHub Search API
    url = 'https://api.github.com/search/repositories'
    params = {'q': keyword, 'sort': 'stars', 'order': 'desc'}
    headers = dict(GITHUB_API_HEADERS)
    
    github_token = os.environ.get('GITHUB_TOKEN')
    if github_token:
        headers['Authorization'] = f'token {github_token}'
    
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=15)
        if resp.status_code == 200:
            items = resp.json().get('items', [])
            # 转换为统一格式
            result = []
            for item in items[:50]:  # 取前50条
                result.append({
                    'name': item['full_name'],
                    'author': item['owner']['login'],
                    'repo_name': item['name'],
                    'url': item['html_url'],
                    'description': item['description'],
                    'stars': item['stargazers_count'],
                    'language': item['language'],
                    'topics': item.get('topics', []),
                    'period': 'search'
                })
            return jsonify(result)
        elif resp.status_code == 403:
            return jsonify({'error': 'GitHub API rate limit exceeded'}), 403
        elif resp.status_code == 422:
            return jsonify({'error': '搜索关键词无效，请尝试其他关键词'}), 400
        else:
            return jsonify({'error': f'GitHub API error: {resp.status_code}'}), 500
    except requests.exceptions.RequestException as e:
        print(f"Error searching GitHub: {e}")
        # 搜索失败时返回空列表
        return jsonify([])
    except Exception as e:
        print(f"Unexpected error searching GitHub: {e}")
        # 搜索失败时返回空列表
        return jsonify([])

import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

_health_cache = {}
_health_cache_lock = threading.Lock()
_health_inflight = {}
_health_inflight_lock = threading.Lock()


def _get_cached_health(owner_repo):
    with _health_cache_lock:
        entry = _health_cache.get(owner_repo)
        if entry and (datetime.now(timezone.utc) - entry['ts']).total_seconds() < 3600:
            return entry['data']
    return None


def _set_cached_health(owner_repo, data):
    with _health_cache_lock:
        _health_cache[owner_repo] = {'data': data, 'ts': datetime.now(timezone.utc)}


def _fetch_repo_info(owner_repo):
    # 1) 命中缓存
    cached = _get_cached_health(owner_repo)
    if cached is not None:
        return cached

    # 2) 合并同 key 的并发请求：首个请求真正查 API，其余线程等待其结果
    with _health_inflight_lock:
        existing = _health_inflight.get(owner_repo)
        if existing is None:
            _health_inflight[owner_repo] = []
            creator = True
        else:
            creator = False
            event = threading.Event()
            slot = {'event': event, 'result': None}
            existing.append(slot)

    if not creator:
        event = slot['event']
        event.wait(timeout=15)
        return slot['result']

    # 3) 真正执行抓取
    try:
        result = _do_fetch_repo_info(owner_repo)
        # 把结果广播给所有等待的线程
        with _health_inflight_lock:
            waiters = _health_inflight.pop(owner_repo, [])
        for slot in waiters:
            slot['result'] = result
            slot['event'].set()
        return result
    except Exception:
        with _health_inflight_lock:
            waiters = _health_inflight.pop(owner_repo, [])
        for slot in waiters:
            slot['event'].set()
        return None
    finally:
        # 保险：极端情况下兜底清理
        with _health_inflight_lock:
            _health_inflight.pop(owner_repo, None)


def _do_fetch_repo_info(owner_repo):
    try:
        headers = dict(GITHUB_API_HEADERS)
        github_token = os.environ.get('GITHUB_TOKEN')
        if github_token:
            headers['Authorization'] = f'token {github_token}'

        url = f'https://api.github.com/repos/{owner_repo}'
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return None
        data = resp.json()

        stars = data.get('stargazers_count', 0)
        pushed_at = data.get('pushed_at', '')
        created_at = data.get('created_at', '')
        open_issues = data.get('open_issues_count', 0)
        forks = data.get('forks_count', 0)
        archived = data.get('archived', False)

        days_since_push = (datetime.now(timezone.utc) - datetime.strptime(pushed_at[:10], '%Y-%m-%d')).days if pushed_at else 999
        days_since_create = max((datetime.now(timezone.utc) - datetime.strptime(created_at[:10], '%Y-%m-%d')).days if created_at else 1, 1)

        activity = 100 if days_since_push < 7 else (80 if days_since_push < 30 else (55 if days_since_push < 90 else (30 if days_since_push < 180 else 10)))

        if stars > 50000:
            maturity = 100
        elif stars > 10000:
            maturity = 90
        elif stars > 5000:
            maturity = 80
        elif stars > 1000:
            maturity = 65
        elif stars > 100:
            maturity = 50
        elif stars > 10:
            maturity = 30
        else:
            maturity = 10

        if archived:
            maintenance = 0
        else:
            ratio = open_issues / max(stars + forks, 1)
            if ratio < 0.005:
                maintenance = 100
            elif ratio < 0.01:
                maintenance = 85
            elif ratio < 0.03:
                maintenance = 65
            elif ratio < 0.08:
                maintenance = 40
            else:
                maintenance = 15

        release_score = 50
        release_count = 0
        latest_release_date = None
        release_frequency_days = None
        days_since_release = None

        try:
            releases_url = f'https://api.github.com/repos/{owner_repo}/releases?per_page=5'
            releases_resp = requests.get(releases_url, headers=headers, timeout=10)
            if releases_resp.status_code == 200:
                releases = releases_resp.json()
                if releases:
                    release_count = len(releases)
                    latest_release_date = releases[0].get('published_at', '')
                    days_since_release = (datetime.now(timezone.utc) - datetime.strptime(latest_release_date[:10], '%Y-%m-%d')).days if latest_release_date else None
                    dates = sorted([r.get('published_at', '') for r in releases if r.get('published_at')], reverse=True)
                    if len(dates) >= 2:
                        first = datetime.strptime(dates[-1][:10], '%Y-%m-%d')
                        last = datetime.strptime(dates[0][:10], '%Y-%m-%d')
                        total_days = (last - first).days
                        release_frequency_days = round(total_days / (len(dates) - 1))

                    if days_since_release is not None:
                        if days_since_release < 30:
                            release_score = 95
                        elif days_since_release < 90:
                            release_score = 80
                        elif days_since_release < 180:
                            release_score = 60
                        elif days_since_release < 365:
                            release_score = 35
                        else:
                            release_score = 15

                    if release_frequency_days and release_frequency_days < 14:
                        release_score = min(100, release_score + 10)
                    elif release_frequency_days and release_frequency_days < 30:
                        release_score = min(100, release_score + 5)
                else:
                    release_score = 20
            elif releases_resp.status_code == 403:
                if days_since_push < 7:
                    release_score = 75
                elif days_since_push < 30:
                    release_score = 60
                elif days_since_push < 90:
                    release_score = 40
                elif days_since_push < 365:
                    release_score = 20
                else:
                    release_score = 10
        except Exception:
            if days_since_push < 7:
                release_score = 75
            elif days_since_push < 30:
                release_score = 60
            elif days_since_push < 90:
                release_score = 40
            elif days_since_push < 365:
                release_score = 20
            else:
                release_score = 10

        score = int(activity * 0.30 + maturity * 0.20 + maintenance * 0.20 + release_score * 0.30)

        if score >= 80:
            level = 'excellent'
        elif score >= 60:
            level = 'healthy'
        elif score >= 40:
            level = 'fair'
        else:
            level = 'at_risk'

        result = {
            'name': owner_repo, 'score': score, 'level': level,
            'days_since_push': days_since_push, 'archived': archived,
            'release_count': release_count, 'latest_release': latest_release_date,
            'release_frequency_days': release_frequency_days,
            'days_since_release': days_since_release,
            'activity_score': activity, 'maturity_score': maturity,
            'maintenance_score': maintenance, 'release_score': release_score,
        }
        _set_cached_health(owner_repo, result)
        return result
    except Exception:
        return None

@app.route('/api/repos/health', methods=['POST'])
def get_repos_health():
    data = request.get_json(silent=True) or {}
    repos = data.get('repos', [])
    if not repos or not isinstance(repos, list):
        return jsonify({'error': '请提供 repos 数组'}), 400
    repos = repos[:50]
    results = []
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(_fetch_repo_info, r): r for r in repos}
        for future in as_completed(futures):
            info = future.result()
            if info:
                results.append(info)
    result_map = {r['name']: r for r in results}
    return jsonify([result_map.get(r) for r in repos])

@app.route('/api/repo/history')
def get_repo_history():
    repo_name = request.args.get('repo', '')
    days = request.args.get('days', 30, type=int)
    if not repo_name:
        return jsonify({'error': '请提供 repo 参数'}), 400
    history = storage.get_history(repo_name, days=min(days, 90))
    return jsonify({'repo': repo_name, 'history': history, 'count': len(history)})

def _get_previous_snapshot_data(period):
    try:
        if not os.path.exists(HISTORY_DIR):
            return None
        files = sorted(
            [f for f in os.listdir(HISTORY_DIR) if f.startswith(f'{period}_') and f.endswith('.json')],
            reverse=True
        )
        if len(files) < 2:
            return None
        with open(os.path.join(HISTORY_DIR, files[1]), 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data.get('repos', [])
    except Exception:
        return None

def _get_snapshot_by_offset(period, days_ago, tolerance=2):
    try:
        if not os.path.exists(HISTORY_DIR):
            return None
        target_date = datetime.now() - timedelta(days=days_ago)
        target_str = target_date.strftime('%Y-%m-%d')
        files = [f for f in os.listdir(HISTORY_DIR)
                 if f.startswith(f'{period}_') and f.endswith('.json')]
        if not files:
            return None
        best = None
        best_diff = 999
        for fname in files:
            parts = fname.replace('.json', '').split('_')
            ts_str = '_'.join(parts[1:]) if len(parts) > 1 else ''
            if not ts_str:
                continue
            try:
                dt = datetime.strptime(ts_str, '%Y-%m-%dT%H-%M-%S')
                diff = abs((dt - target_date).days)
                if diff <= tolerance and diff < best_diff:
                    best_diff = diff
                    best = fname
            except ValueError:
                continue
        if not best:
            return None
        with open(os.path.join(HISTORY_DIR, best), 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data.get('repos', [])
    except Exception:
        return None

def _compute_repo_ranking(repos):
    ranking = {}
    for rank, repo in enumerate(repos, 1):
        name = repo.get('name', '')
        if name:
            ranking[name] = rank
    return ranking

def _compute_ranking(items):
    ranking = {}
    for rank, (topic, count) in enumerate(items, 1):
        ranking[topic] = rank
    return ranking

ENTRY_REASON_RULES = [
    {
        'name': 'security_cve',
        'check': lambda r: bool({'security', 'cve', 'vulnerability', 'exploit'} & set(t.lower() for t in (r.get('topics') or []))),
        'reason': '可能与最近的安全漏洞披露有关 🔐',
        'priority': 1,
    },
    {
        'name': 'mcp_agent',
        'check': lambda r: bool({'mcp', 'agent', 'agents', 'ai-agent'} & set(t.lower() for t in (r.get('topics') or []))),
        'reason': 'MCP / Agent 生态持续扩张 🤖',
        'priority': 2,
    },
    {
        'name': 'ai_art',
        'check': lambda r: bool(re.search(r'stable.diffusion|comfyui|midjourney|ai.art|image.generat', (r.get('description') or '').lower())),
        'reason': 'AI 绘画工具热度回升 🎨',
        'priority': 3,
    },
    {
        'name': 'llm_model',
        'check': lambda r: bool({'llm', 'large-language-model', 'gpt', 'chatgpt', 'transformer'} & set(t.lower() for t in (r.get('topics') or []))),
        'reason': '大语言模型赛道持续火热 🔥',
        'priority': 4,
    },
    {
        'name': 'famous_org',
        'check': lambda r: (r.get('author') or '').lower() in {'openai', 'anthropic', 'google', 'meta', 'facebook', 'microsoft', 'vercel', 'apple', 'nvidia', 'deepseek'},
        'reason': '知名组织新动作引发关注 🏢',
        'priority': 5,
    },
    {
        'name': 'rust_go',
        'check': lambda r: bool({'rust', 'golang', 'go', 'zig', 'c++'} & set(t.lower() for t in (r.get('topics') or []))),
        'reason': '系统编程语言生态持续活跃 ⚙️',
        'priority': 6,
    },
    {
        'name': 'star_surge',
        'check': lambda r: r.get('_growth_pct', 0) > 5,
        'reason': '爆发式增长，可能被社交媒体或技术博客推荐 🚀',
        'priority': 7,
    },
]

def _infer_entry_reasons(new_entries, sorted_repos, prev_repos):
    if not new_entries:
        return None

    repo_map = {r.get('name', ''): r for r in sorted_repos}
    results = []
    for name in new_entries[:10]:
        repo = repo_map.get(name)
        if not repo:
            continue

        for rule in sorted(ENTRY_REASON_RULES, key=lambda r_: r_['priority']):
            if rule['check'](repo):
                results.append({'name': name, 'reason': rule['reason']})
                break

    return results[:5] if results else None

def _compute_topic_pairs(repos, prev_repos=None):
    pair_counter = {}
    for repo in repos:
        topics = sorted(set(t.lower() for t in (repo.get('topics') or [])))
        for i in range(len(topics)):
            for j in range(i + 1, len(topics)):
                pair = (topics[i], topics[j])
                pair_counter[pair] = pair_counter.get(pair, 0) + 1
    pairs = sorted(pair_counter.items(), key=lambda x: -x[1])
    top_pairs = [(p, c) for p, c in pairs if c >= 2][:3]

    deltas = {}
    if prev_repos:
        prev_counter = {}
        for repo in prev_repos:
            topics = sorted(set(t.lower() for t in (repo.get('topics') or [])))
            for i_ in range(len(topics)):
                for j_ in range(i_ + 1, len(topics)):
                    pair = (topics[i_], topics[j_])
                    prev_counter[pair] = prev_counter.get(pair, 0) + 1
        for pair, count in top_pairs:
            prev_count = prev_counter.get(pair, 0)
            if prev_count > 0:
                deltas[pair] = count - prev_count

    if not top_pairs:
        return None
    return {'pairs': top_pairs, 'deltas': deltas}

def _find_hidden_gems(sorted_repos, prev_repos):
    if not prev_repos:
        return None
    prev_stars = {r.get('name', ''): r.get('stars', 0) for r in prev_repos}
    gems = []
    for rank, repo in enumerate(sorted_repos, 1):
        if rank <= 10:
            continue
        name = repo.get('name', '')
        prev = prev_stars.get(name)
        current = repo.get('stars', 0)
        if prev and prev > 0:
            growth = round((current - prev) / prev * 100, 1)
            if growth > 0:
                gems.append({'name': name, 'growth': growth, 'rank': rank, 'stars': current})
    gems.sort(key=lambda x: -x['growth'])
    return gems[:3] if gems else None

def _generate_summary(period, repos, top5, topic_top5, new_entries, dropped_entries, has_history,
                      prev_topic_ranking=None, new_entry_overlaps=None,
                      rank_changes=None, cross_chart_links=None,
                      entry_reasons=None, hidden_gems=None,
                      topic_pairs=None, tone='daily'):
    period_label = {
        'daily': '每日热点', 'weekly': '每周热点',
        'rising': '上升趋势', 'declining': '下降趋势',
    }.get(period, period)

    period_emoji = {
        'daily': '📅', 'weekly': '🔥',
        'rising': '🚀', 'declining': '📉',
    }.get(period, '📊')

    now = datetime.now().strftime('%Y年%m月%d日 %H:%M')

    lines = []

    if tone == 'minimal':
        lines.append(f'## {period_emoji} {period_label} · 速览')
        lines.append('')
        lines.append(f'> {now} ｜ {len(repos)} 个仓库')
        lines.append('')
        lines.append('### TOP 3')
        lines.append('')
        for i, repo in enumerate(top5[:3]):
            name = repo.get('name', '')
            lines.append(f'{i+1}. **[{name}](https://github.com/{name})** ⭐ {repo.get("stars", 0):,}')
        lines.append('')
        total_stars = sum(r.get('stars', 0) for r in repos)
        avg_stars = total_stars // max(len(repos), 1)
        lines.append(f'> 收录 {len(repos)} 个仓库，平均 ⭐ {avg_stars:,}。')
        lines.append('')
        lines.append('---')
        lines.append(f'> 🤖 极简模式 · 完整版请切换至日报模式')
        return '\n'.join(lines)

    if tone == 'roast':
        lines.append(f'## {period_emoji} {period_label} · 🐶 吐槽模式')
        lines.append('')
        lines.append(f'> 现在是 {now}，让我们看看又有什么「老面孔」赖着不走。')
        lines.append('')
        lines.append('---')
        lines.append('')
        lines.append('### 🏆 霸榜钉子户 TOP 5')
        lines.append('')
        for i, repo in enumerate(top5):
            name = repo.get('name', '')
            stars = repo.get('stars', 0)
            short = name.split('/')[-1] if '/' in name else name
            roast_lines = [
                f'**[{name}](https://github.com/{name})** ⭐ {stars:,} —— 它是不是买了终身置顶卡？',
                f'**[{name}](https://github.com/{name})** ⭐ {stars:,} —— 嘘，别告诉别人你还没 Star',
                f'**[{name}](https://github.com/{name})** ⭐ {stars:,} —— 又来了，这位老朋友',
                f'**[{name}](https://github.com/{name})** ⭐ {stars:,} —— 仓库 README 是不是写着「自动上榜」？',
                f'**[{name}](https://github.com/{name})** ⭐ {stars:,} —— 稳如老狗，awsome 榜钉子户',
            ]
            lines.append(roast_lines[i])
            lines.append('')
        lines.append('---')
        lines.append('')
        lines.append('### 🔥 大家都在卷什么')
        lines.append('')
        for topic, count in topic_top5[:3]:
            lines.append(f'- `{topic}`（{count} 次）—— 这个标签是批发来的吗？')
        lines.append('')

        if new_entries and len(new_entries) > 0:
            lines.append('### 🆕 终于来了几个新人')
            lines.append('')
            lines.append('榜单终于不是「老友记」了，来看看这些新鲜血液：')
            lines.append('')
            for name in new_entries[:5]:
                lines.append(f'- 🔹 [{name}](https://github.com/{name})—— 请保持住，别下期就跑了')
            lines.append('')

        if cross_chart_links:
            lines.append('### 🔗 串榜选手')
            lines.append('')
            for item in cross_chart_links[:3]:
                lines.append(f'- [{item["name"]}](https://github.com/{item["name"]}) 横跨多个榜单 —— 你是有分身术吗？')
            lines.append('')

        lines.append('---')
        lines.append('')
        lines.append(f'> 🐶 吐槽完毕。{len(repos)} 个仓库的榜单，该 Star 的还是要 Star 的～')
        lines.append(f'> 🤖 本总结由 GitHub Trending 分析助手自动生成 · 想正经一点？请切回日报模式')
        return '\n'.join(lines)

    lines.append(f'## {period_emoji} GitHub {period_label} · 趋势速览')
    lines.append('')
    lines.append(f'> 🕒 生成时间：{now} ｜ 收录仓库：{len(repos)} 个')
    lines.append('')

    lines.append('---')
    lines.append('')
    lines.append('### 🏆 本期 TOP 5')
    lines.append('')

    for i, repo in enumerate(top5):
        name = repo.get('name', '未知')
        stars = repo.get('stars', 0)
        desc = repo.get('description', '') or '（作者很懒，没有写描述 😴）'
        if len(desc) > 80:
            desc = desc[:77] + '...'
        lines.append(f'{["🥇","🥈","🥉","4️⃣","5️⃣"][i]} **[{name}](https://github.com/{name})**')
        lines.append(f'　　⭐ {stars:,} · {desc}')
        lines.append('')

    lines.append('---')
    lines.append('')
    lines.append('### 🔥 热门话题 Top 5')
    lines.append('')
    lines.append('| 话题 | 出现次数 | 热度条 |')
    lines.append('|------|---------|--------|')

    max_count = topic_top5[0][1] if topic_top5 else 1
    for topic, count in topic_top5:
        bar_len = max(1, int(count / max_count * 12))
        bar = '█' * bar_len + '░' * (12 - bar_len)
        lines.append(f'| `{topic}` | {count} 次 | {bar} |')

    if topic_top5:
        lines.append('')
        dominant = topic_top5[0]
        dominant_name = dominant[0]
        dominant_count = dominant[1]

        trend_suffix = ''
        if prev_topic_ranking is not None:
            prev_rank = prev_topic_ranking.get(dominant_name)
            if prev_rank is None:
                trend_suffix = f'，本期新晋热门话题榜首 ⚡（上期未进入 Top 5）'
            elif prev_rank == 1:
                trend_suffix = '，继续霸榜 🔥，稳坐第一把交椅'
            elif prev_rank == 2:
                trend_suffix = '，较上期上升 1 名 🚀，成功登顶'
            else:
                trend_suffix = f'，较上期上升 {prev_rank - 1} 名 🚀，从第 {prev_rank} 位跃居榜首'
        else:
            trend_suffix = '，看来社区最近都在关注这个方向呢～'

        lines.append(f'> 💡 本期最热门的话题是 **`{dominant_name}`**，'
                     f'出现在 {dominant_count} 个仓库中{trend_suffix}')

    if topic_pairs:
        lines.append('')
        lines.append('### 🧠 知识雷达（话题联动）')
        lines.append('')
        for pair, count in topic_pairs['pairs']:
            t1, t2 = pair
            delta = topic_pairs['deltas'].get(pair, None)
            if delta is not None and delta > 0:
                lines.append(f'> 🔗 `{t1}` + `{t2}` 共现 {count} 次，比上期增加 {delta} 次，'
                             f'这个组合正在成为新标配')
            elif delta is not None and delta < 0:
                lines.append(f'> 🔗 `{t1}` + `{t2}` 共现 {count} 次，比上期减少 {abs(delta)} 次，热度有所降温')
            else:
                lines.append(f'> 🔗 `{t1}` + `{t2}` 共现 {count} 次，是本期最紧密的技术搭档')

        lines.append('')

    lines.append('---')
    lines.append('')
    lines.append('### 📈 榜单变化（环比）')
    lines.append('')

    if not has_history:
        lines.append('> ℹ️ 暂无历史快照数据，这是首批记录。等下次更新后就能看到榜单变化啦～')
    elif new_entries is None or dropped_entries is None:
        lines.append('> ⚠️ 历史快照读取失败，暂时无法生成环比数据。别担心，数据都在，下次就好了～')
    elif not new_entries and not dropped_entries:
        lines.append('> 🎯 本期榜单与上期完全一致！看来这些仓库稳如泰山，江湖地位无人撼动。')
    else:
        if new_entries:
            lines.append(f'#### 🆕 新进榜（{len(new_entries)} 个）')
            lines.append('')
            lines.append('这些新面孔杀进了榜单，值得关注 👀：')
            lines.append('')
            for name in new_entries[:10]:
                lines.append(f'- 🔹 [{name}](https://github.com/{name})')
            if len(new_entries) > 10:
                lines.append(f'- ...还有 {len(new_entries) - 10} 个新仓库')
            lines.append('')

            if entry_reasons:
                lines.append('#### 💡 上榜原因推测')
                lines.append('')
                for item in entry_reasons[:4]:
                    name = item['name']
                    reason = item['reason']
                    lines.append(f'> 💡 **[{name}](https://github.com/{name})**：{reason}')
                lines.append('')

            if new_entry_overlaps:
                lines.append('#### 🔗 新进榜 × 热门话题 关联分析')
                lines.append('')
                for item in new_entry_overlaps[:3]:
                    name = item['name']
                    overlaps = item['topics']
                    topic_list = '、'.join(f'`{t}`' for t in overlaps)
                    lines.append(f'> 🔍 **[{name}](https://github.com/{name})** 的话题（{topic_list}）'
                                 f'与当前热门方向高度重合，它的上榜进一步强化了这个生态的热度～')
                lines.append('')

        if dropped_entries:
            lines.append(f'#### 📉 跌出榜（{len(dropped_entries)} 个）')
            lines.append('')
            lines.append('这些仓库暂时离开了视线，江湖路远，后会有期 👋：')
            lines.append('')
            for name in dropped_entries[:10]:
                lines.append(f'- 🔸 [{name}](https://github.com/{name})')
            if len(dropped_entries) > 10:
                lines.append(f'- ...还有 {len(dropped_entries) - 10} 个仓库')
            lines.append('')

        if new_entries and dropped_entries:
            if len(new_entries) > len(dropped_entries):
                lines.append(f'> 🎉 新面孔（{len(new_entries)} 个）多于离开的（{len(dropped_entries)} 个），榜单在注入新鲜血液！')
            elif len(new_entries) < len(dropped_entries):
                lines.append(f'> 🤔 本期 {len(dropped_entries)} 个仓库跌出榜单，只有 {len(new_entries)} 个新面孔补位，榜单有点「缩水」的感觉。')
            else:
                lines.append(f'> ⚖️ 进出平衡！{len(new_entries)} 进 {len(dropped_entries)} 出，榜单完成了新老交替。')

    has_rank_data = any(rc and (rc.get('risers') or rc.get('fallers')) for rc in (rank_changes or []))
    if has_rank_data:
        lines.append('')
        lines.append('---')
        lines.append('')
        lines.append('### ⏳ 排名深度对比')
        lines.append('')
        for rc in rank_changes:
            if rc is None:
                continue
            label = rc['label']
            risers = rc['risers']
            fallers = rc['fallers']
            if not risers and not fallers:
                continue
            lines.append(f'#### {label}')
            lines.append('')
            if risers:
                for r in risers[:4]:
                    name = r['name']
                    lines.append(f'- 🟢 **[{name}](https://github.com/{name})** 上升 {r["delta"]} 位'
                                 f'（{r["old_rank"]} → {r["cur_rank"]}），势头正猛')
            if fallers:
                for f_ in fallers[:4]:
                    name = f_['name']
                    lines.append(f'- 🔴 **[{name}](https://github.com/{name})** 下降 {abs(f_["delta"])} 位'
                                 f'（{f_["old_rank"]} → {f_["cur_rank"]}），热度回落')
            lines.append('')

        lines.append('> 📊 以上变化基于历史快照排名对比，只展示位移 ≥ 2 位的仓库。')

    if cross_chart_links:
        lines.append('')
        lines.append('---')
        lines.append('')
        lines.append('### 🔗 跨榜追踪')
        lines.append('')
        for item in cross_chart_links[:5]:
            name = item['name']
            charts = item['charts']
            chart_labels = {
                'daily': '每日热点', 'weekly': '每周热点',
                'rising': '上升趋势', 'declining': '下降趋势',
            }
            labels = [chart_labels.get(c, c) for c in charts if c != period]
            label_str = '、'.join(labels)
            lines.append(f'> 🔗 **[{name}](https://github.com/{name})** 同时出现在 **{label_str}** 中，'
                         f'跨榜热度值得持续追踪 👀')
        if cross_chart_links:
            lines.append('')

    if hidden_gems:
        lines.append('---')
        lines.append('')
        lines.append('### 🔭 暗流涌动')
        lines.append('')
        lines.append('这几颗新星虽然未进主榜前排，但增速惊人：')
        lines.append('')
        for gem in hidden_gems:
            name = gem['name']
            growth = gem['growth']
            lines.append(f'- 🚀 **[{name}](https://github.com/{name})** 日增 {growth}%'
                         f'（⭐ {gem["stars"]:,} · 排名 #{gem["rank"]}），低星高潜力')
        lines.append('')
        lines.append('> 🔭 以上仓库排名靠后但星星增速领跑，值得提前关注。')

    lines.append('---')
    lines.append('')
    lines.append('### 📝 一句话总结')
    lines.append('')

    total_stars = sum(r.get('stars', 0) for r in repos)
    avg_stars = total_stars // max(len(repos), 1)
    languages = list(set(r.get('language') for r in repos if r.get('language')))
    top_lang = max(set(languages), key=languages.count) if languages else '多种语言'

    if period == 'rising':
        mood = '上升势头很猛'
        emoji_mood = '🚀'
    elif period == 'declining':
        mood = '整体热度有所回落'
        emoji_mood = '🍂'
    else:
        mood = '社区依旧热闹非凡'
        emoji_mood = '✨'

    lines.append(f'> {emoji_mood} 本期 **{period_label}** 共收录 {len(repos)} 个仓库，'
                 f'平均 ⭐ {avg_stars:,}，主打语言为 **{top_lang}**。{mood}，'
                 f'感兴趣的话不妨挑几个 Star 一下～')

    lines.append('')
    lines.append('---')
    lines.append('')
    lines.append(f'> 🤖 本总结由 GitHub Trending 分析助手自动生成 · '
                 f'数据来源 [GitHub Trending](https://github.com/trending)')

    return '\n'.join(lines)

def _build_rank_changes(sorted_repos, prev_repos, label):
    """对比两个快照，计算排名变化"""
    current_ranking = _compute_repo_ranking(sorted_repos)
    prev_ranking = _compute_repo_ranking(prev_repos)

    risers = []
    fallers = []

    for name, cur_rank in current_ranking.items():
        old_rank = prev_ranking.get(name)
        if old_rank is not None:
            delta = old_rank - cur_rank  # positive means rising
            if abs(delta) >= 2:
                if delta > 0:
                    risers.append({'name': name, 'delta': delta, 'old_rank': old_rank, 'cur_rank': cur_rank})
                else:
                    fallers.append({'name': name, 'delta': delta, 'old_rank': old_rank, 'cur_rank': cur_rank})

    risers.sort(key=lambda x: -x['delta'])
    fallers.sort(key=lambda x: x['delta'])

    return {'label': label, 'risers': risers[:10], 'fallers': fallers[:10]}

@app.route('/api/summary')
def get_summary():
    period = request.args.get('period', 'daily')
    tone = request.args.get('tone', 'daily')
    if period not in ('daily', 'weekly', 'rising', 'declining'):
        return jsonify({'error': '无效的 period，可选: daily, weekly, rising, declining'}), 400
    if tone not in ('daily', 'roast', 'minimal'):
        tone = 'daily'

    repos = storage.get_repos_by_period(period)
    sorted_repos = sorted(repos, key=lambda x: x.get('stars', 0), reverse=True)

    top5 = sorted_repos[:5]

    topic_counter = {}
    for repo in repos:
        for topic in (repo.get('topics') or []):
            topic_counter[topic] = topic_counter.get(topic, 0) + 1
    topic_top5 = sorted(topic_counter.items(), key=lambda x: x[1], reverse=True)[:5]

    current_names = {r.get('name', '') for r in sorted_repos if r.get('name')}

    prev_repos = _get_previous_snapshot_data(period)
    has_history = prev_repos is not None

    new_entries = None
    dropped_entries = None
    prev_topic_ranking = None
    new_entry_overlaps = None
    entry_reasons = None
    hidden_gems = None
    topic_pairs = None

    if prev_repos is not None:
        prev_names = {r.get('name', '') for r in prev_repos if r.get('name')}
        new_entries = sorted([n for n in current_names if n and n not in prev_names])
        dropped_entries = sorted([n for n in prev_names if n and n not in current_names])

        prev_topic_counter = {}
        for r in prev_repos:
            for t in (r.get('topics') or []):
                prev_topic_counter[t] = prev_topic_counter.get(t, 0) + 1
        prev_topic_sorted = sorted(prev_topic_counter.items(), key=lambda x: x[1], reverse=True)[:5]
        if prev_topic_sorted:
            prev_topic_ranking = _compute_ranking(prev_topic_sorted)

        current_topic_set = {t for t, _ in topic_top5}
        if new_entries:
            new_entry_overlaps = []
            for name in new_entries[:10]:
                repo = next((r for r in sorted_repos if r.get('name') == name), None)
                if repo:
                    repo_topics = set(repo.get('topics') or [])
                    overlap = list(repo_topics & current_topic_set)
                    if overlap:
                        new_entry_overlaps.append({'name': name, 'topics': overlap})
            if not new_entry_overlaps:
                new_entry_overlaps = None

        entry_reasons = _infer_entry_reasons(new_entries, sorted_repos, prev_repos)
        hidden_gems = _find_hidden_gems(sorted_repos, prev_repos)
        topic_pairs = _compute_topic_pairs(repos, prev_repos)

    rank_changes = []
    for days_ago, label in [(7, '📆 周环比（较 7 天前）'), (30, '📅 月环比（较 30 天前）')]:
        snap = _get_snapshot_by_offset(period, days_ago)
        if snap:
            rc = _build_rank_changes(sorted_repos, snap, label)
            rank_changes.append(rc)
        else:
            rank_changes.append(None)

    other_periods = [p for p in ['daily', 'weekly', 'rising', 'declining'] if p != period]
    cross_chart_links = []
    for other_p in other_periods:
        other_repos = storage.get_repos_by_period(other_p)
        other_names = {r.get('name', '') for r in other_repos if r.get('name')}
        for name in current_names:
            if name and name in other_names:
                existing = next((c for c in cross_chart_links if c['name'] == name), None)
                if existing:
                    if other_p not in existing['charts']:
                        existing['charts'].append(other_p)
                else:
                    cross_chart_links.append({'name': name, 'charts': [other_p]})
    cross_chart_links.sort(key=lambda x: -len(x['charts']))
    if not cross_chart_links:
        cross_chart_links = None

    summary_md = _generate_summary(
        period, sorted_repos, top5, topic_top5,
        new_entries, dropped_entries, has_history,
        prev_topic_ranking, new_entry_overlaps,
        rank_changes, cross_chart_links,
        entry_reasons, hidden_gems,
        topic_pairs, tone
    )

    return jsonify({
        'period': period,
        'tone': tone,
        'summary': summary_md,
        'stats': {
            'total_repos': len(repos),
            'new_entries': len(new_entries) if new_entries else 0,
            'dropped_entries': len(dropped_entries) if dropped_entries else 0,
            'topic_top5': [{'name': t, 'count': c} for t, c in topic_top5],
            'has_history': has_history,
        }
    })

@app.route('/api/repos/chaoss-health', methods=['POST'])
def get_repos_chaoss_health():
    data = request.get_json(silent=True) or {}
    repos = data.get('repos', [])
    if not repos or not isinstance(repos, list):
        return jsonify({'error': '请提供 repos 数组'}), 400
    repos = repos[:50]
    results = []
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(compute_chaoss_health, r): r for r in repos}
        for future in as_completed(futures):
            info = future.result()
            if info:
                results.append(info)
    result_map = {r['name']: r for r in results}
    return jsonify({
        'framework': 'CHAOSS',
        'version': '0.1',
        'docs': 'https://chaoss.community/',
        'results': [result_map.get(r) for r in repos],
    })


@app.route('/api/chaoss/metrics', methods=['GET'])
def get_chaoss_metrics():
    return jsonify({
        'framework': 'CHAOSS',
        'description': 'CHAOSS (Community Health Analytics for Open Source Software) 社区驱动开源项目健康评估标准',
        'docs': 'https://chaoss.community/',
        'goal_question_metric': {
            'description': '采用目标-问题-指标(GQM)框架，确保每个评分维度有明确的目标和可验证的问题',
            'dimensions': {k: {
                'name': v['name'],
                'goal': v['goal'],
                'question': v['question'],
                'chaoss_ref': v['chaoss_ref'],
                'indicators': v['indicators'],
            } for k, v in CHAOSS_METRICS.items()},
        },
        'scoring': {
            'weights': {
                'activity': 0.25,
                'responsiveness': 0.20,
                'maturity': 0.20,
                'maintenance': 0.20,
                'inclusivity': 0.15,
            },
            'levels': {
                'excellent': {'min': 80, 'label': '优秀', 'color': '#389e0d'},
                'healthy': {'min': 60, 'label': '健康', 'color': '#52c41a'},
                'fair': {'min': 40, 'label': '一般', 'color': '#d48806'},
                'at_risk': {'min': 0, 'label': '风险', 'color': '#cf1322'},
            },
        },
    })


if __name__ == '__main__':
    # Start the Flask server
    app.run(host='0.0.0.0', port=5000, debug=False)