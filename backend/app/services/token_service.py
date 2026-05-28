def format_token_usage(token_usage: dict | None) -> dict:
    if not token_usage:
        return {
            "input_tokens": None,
            "output_tokens": None,
            "total_tokens": None,
            "model": None,
            "provider": None,
        }
    return {
        "input_tokens": token_usage.get("input_tokens"),
        "output_tokens": token_usage.get("output_tokens"),
        "total_tokens": token_usage.get("total_tokens"),
        "model": token_usage.get("model"),
        "provider": token_usage.get("provider"),
    }
