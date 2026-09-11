import { describe, expect, it } from 'vitest';
import {
  fromMinorUnits,
  gteMoney,
  gtMoney,
  isPositiveMoney,
  sumMoney,
  toMinorUnits,
} from '../src/domain/services/payment-amount.js';

/**
 * Pure unit tests for payment money arithmetic.
 *
 * Money is stored as numeric(10,2) strings. All arithmetic runs in integer minor
 * units to avoid float drift (0.1 + 0.2 !== 0.3). These tests cover the exact
 * edge cases that would silently corrupt accounting if wrong.
 */
describe('payment-amount', () => {
  describe('toMinorUnits', () => {
    it('converts whole amounts', () => {
      expect(toMinorUnits('0.00')).toBe(0);
      expect(toMinorUnits('1.00')).toBe(100);
      expect(toMinorUnits('1250.50')).toBe(125050);
      expect(toMinorUnits('99999999.99')).toBe(9999999999);
    });

    it('converts amounts without decimals', () => {
      expect(toMinorUnits('5')).toBe(500);
      expect(toMinorUnits('42')).toBe(4200);
    });

    it('converts amounts with one decimal digit', () => {
      expect(toMinorUnits('1.5')).toBe(150);
      expect(toMinorUnits('0.1')).toBe(10);
    });

    it('converts negative amounts', () => {
      expect(toMinorUnits('-1.00')).toBe(-100);
      expect(toMinorUnits('-0.50')).toBe(-50);
    });

    it('handles leading/trailing whitespace', () => {
      expect(toMinorUnits('  10.00  ')).toBe(1000);
    });

    it('throws on malformed input', () => {
      expect(() => toMinorUnits('abc')).toThrow();
      expect(() => toMinorUnits('1.234')).toThrow();
      expect(() => toMinorUnits('')).toThrow();
      expect(() => toMinorUnits('12.')).toThrow();
    });
  });

  describe('fromMinorUnits', () => {
    it('converts back to decimal strings', () => {
      expect(fromMinorUnits(0)).toBe('0.00');
      expect(fromMinorUnits(100)).toBe('1.00');
      expect(fromMinorUnits(125050)).toBe('1250.50');
      expect(fromMinorUnits(10)).toBe('0.10');
      expect(fromMinorUnits(1)).toBe('0.01');
    });

    it('converts negative minor units', () => {
      expect(fromMinorUnits(-100)).toBe('-1.00');
      expect(fromMinorUnits(-50)).toBe('-0.50');
    });

    it('round-trips with toMinorUnits', () => {
      for (const amount of ['0.00', '0.01', '1.00', '12.34', '9999.99', '1250.50']) {
        expect(fromMinorUnits(toMinorUnits(amount))).toBe(amount);
      }
    });
  });

  describe('sumMoney', () => {
    it('sums decimal strings without float drift', () => {
      // Classic float trap: 0.1 + 0.2 === 0.30000000000000004 in JS floats.
      expect(sumMoney(['0.10', '0.20'])).toBe('0.30');
      expect(sumMoney(['0.10', '0.20', '0.30'])).toBe('0.60');
    });

    it('sums a list of money strings', () => {
      expect(sumMoney(['10.00', '20.50', '5.25'])).toBe('35.75');
      expect(sumMoney(['1.11', '2.22', '3.33'])).toBe('6.66');
    });

    it('returns zero for empty list', () => {
      expect(sumMoney([])).toBe('0.00');
    });

    it('handles single element', () => {
      expect(sumMoney(['42.50'])).toBe('42.50');
    });
  });

  describe('comparisons', () => {
    it('gteMoney compares >= correctly', () => {
      expect(gteMoney('10.00', '10.00')).toBe(true);
      expect(gteMoney('10.01', '10.00')).toBe(true);
      expect(gteMoney('9.99', '10.00')).toBe(false);
    });

    it('gtMoney compares > correctly', () => {
      expect(gtMoney('10.01', '10.00')).toBe(true);
      expect(gtMoney('10.00', '10.00')).toBe(false);
      expect(gtMoney('9.99', '10.00')).toBe(false);
    });

    it('isPositiveMoney detects positive amounts', () => {
      expect(isPositiveMoney('0.01')).toBe(true);
      expect(isPositiveMoney('10.00')).toBe(true);
      expect(isPositiveMoney('0.00')).toBe(false);
      expect(isPositiveMoney('-1.00')).toBe(false);
    });
  });

  describe('accounting invariants', () => {
    it('never loses precision across a capture + refund cycle', () => {
      const subtotal = sumMoney(['150.00', '75.50', '24.50']); // 250.00
      expect(subtotal).toBe('250.00');

      const captured = sumMoney(['100.00', '150.00']); // full capture
      expect(captured).toBe('250.00');
      expect(gteMoney(captured, subtotal)).toBe(true);

      const refunded = sumMoney(['50.00']);
      const remaining = fromMinorUnits(toMinorUnits(captured) - toMinorUnits(refunded));
      expect(remaining).toBe('200.00');
    });

    it('partial captures sum to the total without drift', () => {
      const total = '250.00';
      const first = '100.00';
      const second = '100.00';
      const third = '50.00';
      const captured = sumMoney([first, second, third]);
      expect(captured).toBe(total);
      expect(toMinorUnits(captured)).toBe(toMinorUnits(total));
    });
  });
});
