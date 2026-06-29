import os
from datetime import datetime, timedelta, timezone

USE_DATABASE = os.environ.get('USE_DATABASE', 'true').lower() in ('true', '1', 'yes')

try:
    from database import (
        init_db, add_repos_batch, get_repos_by_period as _db_get_repos,
        clear_repos_by_period as _db_clear_repos, save_snapshot as _db_save_snapshot,
        get_history as _db_get_history, get_snapshot_files as _db_get_snapshots,
        save_star_history as _db_save_star_history, get_star_history as _db_get_star_history,
        TrendingRepo, RepoSnapshot,
    )
    _HAS_DB = True
except ImportError:
    _HAS_DB = False
    USE_DATABASE = False


class DBStorage:
    def __init__(self):
        if _HAS_DB:
            init_db()

    def add_repo(self, repo_data):
        pass

    def add_repos_batch(self, repos_data, period):
        if _HAS_DB:
            add_repos_batch(repos_data, period)

    def get_repos_by_period(self, period):
        if _HAS_DB:
            return _db_get_repos(period)
        return []

    def clear_repos_by_period(self, period):
        if _HAS_DB:
            _db_clear_repos(period)

    def save_snapshot(self, period):
        if _HAS_DB:
            _db_save_snapshot(period)

    def get_history(self, repo_name, days=30):
        if _HAS_DB:
            return _db_get_history(repo_name, days)
        return []

    def get_snapshot_files(self, period):
        if _HAS_DB:
            return _db_get_snapshots(period)
        return []

    def save_star_history(self, repo_name, entries):
        if _HAS_DB:
            _db_save_star_history(repo_name, entries)

    def get_star_history(self, repo_name, days=365):
        if _HAS_DB:
            return _db_get_star_history(repo_name, days)
        return None


from models_legacy import MemoryStorage, HISTORY_DIR
storage_legacy = MemoryStorage()


class UnifiedStorage:
    def __init__(self):
        self._db = DBStorage() if USE_DATABASE else None

    def _use_db(self):
        return self._db is not None

    def add_repo(self, repo_data):
        storage_legacy.add_repo(repo_data)

    def add_repos_batch(self, repos_data, period):
        if self._use_db():
            self._db.add_repos_batch(repos_data, period)
        storage_legacy.clear_repos_by_period(period)
        for data in repos_data:
            storage_legacy.add_repo(data)

    def get_repos_by_period(self, period):
        if self._use_db():
            result = self._db.get_repos_by_period(period)
            if result:
                return result
        return storage_legacy.get_repos_by_period(period)

    def clear_repos_by_period(self, period):
        if self._use_db():
            self._db.clear_repos_by_period(period)
        storage_legacy.clear_repos_by_period(period)

    def save_snapshot(self, period):
        if self._use_db():
            self._db.save_snapshot(period)
        storage_legacy.save_snapshot(period)

    def get_history(self, repo_name, days=30):
        if self._use_db():
            result = self._db.get_history(repo_name, days)
            if result:
                return result
        return storage_legacy.get_history(repo_name, days)

    def get_snapshot_files(self, period):
        if _HAS_DB:
            result = self._db.get_snapshot_files(period)
            return result or []
        return []

    def save_star_history(self, repo_name, entries):
        if self._use_db():
            self._db.save_star_history(repo_name, entries)

    def get_star_history(self, repo_name, days=365):
        if self._use_db():
            return self._db.get_star_history(repo_name, days)
        return None


storage = UnifiedStorage()