#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class NormalizedSignal:
    action: str
    whale_bet: str
    raw_price: float
    support_side: str
    oppose_side: str
    support_price: float
    oppose_price: float


def normalize_signal(action: str, whale_bet: str, price: float) -> NormalizedSignal:
    action_n = action.strip().upper()
    whale_bet_n = whale_bet.strip().upper()
    if action_n not in {"BUY", "SELL"}:
        raise ValueError(f"invalid action: {action}")
    if whale_bet_n not in {"YES", "NO"}:
        raise ValueError(f"invalid whale bet: {whale_bet}")
    if not (0.0 <= float(price) <= 1.0):
        raise ValueError(f"invalid price: {price}")

    if action_n == "BUY":
        support_side = whale_bet_n
        support_price = float(price)
    else:
        support_side = "NO" if whale_bet_n == "YES" else "YES"
        support_price = 1.0 - float(price)

    oppose_side = "NO" if support_side == "YES" else "YES"
    oppose_price = 1.0 - support_price

    return NormalizedSignal(
        action=action_n,
        whale_bet=whale_bet_n,
        raw_price=float(price),
        support_side=support_side,
        oppose_side=oppose_side,
        support_price=support_price,
        oppose_price=oppose_price,
    )


def cents_text(price: float) -> str:
    cents = round(price * 100)
    return f"{cents}¢"


def assert_post_matches_side(text: str, support_side: str, support_price: float) -> None:
    body = text.upper()
    expected_cta = f"BUY {support_side} {cents_text(support_price).upper()}"
    if expected_cta not in body:
        raise ValueError(f"INTERPRETATION_MISMATCH: expected CTA {expected_cta}")

    wrong_side = "NO" if support_side == "YES" else "YES"
    wrong_cta_prefix = f"BUY {wrong_side} "
    if wrong_cta_prefix in body:
        raise ValueError(f"INTERPRETATION_MISMATCH: found opposite CTA {wrong_cta_prefix.strip()}")
