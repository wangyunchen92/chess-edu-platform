"""
Import ~16,000 puzzles from Lichess puzzle database.

Reads lichess_db_puzzle.csv.zst, samples evenly across rating buckets,
converts UCI moves to SAN, and outputs a JSON file for import.

Usage:
    python3 scripts/import_lichess_puzzles.py /path/to/lichess_db_puzzle.csv.zst

Output: content/puzzles/lichess_16k.json
"""

import csv
import io
import json
import random
import sys
from collections import defaultdict

import chess
import zstandard

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

TARGET_TOTAL = 16000
# Rating buckets: 200-wide, from 200 to 2800
BUCKET_WIDTH = 200
BUCKET_MIN = 200
BUCKET_MAX = 2800
NUM_BUCKETS = (BUCKET_MAX - BUCKET_MIN) // BUCKET_WIDTH  # 13

# Per-bucket target (even distribution, will adjust for sparse buckets)
PER_BUCKET_TARGET = TARGET_TOTAL // NUM_BUCKETS  # ~1230

# Quality filters
MIN_NB_PLAYS = 500       # At least 500 people played it
MIN_POPULARITY = 70       # Popularity score >= 70
MAX_RATING_DEVIATION = 90 # Stable rating

# Themes we want to keep (for tagging, not filtering)
THEME_CATEGORIES = {
    # Tactical motifs
    "fork": "双攻",
    "pin": "牵制",
    "skewer": "串击",
    "discoveredAttack": "闪击",
    "doubleCheck": "双将",
    "sacrifice": "弃子",
    "deflection": "引离",
    "decoy": "引入",
    "interference": "阻断",
    "overloading": "超负荷",
    "xRayAttack": "X光攻击",
    "zugzwang": "逼走",
    "trappedPiece": "困子",
    "hangingPiece": "悬子",
    "intermezzo": "中间着",
    "quietMove": "安静着",
    "defensiveMove": "防守着",
    # Checkmate patterns
    "mate": "将杀",
    "mateIn1": "一步杀",
    "mateIn2": "两步杀",
    "mateIn3": "三步杀",
    "mateIn4": "四步杀",
    "mateIn5": "五步杀",
    "backRankMate": "底线杀",
    "smotheredMate": "闷杀",
    "hookMate": "钩杀",
    "arabianMate": "阿拉伯杀",
    "anastasiasMate": "阿纳斯塔西娅杀",
    "bodensMate": "波登杀",
    "dovetailMate": "燕尾杀",
    # Game phase
    "opening": "开局",
    "middlegame": "中局",
    "endgame": "残局",
    "rookEndgame": "车残局",
    "queenEndgame": "后残局",
    "pawnEndgame": "兵残局",
    "bishopEndgame": "象残局",
    "knightEndgame": "马残局",
    "queenRookEndgame": "后车残局",
    # Tactical evaluation
    "crushing": "碾压",
    "advantage": "优势",
    # Length
    "oneMove": "一步",
    "short": "短题",
    "long": "长题",
    "veryLong": "超长题",
    # Special
    "castling": "王车易位",
    "enPassant": "吃过路兵",
    "promotion": "升变",
    "underPromotion": "低升变",
    "attackingF2F7": "攻击f2/f7",
    "kingsideAttack": "王翼攻击",
    "queensideAttack": "后翼攻击",
    "clearance": "腾挪",
    "exposedKing": "暴露王",
    "capturingDefender": "吃掉防守者",
    "masterVsMaster": "大师对局",
    "master": "大师",
    "superGM": "超级特级大师",
}


def uci_to_san(fen: str, uci_moves: list[str]) -> tuple[str, str, list[str], int]:
    """
    Convert UCI moves to SAN.

    Lichess format: first move is the opponent's setup move.
    We apply it to get the puzzle FEN, then convert remaining moves to SAN.

    Returns: (puzzle_fen, side_to_move, san_moves, move_count)
    """
    board = chess.Board(fen)

    # Apply the setup move (opponent's last move)
    setup_move = chess.Move.from_uci(uci_moves[0])
    board.push(setup_move)

    puzzle_fen = board.fen()
    side_to_move = "white" if board.turn == chess.WHITE else "black"

    # Convert solution moves to SAN
    san_moves = []
    for uci in uci_moves[1:]:
        move = chess.Move.from_uci(uci)
        san = board.san(move)
        san_moves.append(san)
        board.push(move)

    move_count = len(san_moves)
    return puzzle_fen, side_to_move, san_moves, move_count


def determine_difficulty_level(rating: int) -> int:
    """Map rating to difficulty level 1-5."""
    if rating < 800:
        return 1
    elif rating < 1200:
        return 2
    elif rating < 1600:
        return 3
    elif rating < 2000:
        return 4
    else:
        return 5


def generate_hint(themes: list[str], san_moves: list[str]) -> str:
    """Generate hint text based on themes."""
    if any(t.startswith("mateIn") for t in themes):
        n = next((t.replace("mateIn", "") for t in themes if t.startswith("mateIn")), "")
        if n == "1":
            return "找到一步将杀的走法！"
        elif n == "2":
            return "两步将杀！找到正确的组合"
        elif n == "3":
            return "三步将杀！需要精确计算"
        else:
            return f"{n}步将杀，仔细分析局面"

    theme_hints = {
        "fork": "寻找双攻的机会！",
        "pin": "利用牵制战术！",
        "skewer": "找到串击的走法！",
        "discoveredAttack": "利用闪击战术！",
        "sacrifice": "有时弃子能换来更大的收获！",
        "deflection": "把防守子力引离关键位置！",
        "decoy": "把对方棋子引到不利位置！",
        "trappedPiece": "对方有棋子被困住了！",
        "hangingPiece": "注意对方没有保护的棋子！",
        "backRankMate": "注意底线的弱点！",
        "promotion": "兵的力量不可小觑！",
    }

    for theme, hint in theme_hints.items():
        if theme in themes:
            return hint

    if len(san_moves) <= 2:
        return "找到最佳走法！"
    return "仔细分析局面，找到最佳走法序列！"


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/import_lichess_puzzles.py /path/to/lichess_db_puzzle.csv.zst")
        sys.exit(1)

    zst_path = sys.argv[1]

    print(f"Reading {zst_path}...")
    print(f"Target: {TARGET_TOTAL} puzzles across {NUM_BUCKETS} rating buckets")

    # Phase 1: collect candidates per bucket
    buckets: dict[int, list[dict]] = defaultdict(list)
    scanned = 0
    skipped = 0

    dctx = zstandard.ZstdDecompressor()
    with open(zst_path, "rb") as f:
        reader = dctx.stream_reader(f)
        text = io.TextIOWrapper(reader, encoding="utf-8")
        csvr = csv.DictReader(text)

        for row in csvr:
            scanned += 1
            if scanned % 500000 == 0:
                total_collected = sum(len(v) for v in buckets.values())
                print(f"  scanned {scanned}, collected {total_collected}...")

            rating = int(row["Rating"])
            nb_plays = int(row["NbPlays"])
            popularity = int(row["Popularity"])
            rd = int(row["RatingDeviation"])

            # Quality filters
            if nb_plays < MIN_NB_PLAYS:
                skipped += 1
                continue
            if popularity < MIN_POPULARITY:
                skipped += 1
                continue
            if rd > MAX_RATING_DEVIATION:
                skipped += 1
                continue
            if rating < BUCKET_MIN or rating >= BUCKET_MAX:
                skipped += 1
                continue

            bucket_key = ((rating - BUCKET_MIN) // BUCKET_WIDTH) * BUCKET_WIDTH + BUCKET_MIN

            # Reservoir sampling: keep up to 3x target per bucket for selection
            max_per_bucket = PER_BUCKET_TARGET * 3
            if len(buckets[bucket_key]) < max_per_bucket:
                buckets[bucket_key].append(row)
            else:
                # Randomly replace with decreasing probability
                j = random.randint(0, scanned)
                if j < max_per_bucket:
                    buckets[bucket_key][j % max_per_bucket] = row

    print(f"\nScan complete: {scanned} total, {skipped} filtered out")
    print(f"Candidates per bucket:")
    for b in sorted(buckets):
        print(f"  {b:>5}-{b + BUCKET_WIDTH - 1}: {len(buckets[b])}")

    # Phase 2: sample from each bucket
    selected = []
    for bucket_key in sorted(buckets):
        candidates = buckets[bucket_key]
        # Sort by popularity * nb_plays for quality
        candidates.sort(key=lambda r: int(r["Popularity"]) * int(r["NbPlays"]), reverse=True)

        take = min(PER_BUCKET_TARGET, len(candidates))
        # Take top quality, but with some randomness
        top_pool = candidates[:take * 2] if len(candidates) > take * 2 else candidates
        chosen = random.sample(top_pool, min(take, len(top_pool)))
        selected.extend(chosen)

    print(f"\nSelected {len(selected)} puzzles, converting to SAN...")

    # Phase 3: convert to our format
    puzzles = []
    errors = 0
    for i, row in enumerate(selected):
        if (i + 1) % 1000 == 0:
            print(f"  converting {i + 1}/{len(selected)}...")

        try:
            uci_moves = row["Moves"].split()
            puzzle_fen, side_to_move, san_moves, move_count = uci_to_san(row["FEN"], uci_moves)

            themes = row["Themes"].split() if row.get("Themes") else []
            rating = int(row["Rating"])
            difficulty = determine_difficulty_level(rating)

            puzzle = {
                "id": f"lp_{row['PuzzleId']}",
                "puzzle_code": f"LP{row['PuzzleId']}",
                "fen": puzzle_fen,
                "solution_moves": ",".join(san_moves),
                "difficulty_level": difficulty,
                "rating": rating,
                "themes": ",".join(themes),
                "description": None,
                "hint_text": generate_hint(themes, san_moves),
                "explanation": f"来自Lichess谜题库 ({row['PuzzleId']})，{int(row['NbPlays'])}人已挑战",
                "side_to_move": side_to_move,
                "move_count": move_count,
                "source": "lichess",
                "is_daily_pool": True,  # All new puzzles go to daily pool
                "is_challenge": True,    # Also available for challenge mode
                "nb_plays": int(row["NbPlays"]),
                "popularity": int(row["Popularity"]),
            }
            puzzles.append(puzzle)
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  Error on {row['PuzzleId']}: {e}")

    print(f"\nConverted {len(puzzles)} puzzles ({errors} errors)")

    # Stats
    by_level = defaultdict(int)
    by_theme = defaultdict(int)
    for p in puzzles:
        by_level[p["difficulty_level"]] += 1
        for t in p["themes"].split(","):
            if t:
                by_theme[t] += 1

    print(f"\nBy difficulty level:")
    for lv in sorted(by_level):
        print(f"  Level {lv}: {by_level[lv]}")

    print(f"\nTop 20 themes:")
    for theme, count in sorted(by_theme.items(), key=lambda x: -x[1])[:20]:
        label = THEME_CATEGORIES.get(theme, theme)
        print(f"  {theme:>25} ({label}): {count}")

    # Write output
    output_path = "content/puzzles/lichess_16k.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "title": "Lichess精选谜题库",
            "description": f"从Lichess {scanned}道谜题中精选{len(puzzles)}道，覆盖Rating {BUCKET_MIN}~{BUCKET_MAX}",
            "total_puzzles": len(puzzles),
            "theme_categories": THEME_CATEGORIES,
            "puzzles": puzzles,
        }, f, ensure_ascii=False, indent=2)

    print(f"\nWritten to {output_path}")


if __name__ == "__main__":
    main()
