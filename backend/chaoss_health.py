import requests
import os
from datetime import datetime, timezone

GITHUB_API_HEADERS = {'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TrendPulse-CHAOSS'}


CHAOSS_METRICS = {
    'activity': {
        'name': '活跃度 (Activity)',
        'goal': '评估项目是否保持持续的开发活动',
        'question': '项目最近有活跃的代码提交和版本发布吗？',
        'chaoss_ref': 'https://chaoss.community/metric-activity-dates-and-times/',
        'indicators': ['days_since_push', 'days_since_release', 'release_frequency'],
    },
    'responsiveness': {
        'name': '响应速度 (Responsiveness)',
        'goal': '评估项目维护者对问题和更新的响应速度',
        'question': '项目维护者响应 Issue 和发布新版本的速度快吗？',
        'chaoss_ref': 'https://chaoss.community/metric-issue-response-time/',
        'indicators': ['days_since_push', 'release_frequency', 'open_issues_ratio'],
    },
    'maturity': {
        'name': '成熟度 (Maturity)',
        'goal': '评估项目的社区规模和项目生命周期',
        'question': '项目有足够的社区基础和项目寿命吗？',
        'chaoss_ref': 'https://chaoss.community/metric-contributors/',
        'indicators': ['stargazers_count', 'forks_count', 'days_since_create'],
    },
    'maintenance': {
        'name': '维护质量 (Maintenance)',
        'goal': '评估项目的维护健康度和问题管理状况',
        'question': '项目的 Issue/PR 积压情况和代码库维护状态如何？',
        'chaoss_ref': 'https://chaoss.community/metric-issues-active/',
        'indicators': ['open_issues_ratio', 'archived', 'has_readme'],
    },
    'inclusivity': {
        'name': '社区包容性 (Inclusivity)',
        'goal': '评估项目对新贡献者的友好程度和治理透明度',
        'question': '项目有多容易被新贡献者发现并参与？',
        'chaoss_ref': 'https://chaoss.community/metric-contributing/',
        'indicators': ['has_contributing', 'has_license', 'has_code_of_conduct', 'topic_diversity'],
    },
}


def _score_by_threshold(value, thresholds):
    for threshold, score in thresholds:
        if value <= threshold:
            return score
    return thresholds[-1][1]


def _score_by_min_threshold(value, thresholds):
    for threshold, score in reversed(thresholds):
        if value >= threshold:
            return score
    return thresholds[0][1]


def _compute_activity_score(days_since_push, days_since_release, release_frequency_days):
    push_score = _score_by_threshold(days_since_push, [
        (7, 100), (14, 90), (30, 75), (90, 50), (180, 25), (float('inf'), 10),
    ])

    if days_since_release is not None:
        release_score = _score_by_threshold(days_since_release, [
            (14, 100), (30, 90), (90, 65), (180, 40), (365, 20), (float('inf'), 10),
        ])
    elif days_since_push:
        release_score = max(10, push_score - 15)
    else:
        release_score = 10

    freq_bonus = 0
    if release_frequency_days is not None:
        if release_frequency_days <= 7:
            freq_bonus = 15
        elif release_frequency_days <= 14:
            freq_bonus = 10
        elif release_frequency_days <= 30:
            freq_bonus = 5

    return min(100, int(push_score * 0.5 + release_score * 0.5 + freq_bonus))


def _compute_responsiveness_score(days_since_push, release_frequency_days, open_issues_ratio):
    push_score = _score_by_threshold(days_since_push, [
        (7, 100), (14, 90), (30, 70), (90, 45), (180, 20), (float('inf'), 5),
    ])

    issue_score = _score_by_threshold(open_issues_ratio, [
        (0.005, 100), (0.01, 85), (0.03, 65), (0.08, 40), (0.15, 20), (float('inf'), 10),
    ])

    freq_bonus = 0
    if release_frequency_days is not None and release_frequency_days <= 30:
        freq_bonus = 10

    return min(100, int(push_score * 0.45 + issue_score * 0.45 + freq_bonus))


def _compute_maturity_score(stars, forks, days_since_create):
    star_score = _score_by_min_threshold(stars, [
        (10, 10), (100, 25), (1000, 45), (5000, 65), (10000, 80), (50000, 90), (100000, 100),
    ])

    fork_score = _score_by_min_threshold(forks, [
        (5, 10), (20, 25), (100, 45), (500, 65), (2000, 80), (10000, 90), (20000, 100),
    ])

    age_score = _score_by_min_threshold(days_since_create, [
        (30, 5), (90, 15), (180, 35), (365, 55), (365 * 3, 80), (365 * 5, 95), (365 * 10, 100),
    ])

    return min(100, int(star_score * 0.5 + fork_score * 0.25 + age_score * 0.25))


def _compute_maintenance_score(open_issues_ratio, archived, has_readme):
    if archived:
        return 0

    issue_score = _score_by_threshold(open_issues_ratio, [
        (0.005, 100), (0.01, 85), (0.03, 65), (0.08, 40), (0.15, 20), (float('inf'), 10),
    ])

    doc_bonus = 10 if has_readme else 0

    return min(100, int(issue_score * 0.9 + doc_bonus))


def _compute_inclusivity_score(has_contributing, has_license, has_code_of_conduct, topic_diversity):
    # 基础分 0：避免空仓库也能拿分
    score = 0
    if has_contributing:
        score += 25
    if has_license:
        score += 25
    if has_code_of_conduct:
        score += 10
    if topic_diversity:
        score += min(10, int(topic_diversity * 2))
    return min(100, score)


def _check_repo_files(owner_repo, headers):
    result = {'has_contributing': False, 'has_license': False, 'has_code_of_conduct': False}
    try:
        base_url = f'https://api.github.com/repos/{owner_repo}/contents'
        for filename, key in [
            ('CONTRIBUTING.md', 'has_contributing'),
            ('CONTRIBUTING', 'has_contributing'),
        ]:
            resp = requests.get(f'{base_url}/{filename}', headers=headers, timeout=5)
            if resp.status_code == 200:
                result[key] = True
                break

        for filename, key in [
            ('LICENSE', 'has_license'),
            ('LICENSE.md', 'has_license'),
            ('LICENCE', 'has_license'),
            ('LICENCE.md', 'has_license'),
        ]:
            resp = requests.get(f'{base_url}/{filename}', headers=headers, timeout=5)
            if resp.status_code == 200:
                result[key] = True
                break

        for filename, key in [
            ('CODE_OF_CONDUCT.md', 'has_code_of_conduct'),
            ('CODEOFCONDUCT.md', 'has_code_of_conduct'),
        ]:
            resp = requests.get(f'{base_url}/{filename}', headers=headers, timeout=5)
            if resp.status_code == 200:
                result[key] = True
                break

    except Exception:
        pass
    return result


def compute_chaoss_health(owner_repo, repo_data=None):
    headers = dict(GITHUB_API_HEADERS)
    github_token = os.environ.get('GITHUB_TOKEN')
    if github_token:
        headers['Authorization'] = f'token {github_token}'

    if repo_data is None:
        try:
            url = f'https://api.github.com/repos/{owner_repo}'
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code != 200:
                return None
            repo_data = resp.json()
        except Exception:
            return None

    stars = repo_data.get('stargazers_count', 0)
    forks = repo_data.get('forks_count', 0)
    pushed_at = repo_data.get('pushed_at', '')
    created_at = repo_data.get('created_at', '')
    open_issues = repo_data.get('open_issues_count', 0)
    archived = repo_data.get('archived', False)
    topics = repo_data.get('topics', [])
    has_readme = bool(repo_data.get('description', ''))

    now = datetime.now(timezone.utc)
    # strptime 返回的是 naive datetime，需要补上 UTC 时区才能与 now 相减
    days_since_push = (now - datetime.strptime(pushed_at[:10], '%Y-%m-%d').replace(tzinfo=timezone.utc)).days if pushed_at else 999
    days_since_create = max((now - datetime.strptime(created_at[:10], '%Y-%m-%d').replace(tzinfo=timezone.utc)).days if created_at else 1, 1)

    total = max(stars + forks, 1)
    open_issues_ratio = open_issues / total

    release_count = 0
    days_since_release = None
    release_frequency_days = None
    latest_release_date = None

    try:
        releases_url = f'https://api.github.com/repos/{owner_repo}/releases?per_page=5'
        releases_resp = requests.get(releases_url, headers=headers, timeout=10)
        if releases_resp.status_code == 200:
            releases = releases_resp.json()
            if releases:
                release_count = len(releases)
                latest_release_date = releases[0].get('published_at', '')
                if latest_release_date:
                    days_since_release = (now - datetime.strptime(latest_release_date[:10], '%Y-%m-%d').replace(tzinfo=timezone.utc)).days
                dates = sorted([r.get('published_at', '') for r in releases if r.get('published_at')], reverse=True)
                if len(dates) >= 2:
                    first = datetime.strptime(dates[-1][:10], '%Y-%m-%d')
                    last = datetime.strptime(dates[0][:10], '%Y-%m-%d')
                    total_days = (last - first).days
                    if total_days > 0:
                        release_frequency_days = round(total_days / (len(dates) - 1))
    except Exception:
        pass

    file_checks = _check_repo_files(owner_repo, headers)

    topic_diversity = min(10, len(topics)) if topics else 0

    activity = _compute_activity_score(days_since_push, days_since_release, release_frequency_days)
    responsiveness = _compute_responsiveness_score(days_since_push, release_frequency_days, open_issues_ratio)
    maturity = _compute_maturity_score(stars, forks, days_since_create)
    maintenance = _compute_maintenance_score(open_issues_ratio, archived, has_readme)
    inclusivity = _compute_inclusivity_score(
        file_checks['has_contributing'],
        file_checks['has_license'],
        file_checks['has_code_of_conduct'],
        topic_diversity
    )

    weights = {
        'activity': 0.25,
        'responsiveness': 0.20,
        'maturity': 0.20,
        'maintenance': 0.20,
        'inclusivity': 0.15,
    }

    overall = int(
        activity * weights['activity'] +
        responsiveness * weights['responsiveness'] +
        maturity * weights['maturity'] +
        maintenance * weights['maintenance'] +
        inclusivity * weights['inclusivity']
    )

    if overall >= 80:
        level = 'excellent'
    elif overall >= 60:
        level = 'healthy'
    elif overall >= 40:
        level = 'fair'
    else:
        level = 'at_risk'

    return {
        'name': owner_repo,
        'score': overall,
        'level': level,
        'framework': 'CHAOSS',
        'dimensions': {
            'activity': {
                'name': CHAOSS_METRICS['activity']['name'],
                'score': activity,
                'weight': weights['activity'],
                'goal': CHAOSS_METRICS['activity']['goal'],
                'question': CHAOSS_METRICS['activity']['question'],
                'chaoss_ref': CHAOSS_METRICS['activity']['chaoss_ref'],
                'details': {
                    'days_since_push': days_since_push,
                    'days_since_release': days_since_release,
                    'release_frequency_days': release_frequency_days,
                },
            },
            'responsiveness': {
                'name': CHAOSS_METRICS['responsiveness']['name'],
                'score': responsiveness,
                'weight': weights['responsiveness'],
                'goal': CHAOSS_METRICS['responsiveness']['goal'],
                'question': CHAOSS_METRICS['responsiveness']['question'],
                'chaoss_ref': CHAOSS_METRICS['responsiveness']['chaoss_ref'],
                'details': {
                    'days_since_push': days_since_push,
                    'release_frequency_days': release_frequency_days,
                    'open_issues_ratio': round(open_issues_ratio, 4),
                },
            },
            'maturity': {
                'name': CHAOSS_METRICS['maturity']['name'],
                'score': maturity,
                'weight': weights['maturity'],
                'goal': CHAOSS_METRICS['maturity']['goal'],
                'question': CHAOSS_METRICS['maturity']['question'],
                'chaoss_ref': CHAOSS_METRICS['maturity']['chaoss_ref'],
                'details': {
                    'stars': stars,
                    'forks': forks,
                    'days_since_create': days_since_create,
                },
            },
            'maintenance': {
                'name': CHAOSS_METRICS['maintenance']['name'],
                'score': maintenance,
                'weight': weights['maintenance'],
                'goal': CHAOSS_METRICS['maintenance']['goal'],
                'question': CHAOSS_METRICS['maintenance']['question'],
                'chaoss_ref': CHAOSS_METRICS['maintenance']['chaoss_ref'],
                'details': {
                    'open_issues_ratio': round(open_issues_ratio, 4),
                    'archived': archived,
                    'has_readme': has_readme,
                },
            },
            'inclusivity': {
                'name': CHAOSS_METRICS['inclusivity']['name'],
                'score': inclusivity,
                'weight': weights['inclusivity'],
                'goal': CHAOSS_METRICS['inclusivity']['goal'],
                'question': CHAOSS_METRICS['inclusivity']['question'],
                'chaoss_ref': CHAOSS_METRICS['inclusivity']['chaoss_ref'],
                'details': {
                    'has_contributing': file_checks['has_contributing'],
                    'has_license': file_checks['has_license'],
                    'has_code_of_conduct': file_checks['has_code_of_conduct'],
                    'topic_diversity': topic_diversity,
                },
            },
        },
        'meta': {
            'days_since_push': days_since_push,
            'archived': archived,
            'release_count': release_count,
            'latest_release': latest_release_date,
            'release_frequency_days': release_frequency_days,
            'days_since_release': days_since_release,
        },
    }