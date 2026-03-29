"""Dialogue service layer (B3-1, B3-2)."""

import random
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.character import Character, CharacterDialogue


def get_dialogue(
    db: Session,
    character_id: str,
    event_type: str,
) -> Optional[dict]:
    """Get a random dialogue for a character based on event type.

    Args:
        db: Database session.
        character_id: Character ID.
        event_type: One of greeting, good_move, blunder, check_given,
                    check_received, capture_given, capture_received,
                    advantage, disadvantage, win, lose, draw.

    Returns:
        Dict with text and expression, or None if no matching dialogue.
    """
    # Verify character exists
    char_stmt = select(Character).where(Character.id == character_id)
    character = db.execute(char_stmt).scalar_one_or_none()
    if character is None:
        return None

    # Query matching dialogues by character and scene (event_type)
    stmt = select(CharacterDialogue).where(
        CharacterDialogue.character_id == character_id,
        CharacterDialogue.scene == event_type,
    )
    dialogues = db.execute(stmt).scalars().all()

    if not dialogues:
        # Fallback: return a generic dialogue based on event type
        fallback = _get_fallback_dialogue(character.name, event_type)
        return fallback

    # Pick a random dialogue
    chosen = random.choice(dialogues)
    return {
        "text": chosen.content,
        "expression": chosen.emotion,
        "character_name": character.name,
        "character_avatar_key": character.avatar_key,
    }


def _get_fallback_dialogue(character_name: str, event_type: str) -> dict:
    """Generate a fallback dialogue when no DB entries exist.

    Args:
        character_name: Character display name.
        event_type: Event type string.

    Returns:
        Dict with text and expression.
    """
    fallbacks = {
        "greeting": {"text": f"你好呀！我是{character_name}，准备好下棋了吗？", "expression": "happy"},
        "good_move": {"text": "哇，好棋！你真厉害！", "expression": "surprised"},
        "blunder": {"text": "嗯？这步棋好像不太好哦...", "expression": "thinking"},
        "check_given": {"text": "将军！小心哦～", "expression": "excited"},
        "check_received": {"text": "啊！我被将军了！", "expression": "worried"},
        "capture_given": {"text": "吃掉你的棋子啦！", "expression": "happy"},
        "capture_received": {"text": "我的棋子被吃掉了...", "expression": "sad"},
        "advantage": {"text": "我现在占优势了哦～", "expression": "confident"},
        "disadvantage": {"text": "你好厉害，我得加油了！", "expression": "nervous"},
        "win": {"text": "我赢了！再来一局吧！", "expression": "happy"},
        "lose": {"text": "你赢了！太厉害了！", "expression": "admiring"},
        "draw": {"text": "平局！我们棋力相当呢！", "expression": "normal"},
    }

    result = fallbacks.get(event_type, {"text": "...", "expression": "normal"})
    return {
        "text": result["text"],
        "expression": result["expression"],
        "character_name": character_name,
        "character_avatar_key": None,
    }
