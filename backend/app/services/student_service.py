"""Student-side business logic: join teacher, list teachers, leave teacher."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.teacher import InviteCode, TeacherStudent
from app.models.user import User
from app.schemas.student import JoinTeacherResponse, MyTeacherItem


def join_teacher(
    db: Session,
    student_id: str,
    invite_code_str: str,
) -> JoinTeacherResponse:
    """Validate invite code and bind student to teacher.

    Validation order (matches architecture doc):
    1. Code exists and status=active
    2. Not expired
    3. used_count < max_uses
    4. Student not already bound to this teacher
    """
    # 1. Find active code
    invite = db.execute(
        select(InviteCode).where(
            InviteCode.code == invite_code_str,
            InviteCode.status == "active",
        )
    ).scalar_one_or_none()

    if invite is None:
        raise ValueError("Invalid invite code")

    # 2. Check expiry
    now = datetime.now(timezone.utc)
    if invite.expires_at.replace(tzinfo=timezone.utc) <= now:
        raise ValueError("Invite code has expired")

    # 3. Check usage
    if invite.used_count >= invite.max_uses:
        raise ValueError("Invite code has reached max uses")

    teacher_id = invite.teacher_id

    # 4. Check existing binding
    existing = db.execute(
        select(TeacherStudent).where(
            TeacherStudent.teacher_id == teacher_id,
            TeacherStudent.student_id == student_id,
        )
    ).scalar_one_or_none()

    if existing is not None:
        if existing.status == "active":
            raise ValueError("Already joined this teacher")
        # Re-activate a previously removed binding
        existing.status = "active"
        existing.removed_at = None
        existing.invite_code_id = invite.id
    else:
        binding = TeacherStudent(
            teacher_id=teacher_id,
            student_id=student_id,
            invite_code_id=invite.id,
        )
        db.add(binding)

    # Increment used_count
    invite.used_count += 1
    db.flush()

    # Get teacher info
    teacher = db.execute(
        select(User).where(User.id == teacher_id)
    ).scalar_one()

    return JoinTeacherResponse(
        teacher_id=teacher_id,
        teacher_nickname=teacher.nickname,
        bindtime=datetime.now(timezone.utc),
    )


def list_my_teachers(db: Session, student_id: str) -> list[MyTeacherItem]:
    """Return all active teachers for a student."""
    stmt = (
        select(
            TeacherStudent.teacher_id,
            TeacherStudent.created_at.label("bindtime"),
            User.nickname.label("teacher_nickname"),
            User.avatar_url.label("teacher_avatar_url"),
        )
        .join(User, User.id == TeacherStudent.teacher_id)
        .where(
            TeacherStudent.student_id == student_id,
            TeacherStudent.status == "active",
        )
        .order_by(TeacherStudent.created_at.desc())
    )
    rows = db.execute(stmt).all()
    return [
        MyTeacherItem(
            teacher_id=r.teacher_id,
            teacher_nickname=r.teacher_nickname,
            teacher_avatar_url=r.teacher_avatar_url,
            bindtime=r.bindtime,
        )
        for r in rows
    ]


def leave_teacher(db: Session, student_id: str, teacher_id: str) -> None:
    """Student leaves a teacher. Raises ValueError if binding not found."""
    binding = db.execute(
        select(TeacherStudent).where(
            TeacherStudent.teacher_id == teacher_id,
            TeacherStudent.student_id == student_id,
            TeacherStudent.status == "active",
        )
    ).scalar_one_or_none()

    if binding is None:
        raise ValueError("Teacher binding not found")

    binding.status = "removed"
    binding.removed_at = datetime.now(timezone.utc)
    db.flush()
