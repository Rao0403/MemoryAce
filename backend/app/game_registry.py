ALLOWED_GAMES = ("number_memory", "sequence_memory", "verbal_memory", "wordle", "face_name_memory", "guess_the_flag")


def normalize_game_key(value: str) -> str:
    normalized = value.strip()
    if normalized not in ALLOWED_GAMES:
        raise ValueError(f"Game must be one of: {', '.join(ALLOWED_GAMES)}")
    return normalized
