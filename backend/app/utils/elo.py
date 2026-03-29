"""Elo Rating calculation utilities."""

import math


def expected_score(rating_a: int, rating_b: int) -> float:
    """Calculate the expected score for player A against player B.

    Args:
        rating_a: Rating of player A.
        rating_b: Rating of player B.

    Returns:
        Expected score between 0 and 1.
    """
    return 1.0 / (1.0 + math.pow(10, (rating_b - rating_a) / 400.0))


def calculate_k_factor(rating: int, games_played: int) -> int:
    """Determine the K-factor based on rating and experience.

    Higher K for beginners (faster adjustment), lower K for experienced players.

    Args:
        rating: Current player rating.
        games_played: Total number of rated games played.

    Returns:
        K-factor value.
    """
    if games_played < 30:
        return 40  # New player: fast adjustment
    elif rating < 800:
        return 32  # Beginner: moderate adjustment
    elif rating < 1200:
        return 24  # Intermediate
    else:
        return 16  # Advanced: stable


def calculate_new_rating(
    player_rating: int,
    opponent_rating: int,
    actual_score: float,
    games_played: int = 30,
) -> tuple[int, int]:
    """Calculate new Elo rating after a game.

    Args:
        player_rating: Current player rating.
        opponent_rating: Opponent's rating.
        actual_score: Actual result (1.0 = win, 0.5 = draw, 0.0 = loss).
        games_played: Player's total rated games (affects K-factor).

    Returns:
        Tuple of (new_rating, rating_change).
    """
    expected = expected_score(player_rating, opponent_rating)
    k = calculate_k_factor(player_rating, games_played)
    change = round(k * (actual_score - expected))
    new_rating = max(100, player_rating + change)  # Floor at 100
    return new_rating, change


def calculate_puzzle_rating(
    player_rating: int,
    puzzle_rating: int,
    is_correct: bool,
) -> tuple[int, int]:
    """Calculate new puzzle rating after an attempt.

    Uses a modified Elo with fixed K=24 for puzzles.

    Args:
        player_rating: Current puzzle rating.
        puzzle_rating: Puzzle's difficulty rating.
        is_correct: Whether the puzzle was solved correctly.

    Returns:
        Tuple of (new_rating, rating_change).
    """
    expected = expected_score(player_rating, puzzle_rating)
    actual = 1.0 if is_correct else 0.0
    k = 24
    change = round(k * (actual - expected))
    new_rating = max(100, player_rating + change)
    return new_rating, change
