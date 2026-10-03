from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

# SQLite connection args for multithreaded web servers
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency for providing request-scoped database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all database tables and ensure newly added columns exist."""
    import models.db  # noqa: F401
    from sqlalchemy import inspect, text
    Base.metadata.create_all(bind=engine)

    # Perform lightweight migration for SQLite tables if columns were added
    try:
        inspector = inspect(engine)
        if "documents" in inspector.get_table_names():
            doc_columns = [c["name"] for c in inspector.get_columns("documents")]
            with engine.connect() as conn:
                if "file_hash" not in doc_columns:
                    conn.execute(text("ALTER TABLE documents ADD COLUMN file_hash VARCHAR(64)"))
                if "is_cancelled" not in doc_columns:
                    conn.execute(text("ALTER TABLE documents ADD COLUMN is_cancelled BOOLEAN DEFAULT 0 NOT NULL"))
                conn.commit()

        if "questions" in inspector.get_table_names():
            q_columns = [c["name"] for c in inspector.get_columns("questions")]
            with engine.connect() as conn:
                if "context" not in q_columns:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN context TEXT"))
                if "figure_image_url" not in q_columns:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN figure_image_url VARCHAR(500)"))
                conn.commit()

        if "test_sessions" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("test_sessions")]
            with engine.connect() as conn:
                if "negative_marking" not in columns:
                    conn.execute(text("ALTER TABLE test_sessions ADD COLUMN negative_marking FLOAT DEFAULT 0.0 NOT NULL"))
                if "shuffle_options" not in columns:
                    conn.execute(text("ALTER TABLE test_sessions ADD COLUMN shuffle_options BOOLEAN DEFAULT 0 NOT NULL"))
                if "target_score_percentage" not in columns:
                    conn.execute(text("ALTER TABLE test_sessions ADD COLUMN target_score_percentage FLOAT"))
                if "partial_credit" not in columns:
                    conn.execute(text("ALTER TABLE test_sessions ADD COLUMN partial_credit BOOLEAN DEFAULT 0 NOT NULL"))
                conn.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Schema migration error: %s", e)
