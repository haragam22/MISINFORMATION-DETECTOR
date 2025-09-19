# services/education.py
def generate_tip(signals: dict):
    """Generate a simple education tip based on evidence signals."""
    if signals.get("SR",0) > 0.7:
        return "High-quality sources support this claim. Always check official sites."
    if signals.get("CC",0) > 0.5:
        return "Multiple sources agree, which increases reliability."
    return "Check dates and confirm across multiple independent sources."
