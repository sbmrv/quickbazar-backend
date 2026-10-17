import { describe, expect, it } from 'vitest';
import { settingDefaults } from './defaults.js';

describe('setting defaults', () => {
  it('stores fees and payouts as integer paise', () => {
    const amounts = [
      settingDefaults.modes.express.baseFeePaise,
      settingDefaults.modes.express.perKmAfter2kmPaise,
      settingDefaults.modes.sameDay.baseFeePaise,
      settingDefaults.modes.standard.baseFeePaise,
      settingDefaults.modes.standard.maxBaseFeePaise,
      settingDefaults.fees.freeDeliveryAbovePaise,
      settingDefaults.fees.smallCartFeePaise,
      settingDefaults.fees.handlingFeePaise,
      settingDefaults.cod.maxOrderValuePaise,
      settingDefaults.rider.basePayPaise,
      settingDefaults.rider.perKmPaise,
    ];
    for (const amount of amounts) {
      expect(Number.isInteger(amount)).toBe(true);
      expect(amount).toBeGreaterThanOrEqual(0);
    }
    expect(settingDefaults.fees.freeDeliveryAbovePaise).toBe(49900);
    expect(settingDefaults.rider.offerRadiusKmSteps).toEqual([2, 4, 6]);
  });
});
