#!/usr/bin/env python3
import unittest

from xpost_signal_logic import assert_post_matches_side, cents_text, normalize_signal


class SignalLogicTests(unittest.TestCase):
    def test_buy_yes(self):
        n = normalize_signal('BUY', 'YES', 0.16)
        self.assertEqual(n.support_side, 'YES')
        self.assertEqual(cents_text(n.support_price), '16¢')

    def test_buy_no(self):
        n = normalize_signal('BUY', 'NO', 0.83)
        self.assertEqual(n.support_side, 'NO')
        self.assertEqual(cents_text(n.support_price), '83¢')

    def test_sell_yes(self):
        n = normalize_signal('SELL', 'YES', 0.64)
        self.assertEqual(n.support_side, 'NO')
        self.assertEqual(cents_text(n.support_price), '36¢')

    def test_sell_no(self):
        n = normalize_signal('SELL', 'NO', 0.37)
        self.assertEqual(n.support_side, 'YES')
        self.assertEqual(cents_text(n.support_price), '63¢')

    def test_guard_accepts_matching_post(self):
        text = 'Buy YES 16¢ on Will peace deal happen?'
        assert_post_matches_side(text, 'YES', 0.16)

    def test_guard_rejects_wrong_side(self):
        with self.assertRaisesRegex(ValueError, 'INTERPRETATION_MISMATCH'):
            assert_post_matches_side('Buy NO 84¢ on Will peace deal happen?', 'YES', 0.16)


if __name__ == '__main__':
    unittest.main()
