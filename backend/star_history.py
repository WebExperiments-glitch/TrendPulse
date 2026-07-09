import requests
from datetime import datetime, timezone, timedelta
import os


STAR_HISTORY_API = 'https://star-history.com/api/star-history'


def fetch_real_star_history(repo_name, days=365):
    token = os.environ.get('GITHUB_TOKEN', '')
    headers = {'Accept': 'application/json'}
    # 仅在 token 存在时附加 Authorization 头，避免空 Bearer 头
    if token:
        headers['Authorization'] = f'Bearer {token}'

    cached = _get_cached_star_history(repo_name, days)
    if cached:
        return cached

    try:
        stars_url = f'https://api.github.com/repos/{repo_name}'
        stars_resp = requests.get(stars_url, headers=headers, timeout=10)
        if stars_resp.status_code != 200:
            return None
        current_stars = stars_resp.json().get('stargazers_count', 0)

        from database import get_star_history as db_get_star_history, save_star_history
        db_history = db_get_star_history(repo_name, days)
        if db_history:
            _star_history_cache[repo_name] = {'ts': time.time(), 'data': db_history}
            return db_history

        history_url = f'{STAR_HISTORY_API}/{repo_name}'
        history_resp = requests.get(history_url, headers=headers, timeout=15)

        if history_resp.status_code == 200:
            data = history_resp.json()
            entries = []
            for point in data:
                if isinstance(point, dict):
                    date_val = point.get('date', point.get('starredAt', ''))
                    star_val = point.get('starNum', point.get('stars', 0))
                elif isinstance(point, list) and len(point) >= 2:
                    date_val, star_val = point[0], point[1]
                else:
                    continue

                if isinstance(date_val, str):
                    date_str = date_val[:10]
                elif isinstance(date_val, (int, float)):
                    date_str = datetime.fromtimestamp(date_val / 1000, tz=timezone.utc).strftime('%Y-%m-%d')
                else:
                    continue

                entries.append({'date': date_str, 'stars': int(star_val), 'source': 'star-history'})

            if entries:
                save_star_history(repo_name, entries)
                _star_history_cache[repo_name] = {'ts': time.time(), 'data': entries}
                cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime('%Y-%m-%d')
                return [e for e in entries if e['date'] >= cutoff]

        entries = _fetch_from_github_events(repo_name, current_stars, days, headers)
        if entries:
            save_star_history(repo_name, entries)
            _star_history_cache[repo_name] = {'ts': time.time(), 'data': entries}
            return entries

        return None

    except Exception:
        return None


def _fetch_from_github_events(repo_name, current_stars, days, headers):
    entries = []
    today = datetime.now(timezone.utc)
    try:
        per_page = 100
        for page in range(1, 4):
            url = f'https://api.github.com/repos/{repo_name}/stargazers'
            params = {
                'per_page': per_page,
                'page': page,
            }
            stargazers_headers = dict(headers)
            stargazers_headers['Accept'] = 'application/vnd.github.v3.star+json'
            resp = requests.get(url, headers=stargazers_headers, params=params, timeout=15)

            if resp.status_code == 403:
                continue
            if resp.status_code != 200:
                break

            stargazers = resp.json()
            if not stargazers:
                break

            for sg in stargazers:
                starred_at = sg.get('starred_at', '')
                if starred_at:
                    date_str = starred_at[:10]
                    entry_date = datetime.strptime(date_str, '%Y-%m-%d').replace(tzinfo=timezone.utc)
                    if entry_date >= today - timedelta(days=days):
                        entries.append({'date': date_str, 'stars': 0, 'source': 'github_stargazers'})

            if len(stargazers) < per_page:
                break

    except Exception:
        pass

    if not entries:
        return None

    entries.sort(key=lambda x: x['date'])
    cumulative = 0
    from collections import defaultdict
    daily_counts = defaultdict(int)
    for e in entries:
        daily_counts[e['date']] += 1

    result = []
    # 当拉取的 stargazers 数量超过 current_stars 时，起点不能为负
    running = max(0, current_stars - sum(daily_counts.values()))
    sorted_dates = sorted(daily_counts.keys())
    for d in sorted_dates:
        running += daily_counts[d]
        result.append({'date': d, 'stars': running, 'source': 'github_stargazers'})

    return result


_star_history_cache = {}


def _get_cached_star_history(repo_name, days):
    import threading
    import time as _time
    entry = _star_history_cache.get(repo_name)
    if entry and _time.time() - entry['ts'] < 3600:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime('%Y-%m-%d')
        return [e for e in entry['data'] if e['date'] >= cutoff]
    return None