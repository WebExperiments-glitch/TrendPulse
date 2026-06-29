import sys
sys.path.insert(0, '.')

import pytest
import json
import os
from datetime import datetime, timedelta, timezone


class TestApp:
    def test_version_endpoint(self):
        from app import app
        with app.test_client() as client:
            resp = client.get('/api/version')
            assert resp.status_code == 200
            data = resp.get_json()
            assert data['app'] == 'TrendPulse'
            assert 'version' in data

    def test_chaoss_metrics_endpoint(self):
        from app import app
        with app.test_client() as client:
            resp = client.get('/api/chaoss/metrics')
            assert resp.status_code == 200
            data = resp.get_json()
            assert data['framework'] == 'CHAOSS'
            assert 'goal_question_metric' in data

    def test_health_post_requires_repos(self):
        from app import app
        with app.test_client() as client:
            resp = client.post('/api/repos/health', json={})
            assert resp.status_code == 400

    def test_chaoss_health_post_requires_repos(self):
        from app import app
        with app.test_client() as client:
            resp = client.post('/api/repos/chaoss-health', json={})
            assert resp.status_code == 400

    def test_compare_missing_params(self):
        from app import app
        with app.test_client() as client:
            resp = client.get('/api/compare')
            assert resp.status_code == 400


class TestDatabase:
    def test_db_import(self):
        try:
            from database import init_db, add_repos_batch, get_repos_by_period
            assert True
        except ImportError:
            pytest.skip("SQLAlchemy not installed")

    def test_init_db(self):
        try:
            from database import init_db, Base, engine
            init_db()
            assert True
        except ImportError:
            pytest.skip("SQLAlchemy not installed")

    def test_add_and_get_repos(self):
        try:
            from database import init_db, add_repos_batch, get_repos_by_period, clear_repos_by_period
            init_db()

            sample = [{
                'name': 'test/repo',
                'author': 'test',
                'repo_name': 'repo',
                'url': 'https://github.com/test/repo',
                'description': 'Test repo',
                'stars': 100,
                'forks': 10,
                'language': 'Python',
                'topics': ['test'],
                'pushed_at': '2026-01-01T00:00:00Z',
                'created_at': '2024-01-01T00:00:00Z',
                'open_issues': 5,
            }]
            add_repos_batch(sample, 'test_period')
            repos = get_repos_by_period('test_period')
            assert len(repos) == 1
            assert repos[0]['name'] == 'test/repo'

            clear_repos_by_period('test_period')
            repos = get_repos_by_period('test_period')
            assert len(repos) == 0
        except ImportError:
            pytest.skip("SQLAlchemy not installed")


class TestStarHistory:
    def test_star_history_import(self):
        try:
            from star_history import fetch_real_star_history
            assert True
        except ImportError:
            pytest.skip("requests not installed")

    def test_star_history_cached(self):
        try:
            from star_history import _star_history_cache, _get_cached_star_history
            assert isinstance(_star_history_cache, dict)
        except ImportError:
            pytest.skip("star_history not available")