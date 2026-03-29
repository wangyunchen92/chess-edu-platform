"""Assessment service layer (B1-8)."""

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.gamification import UserRating
from app.models.user import User, UserProfile
from app.schemas.assessment import (
    AnswerItem,
    AssessmentOption,
    AssessmentQuestion,
    AssessmentQuestionsResponse,
    AssessmentResultResponse,
)
from app.services.gamification_service import get_rank_for_rating

# ── Assessment question bank ──────────────────────────────────────
# Each level has a set of questions with correct answers and point values.

QUESTION_BANK = {
    "none": [
        AssessmentQuestion(
            id="q_none_1",
            question="棋盘上一共有多少个格子？",
            options=[
                AssessmentOption(key="A", label="32"),
                AssessmentOption(key="B", label="64", is_correct=True),
                AssessmentOption(key="C", label="100"),
                AssessmentOption(key="D", label="48"),
            ],
            difficulty="beginner",
        ),
        AssessmentQuestion(
            id="q_none_2",
            question="国际象棋中哪个棋子可以走L形？",
            options=[
                AssessmentOption(key="A", label="主教/象"),
                AssessmentOption(key="B", label="骑士/马", is_correct=True),
                AssessmentOption(key="C", label="城堡/车"),
                AssessmentOption(key="D", label="兵"),
            ],
            difficulty="beginner",
        ),
        AssessmentQuestion(
            id="q_none_3",
            question="国际象棋的目标是什么？",
            options=[
                AssessmentOption(key="A", label="吃掉对方所有棋子"),
                AssessmentOption(key="B", label="将杀对方的国王", is_correct=True),
                AssessmentOption(key="C", label="先到达对方底线"),
                AssessmentOption(key="D", label="拥有最多棋子"),
            ],
            difficulty="beginner",
        ),
        AssessmentQuestion(
            id="q_none_4",
            question="哪个棋子价值最高（除国王外）？",
            options=[
                AssessmentOption(key="A", label="骑士/马"),
                AssessmentOption(key="B", label="主教/象"),
                AssessmentOption(key="C", label="后/皇后", is_correct=True),
                AssessmentOption(key="D", label="城堡/车"),
            ],
            difficulty="beginner",
        ),
        AssessmentQuestion(
            id="q_none_5",
            question="兵到达对方底线后会发生什么？",
            options=[
                AssessmentOption(key="A", label="被移出棋盘"),
                AssessmentOption(key="B", label="变成国王"),
                AssessmentOption(key="C", label="可以升变为其他棋子", is_correct=True),
                AssessmentOption(key="D", label="什么都不会发生"),
            ],
            difficulty="beginner",
        ),
    ],
    "beginner": [
        AssessmentQuestion(
            id="q_beg_1",
            question="什么是'王车易位'(Castling)？",
            options=[
                AssessmentOption(key="A", label="国王和车同时移动的特殊走法", is_correct=True),
                AssessmentOption(key="B", label="用车吃掉对方的王"),
                AssessmentOption(key="C", label="国王走两步"),
                AssessmentOption(key="D", label="车跳过其他棋子"),
            ],
            difficulty="beginner",
        ),
        AssessmentQuestion(
            id="q_beg_2",
            question="什么是'吃过路兵'(En Passant)？",
            options=[
                AssessmentOption(key="A", label="兵可以向后走"),
                AssessmentOption(key="B", label="兵在特定条件下斜吃刚走两格的兵", is_correct=True),
                AssessmentOption(key="C", label="兵可以跳过其他棋子"),
                AssessmentOption(key="D", label="兵可以一次走三格"),
            ],
            difficulty="beginner",
        ),
        AssessmentQuestion(
            id="q_beg_3",
            question="当国王被将军但无法逃脱时叫什么？",
            options=[
                AssessmentOption(key="A", label="和棋"),
                AssessmentOption(key="B", label="僵局"),
                AssessmentOption(key="C", label="将杀", is_correct=True),
                AssessmentOption(key="D", label="弃权"),
            ],
            difficulty="beginner",
        ),
        AssessmentQuestion(
            id="q_beg_4",
            question="象（Bishop）可以在什么颜色的格子上移动？",
            options=[
                AssessmentOption(key="A", label="只能在一种颜色的格子上", is_correct=True),
                AssessmentOption(key="B", label="可以在任何颜色上"),
                AssessmentOption(key="C", label="每走一步换一种颜色"),
                AssessmentOption(key="D", label="只在白格上"),
            ],
            difficulty="beginner",
        ),
        AssessmentQuestion(
            id="q_beg_5",
            question="开局中最重要的原则是什么？",
            options=[
                AssessmentOption(key="A", label="尽快出后"),
                AssessmentOption(key="B", label="控制中心、发展子力、国王安全", is_correct=True),
                AssessmentOption(key="C", label="尽可能多地走兵"),
                AssessmentOption(key="D", label="先吃掉对方的兵"),
            ],
            difficulty="intermediate",
        ),
    ],
    "intermediate": [
        AssessmentQuestion(
            id="q_int_1",
            question="什么是'钉子'(Pin)战术？",
            options=[
                AssessmentOption(key="A", label="攻击对方两个棋子的战术"),
                AssessmentOption(key="B", label="一个棋子因为身后有更高价值棋子而不能移动", is_correct=True),
                AssessmentOption(key="C", label="用兵封锁对方的子"),
                AssessmentOption(key="D", label="连续将军"),
            ],
            difficulty="intermediate",
        ),
        AssessmentQuestion(
            id="q_int_2",
            question="什么是'叉'(Fork)？",
            options=[
                AssessmentOption(key="A", label="同时攻击对方两个或多个棋子", is_correct=True),
                AssessmentOption(key="B", label="用两个棋子攻击一个目标"),
                AssessmentOption(key="C", label="牺牲一个棋子"),
                AssessmentOption(key="D", label="防守战术"),
            ],
            difficulty="intermediate",
        ),
        AssessmentQuestion(
            id="q_int_3",
            question="残局中王+车 vs 单王是什么结果？",
            options=[
                AssessmentOption(key="A", label="和棋"),
                AssessmentOption(key="B", label="有车一方必胜", is_correct=True),
                AssessmentOption(key="C", label="取决于位置"),
                AssessmentOption(key="D", label="单王一方赢"),
            ],
            difficulty="intermediate",
        ),
        AssessmentQuestion(
            id="q_int_4",
            question="什么是'闷杀'(Smothered Mate)？",
            options=[
                AssessmentOption(key="A", label="用后将杀"),
                AssessmentOption(key="B", label="马将杀且对方国王被自己棋子围住", is_correct=True),
                AssessmentOption(key="C", label="用兵将杀"),
                AssessmentOption(key="D", label="双车将杀"),
            ],
            difficulty="advanced",
        ),
        AssessmentQuestion(
            id="q_int_5",
            question="什么情况下会出现'逼和'(Stalemate)？",
            options=[
                AssessmentOption(key="A", label="国王被将军"),
                AssessmentOption(key="B", label="双方都没有棋子了"),
                AssessmentOption(key="C", label="轮到走棋的一方没有合法走法且未被将军", is_correct=True),
                AssessmentOption(key="D", label="重复三次同样局面"),
            ],
            difficulty="intermediate",
        ),
    ],
    "advanced": [
        AssessmentQuestion(
            id="q_adv_1",
            question="什么是'Zugzwang'（不得不走的困境）？",
            options=[
                AssessmentOption(key="A", label="一种开局体系"),
                AssessmentOption(key="B", label="任何走法都会恶化自己局面的状态", is_correct=True),
                AssessmentOption(key="C", label="一种将杀方式"),
                AssessmentOption(key="D", label="弃子攻杀"),
            ],
            difficulty="advanced",
        ),
        AssessmentQuestion(
            id="q_adv_2",
            question="象+马能否将杀单王？",
            options=[
                AssessmentOption(key="A", label="不能，一定是和棋"),
                AssessmentOption(key="B", label="能，但只能在角落", is_correct=True),
                AssessmentOption(key="C", label="能，在任何位置都可以"),
                AssessmentOption(key="D", label="取决于走哪一方"),
            ],
            difficulty="advanced",
        ),
        AssessmentQuestion(
            id="q_adv_3",
            question="西班牙开局(Ruy Lopez)的主要思想是什么？",
            options=[
                AssessmentOption(key="A", label="快速出后攻王"),
                AssessmentOption(key="B", label="通过给马施压来争夺中心控制权", is_correct=True),
                AssessmentOption(key="C", label="快速王翼进攻"),
                AssessmentOption(key="D", label="封锁中心"),
            ],
            difficulty="advanced",
        ),
        AssessmentQuestion(
            id="q_adv_4",
            question="什么是'对立'(Opposition)？",
            options=[
                AssessmentOption(key="A", label="两个王面对面，中间隔奇数格", is_correct=True),
                AssessmentOption(key="B", label="两个车对着"),
                AssessmentOption(key="C", label="兵链对抗"),
                AssessmentOption(key="D", label="象颜色相反"),
            ],
            difficulty="advanced",
        ),
        AssessmentQuestion(
            id="q_adv_5",
            question="在国际象棋引擎评估中，+1.5意味着什么？",
            options=[
                AssessmentOption(key="A", label="白方多了1.5个兵"),
                AssessmentOption(key="B", label="白方有大约1.5个兵的优势", is_correct=True),
                AssessmentOption(key="C", label="白方领先1.5步"),
                AssessmentOption(key="D", label="白方有15%的胜率优势"),
            ],
            difficulty="advanced",
        ),
    ],
}

# Base rating per experience level
BASE_RATINGS = {
    "none": 200,
    "beginner": 400,
    "intermediate": 800,
    "advanced": 1200,
}

# Points per correct answer by level
POINTS_PER_CORRECT = {
    "none": 20,
    "beginner": 40,
    "intermediate": 80,
    "advanced": 100,
}


def get_assessment_questions(experience_level: str) -> Optional[AssessmentQuestionsResponse]:
    """Get assessment questions for a given experience level.

    Args:
        experience_level: User's self-reported level (none, beginner, intermediate, advanced).

    Returns:
        AssessmentQuestionsResponse or None if invalid level.
    """
    questions = QUESTION_BANK.get(experience_level)
    if questions is None:
        return None

    return AssessmentQuestionsResponse(
        experience_level=experience_level,
        questions=questions,
    )


def submit_assessment(
    db: Session,
    user_id: str,
    experience_level: str,
    answers: list[AnswerItem],
) -> Optional[AssessmentResultResponse]:
    """Submit assessment and compute initial rating.

    Args:
        db: Database session.
        user_id: User ID.
        experience_level: Self-reported experience.
        answers: List of answer items.

    Returns:
        AssessmentResultResponse or None if invalid level.
    """
    questions = QUESTION_BANK.get(experience_level)
    if questions is None:
        return None

    # Build answer map: question_id -> correct_key
    correct_map: dict[str, str] = {}
    for q in questions:
        for opt in q.options:
            if opt.is_correct:
                correct_map[q.id] = opt.key
                break

    # Score answers
    correct_count = 0
    for ans in answers:
        if correct_map.get(ans.question_id) == ans.selected_key:
            correct_count += 1

    total_count = len(questions)
    base = BASE_RATINGS.get(experience_level, 200)
    bonus = correct_count * POINTS_PER_CORRECT.get(experience_level, 20)
    initial_rating = base + bonus

    # Get rank info
    rank_info = get_rank_for_rating(initial_rating)

    # Update user profile
    stmt = select(User).where(User.id == user_id)
    user = db.execute(stmt).scalar_one_or_none()
    if user is None:
        return None

    profile = user.profile
    if profile is None:
        profile = UserProfile(
            id=str(uuid.uuid4()),
            user_id=user_id,
        )
        db.add(profile)

    profile.chess_experience = experience_level
    profile.assessment_done = True
    profile.initial_rating = initial_rating
    db.add(profile)

    # Create or update user rating
    from app.models.gamification import UserRating

    rating_stmt = select(UserRating).where(UserRating.user_id == user_id)
    user_rating = db.execute(rating_stmt).scalar_one_or_none()
    if user_rating is None:
        user_rating = UserRating(
            id=str(uuid.uuid4()),
            user_id=user_id,
        )
        db.add(user_rating)

    user_rating.game_rating = initial_rating
    user_rating.puzzle_rating = initial_rating
    user_rating.rank_title = rank_info["rank_title"]
    user_rating.rank_tier = rank_info["rank_tier"]
    user_rating.rank_region = rank_info["rank_region"]
    db.add(user_rating)
    db.flush()

    # Determine message
    ratio = correct_count / total_count if total_count > 0 else 0
    if ratio >= 0.8:
        message = "非常出色！你对国际象棋有很好的理解。"
    elif ratio >= 0.5:
        message = "不错！你有一定的基础，继续加油！"
    else:
        message = "没关系，我们会从基础开始帮助你进步！"

    return AssessmentResultResponse(
        initial_rating=initial_rating,
        rank_title=rank_info["rank_title"],
        rank_tier=rank_info["rank_tier"],
        correct_count=correct_count,
        total_count=total_count,
        message=message,
    )
