from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, JSON, Boolean, func
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, scoped_session
from datetime import datetime, timedelta, timezone
import os
import sys
import threading
import json

if getattr(sys, 'frozen', False):
    # Packaged as an exe: keep the SQLite DB in a persistent, writable location.
    _data_dir = os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'TrendPulse')
    os.makedirs(_data_dir, exist_ok=True)
    DATABASE_URL = os.environ.get('DATABASE_URL') or f'sqlite:///{os.path.join(_data_dir, "trendpulse.db")}'
else:
    DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///trendpulse.db')

engine = create_engine(
    DATABASE_URL,
    connect_args={'check_same_thread': False} if 'sqlite' in DATABASE_URL else {},
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))
Base = declarative_base()
_db_lock = threading.RLock()


class TrendingRepo(Base):
    __tablename__ = 'trending_repos'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), index=True, nullable=False)
    author = Column(String(255))
    repo_name = Column(String(255))
    url = Column(String(512))
    description = Column(Text, default='')
    stars = Column(Integer, default=0)
    forks = Column(Integer, default=0)
    language = Column(String(100), default='Unknown')
    topics = Column(JSON, default=list)
    period = Column(String(50), index=True, nullable=False)
    pushed_at = Column(String(50), default='')
    created_at = Column(String(50), default='')
    open_issues = Column(Integer, default=0)
    extra = Column(JSON, default=dict)
    fetched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    rank = Column(Integer, default=0)


class RepoSnapshot(Base):
    __tablename__ = 'repo_snapshots'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), index=True, nullable=False)
    period = Column(String(50), index=True, nullable=False)
    stars = Column(Integer, default=0)
    language = Column(String(100))
    description = Column(Text, default='')
    url = Column(String(512))
    author = Column(String(255))
    topics = Column(JSON, default=list)
    snapshot_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class StarHistory(Base):
    __tablename__ = 'star_history'

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_name = Column(String(255), index=True, nullable=False)
    date = Column(String(10), index=True, nullable=False)
    stars = Column(Integer, default=0)
    source = Column(String(50), default='github_api')


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    return SessionLocal()


def add_repos_batch(repos_data, period):
    with _db_lock:
        db = SessionLocal()
        try:
            db.query(TrendingRepo).filter(TrendingRepo.period == period).delete()

            for rank, data in enumerate(repos_data, 1):
                repo = TrendingRepo(
                    name=data.get('name', ''),
                    author=data.get('author', ''),
                    repo_name=data.get('repo_name', ''),
                    url=data.get('url', ''),
                    description=data.get('description', '') or '',
                    stars=data.get('stars', 0),
                    forks=data.get('forks', 0),
                    language=data.get('language', 'Unknown') or 'Unknown',
                    topics=data.get('topics', []),
                    period=period,
                    pushed_at=data.get('pushed_at', ''),
                    created_at=data.get('created_at', ''),
                    open_issues=data.get('open_issues', 0),
                    extra=data.get('extra', {}),
                    rank=rank,
                    fetched_at=datetime.now(timezone.utc),
                )
                db.add(repo)

            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()


def get_repos_by_period(period):
    db = SessionLocal()
    try:
        repos = db.query(TrendingRepo).filter(
            TrendingRepo.period == period
        ).order_by(TrendingRepo.rank.asc()).all()

        return [{
            'id': r.id,
            'name': r.name,
            'author': r.author,
            'repo_name': r.repo_name,
            'url': r.url,
            'description': r.description,
            'stars': r.stars,
            'forks': r.forks,
            'language': r.language,
            'topics': r.topics,
            'period': r.period,
            'pushed_at': r.pushed_at,
            'created_at': r.created_at,
            'open_issues': r.open_issues,
            'extra': r.extra,
            'fetched_at': r.fetched_at.isoformat() if r.fetched_at else None,
            'rank': r.rank,
        } for r in repos]
    finally:
        db.close()


def save_snapshot(period):
    with _db_lock:
        db = SessionLocal()
        try:
            repos = db.query(TrendingRepo).filter(
                TrendingRepo.period == period
            ).all()

            if not repos:
                return

            now = datetime.now(timezone.utc)
            for r in repos:
                snap = RepoSnapshot(
                    name=r.name,
                    period=period,
                    stars=r.stars,
                    language=r.language,
                    description=r.description,
                    url=r.url,
                    author=r.author,
                    topics=r.topics,
                    snapshot_at=now,
                )
                db.add(snap)

            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()


def get_history(repo_name, days=30):
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        snaps = db.query(RepoSnapshot).filter(
            RepoSnapshot.name == repo_name,
            RepoSnapshot.snapshot_at >= cutoff,
        ).order_by(RepoSnapshot.snapshot_at.asc()).all()

        return [{
            'date': s.snapshot_at.strftime('%Y-%m-%d'),
            'stars': s.stars,
        } for s in snaps]
    finally:
        db.close()


def get_snapshot_files(period):
    db = SessionLocal()
    try:
        snaps = db.query(RepoSnapshot).filter(
            RepoSnapshot.period == period
        ).order_by(RepoSnapshot.snapshot_at.desc()).all()

        groups = {}
        for s in snaps:
            ts = s.snapshot_at.strftime('%Y-%m-%dT%H-%M-%S')
            if ts not in groups:
                groups[ts] = []
            groups[ts].append(s)

        result = []
        for ts, group in sorted(groups.items(), reverse=True):
            result.append({
                'timestamp': ts,
                'period': period,
                'repos': [{
                    'name': r.name,
                    'stars': r.stars,
                    'language': r.language,
                    'description': r.description,
                    'url': r.url,
                    'author': r.author,
                    'topics': r.topics,
                } for r in group],
            })
        return result
    finally:
        db.close()


def save_star_history(repo_name, entries):
    with _db_lock:
        db = SessionLocal()
        try:
            for entry in entries:
                existing = db.query(StarHistory).filter(
                    StarHistory.repo_name == repo_name,
                    StarHistory.date == entry['date'],
                ).first()
                if not existing:
                    sh = StarHistory(
                        repo_name=repo_name,
                        date=entry['date'],
                        stars=entry['stars'],
                        source=entry.get('source', 'github_api'),
                    )
                    db.add(sh)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()


def get_star_history(repo_name, days=365):
    db = SessionLocal()
    try:
        cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime('%Y-%m-%d')
        entries = db.query(StarHistory).filter(
            StarHistory.repo_name == repo_name,
            StarHistory.date >= cutoff_date,
        ).order_by(StarHistory.date.asc()).all()

        if entries:
            return [{'date': e.date, 'stars': e.stars} for e in entries]
        return None
    finally:
        db.close()


def clear_repos_by_period(period):
    with _db_lock:
        db = SessionLocal()
        try:
            db.query(TrendingRepo).filter(TrendingRepo.period == period).delete()
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()