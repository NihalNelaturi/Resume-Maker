from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, String, Text

from app.database.db import Base


class ResumeDraft(Base):
    __tablename__ = "resume_drafts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()), index=True)
    title = Column(String(120), nullable=False, default="Untitled Resume")
    payload = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

