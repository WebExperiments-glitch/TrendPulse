import sys
sys.path.insert(0, '.')

import pytest
from chaoss_health import (
    _compute_activity_score,
    _compute_responsiveness_score,
    _compute_maturity_score,
    _compute_maintenance_score,
    _compute_inclusivity_score,
    CHAOSS_METRICS,
)


class TestActivityScore:
    def test_very_active_repo(self):
        score = _compute_activity_score(days_since_push=1, days_since_release=2, release_frequency_days=5)
        assert score >= 90

    def test_moderate_repo(self):
        score = _compute_activity_score(days_since_push=20, days_since_release=40, release_frequency_days=20)
        assert 60 <= score <= 90

    def test_inactive_repo(self):
        score = _compute_activity_score(days_since_push=200, days_since_release=400, release_frequency_days=None)
        assert score < 40

    def test_no_releases(self):
        score = _compute_activity_score(days_since_push=10, days_since_release=None, release_frequency_days=None)
        assert score > 0


class TestResponsivenessScore:
    def test_highly_responsive(self):
        score = _compute_responsiveness_score(
            days_since_push=3, release_frequency_days=7, open_issues_ratio=0.001
        )
        assert score >= 85

    def test_unresponsive(self):
        score = _compute_responsiveness_score(
            days_since_push=200, release_frequency_days=None, open_issues_ratio=0.2
        )
        assert score < 30


class TestMaturityScore:
    def test_very_mature(self):
        score = _compute_maturity_score(stars=100000, forks=5000, days_since_create=2000)
        assert score >= 90

    def test_new_project(self):
        score = _compute_maturity_score(stars=10, forks=2, days_since_create=15)
        assert score < 30


class TestMaintenanceScore:
    def test_archived_repo(self):
        score = _compute_maintenance_score(open_issues_ratio=0.01, archived=True, has_readme=True)
        assert score == 0

    def test_well_maintained(self):
        score = _compute_maintenance_score(open_issues_ratio=0.002, archived=False, has_readme=True)
        assert score >= 80

    def test_poorly_maintained(self):
        score = _compute_maintenance_score(open_issues_ratio=0.2, archived=False, has_readme=False)
        assert score < 30


class TestInclusivityScore:
    def test_fully_inclusive(self):
        score = _compute_inclusivity_score(
            has_contributing=True, has_license=True, has_code_of_conduct=True, topic_diversity=8
        )
        assert score >= 80

    def test_minimal(self):
        score = _compute_inclusivity_score(
            has_contributing=False, has_license=False, has_code_of_conduct=False, topic_diversity=0
        )
        assert score <= 40


class TestCHAOSSMetrics:
    def test_all_dimensions_defined(self):
        expected = {'activity', 'responsiveness', 'maturity', 'maintenance', 'inclusivity'}
        assert set(CHAOSS_METRICS.keys()) == expected

    def test_gqm_format(self):
        for key, dim in CHAOSS_METRICS.items():
            assert 'goal' in dim
            assert 'question' in dim
            assert 'chaoss_ref' in dim
            assert len(dim.get('indicators', [])) > 0