"""API routers package."""

from fastapi import APIRouter

from app.routers.admin import router as admin_router
from app.routers.credits import router as credits_router
from app.routers.adventure import router as adventure_router
from app.routers.assessment import router as assessment_router
from app.routers.auth import router as auth_router
from app.routers.dashboard import router as dashboard_router
from app.routers.diagnosis import router as diagnosis_router
from app.routers.gamification import router as gamification_router
from app.routers.learn import router as learn_router
from app.routers.notifications import router as notifications_router
from app.routers.play import router as play_router
from app.routers.puzzles import router as puzzles_router
from app.routers.train import router as train_router
from app.routers.student_extra import router as student_extra_router
from app.routers.teacher import router as teacher_router
from app.routers.user import router as user_router

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["Auth"])
router.include_router(admin_router, prefix="/admin", tags=["Admin"])
router.include_router(play_router, prefix="/play", tags=["Play"])
router.include_router(user_router, prefix="/user", tags=["User"])
router.include_router(assessment_router, prefix="/assessment", tags=["Assessment"])
router.include_router(puzzles_router, prefix="/puzzles", tags=["Puzzles"])
router.include_router(learn_router, prefix="/learn", tags=["Learn"])
router.include_router(train_router, prefix="/train", tags=["Train"])
router.include_router(gamification_router, prefix="/gamification", tags=["Gamification"])
router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
router.include_router(adventure_router, prefix="/adventure", tags=["Adventure"])
router.include_router(diagnosis_router, prefix="/diagnosis", tags=["Diagnosis"])
router.include_router(teacher_router, prefix="/teacher", tags=["Teacher"])
router.include_router(student_extra_router, prefix="/student", tags=["Student"])
router.include_router(credits_router, prefix="/credits", tags=["Credits"])
