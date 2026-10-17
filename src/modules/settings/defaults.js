import { paise } from '../../utils/money.js';

export const SETTING_KEYS = ['delivery', 'modes', 'fees', 'cod', 'seller', 'rider'];

export const settingDefaults = {
  delivery: {
    avgSpeedKmph: 18,
    roadFactor: 1.35,
    assignBufferMin: 4,
  },
  modes: {
    express: {
      enabled: true,
      maxRadiusKm: 5,
      baseFeePaise: paise(2500),
      perKmAfter2kmPaise: paise(700),
    },
    sameDay: {
      enabled: true,
      maxRadiusKm: 15,
      baseFeePaise: paise(1500),
      slots: [
        { start: '10:00', end: '12:00' },
        { start: '12:00', end: '14:00' },
        { start: '14:00', end: '16:00' },
        { start: '16:00', end: '18:00' },
        { start: '18:00', end: '20:00' },
      ],
      cutoff: '16:00',
    },
    standard: {
      enabled: true,
      baseFeePaise: paise(0),
      maxBaseFeePaise: paise(3000),
    },
  },
  fees: {
    freeDeliveryAbovePaise: paise(49900),
    smallCartBelowPaise: paise(19900),
    smallCartFeePaise: paise(2000),
    handlingFeePaise: paise(500),
  },
  cod: {
    enabled: true,
    maxOrderValuePaise: paise(300000),
    codFeePaise: paise(0),
    disableAfterStrikes: 3,
  },
  seller: {
    defaultCommissionPct: 10,
    acceptTimeoutSec: 180,
  },
  rider: {
    offerTimeoutSec: 25,
    offerRadiusKmSteps: [2, 4, 6],
    basePayPaise: paise(2500),
    perKmPaise: paise(600),
  },
};
