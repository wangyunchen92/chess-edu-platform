"""InviteCode and TeacherStudent ORM models."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class InviteCode(Base):
    __tablename__ = "invite_codes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    teacher_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    code: Mapped[str] = mapped_column(
        String(6), unique=True, nullable=False, index=True
    )
    max_uses: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    used_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    teacher: Mapped["User"] = relationship("User", foreign_keys=[teacher_id])


class TeacherStudent(Base):
    __tablename__ = "teacher_students"
    __table_args__ = (
        UniqueConstraint("teacher_id", "student_id", name="uq_teacher_student"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    teacher_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    invite_code_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("invite_codes.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    removed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    teacher: Mapped["User"] = relationship("User", foreign_keys=[teacher_id])
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    invite_code: Mapped[Optional["InviteCode"]] = relationship(
        "InviteCode", foreign_keys=[invite_code_id]
    )
