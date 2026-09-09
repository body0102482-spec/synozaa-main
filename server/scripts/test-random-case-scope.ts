/**
 * Read-only regression for major-board random case scope.
 * Run: npx tsx scripts/test-random-case-scope.ts
 */
import { pickRandomEligibleCase } from '../src/services/subscriptionService.js';

const internalMedicine = await pickRandomEligibleCase('__random-scope-test__', [], 'seed-internal-med');
if (!internalMedicine.ok) throw new Error('Expected an eligible Internal Medicine scoped case in seeded data.');
if (internalMedicine.case.categoryId !== 'seed-chest') {
  throw new Error(`Expected Internal Medicine descendant case, got category ${internalMedicine.case.categoryId ?? 'none'}.`);
}

const missingRoot = await pickRandomEligibleCase('__random-scope-test__', [], '__missing-major-board__');
if (missingRoot.ok || missingRoot.code !== 'NO_CASES') {
  throw new Error('An unknown major board must not fall back to a case from another specialty.');
}

console.log('Specialty-scoped random case regressions passed.');
