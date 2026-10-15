import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateCaseQuota } from './subscriptionService.js';

test('raises a user quota without changing the base plan quota', () => {
  assert.deepEqual(calculateCaseQuota(60, 64, 10), {
    baseCasesQuota: 60,
    casesQuotaOverride: 64,
    casesQuotaAdjustment: 4,
    casesQuota: 64,
    casesQuotaUsed: 10,
    casesRemaining: 54,
  });
});

test('lowers a user quota and keeps prior usage while preventing more sessions', () => {
  assert.deepEqual(calculateCaseQuota(60, 8, 10), {
    baseCasesQuota: 60,
    casesQuotaOverride: 8,
    casesQuotaAdjustment: -52,
    casesQuota: 8,
    casesQuotaUsed: 10,
    casesRemaining: 0,
  });
});

test('clears an override and restores the current plan quota', () => {
  assert.deepEqual(calculateCaseQuota(30, null, 12), {
    baseCasesQuota: 30,
    casesQuotaOverride: null,
    casesQuotaAdjustment: 0,
    casesQuota: 30,
    casesQuotaUsed: 12,
    casesRemaining: 18,
  });
});

test('calculates overrides independently for different users', () => {
  const userQuotas = [
    calculateCaseQuota(30, 34, 2),
    calculateCaseQuota(60, null, 2),
  ];

  assert.equal(userQuotas[0].casesQuota, 34);
  assert.equal(userQuotas[1].casesQuota, 60);
  assert.equal(userQuotas[0].casesQuotaAdjustment, 4);
  assert.equal(userQuotas[1].casesQuotaAdjustment, 0);
});
