import { isValidEgyptianMobile } from '../src/lib/phoneValidation.js';

const valid = ['01012345678', '01112345678', '01212345678', '01512345678'];
const invalid = ['01312345678', '0101234567', '010123456789', '0101234abcd', '010 12345678'];

for (const phone of valid) {
  if (!isValidEgyptianMobile(phone)) throw new Error(`Expected valid Egyptian mobile: ${phone}`);
}
for (const phone of invalid) {
  if (isValidEgyptianMobile(phone)) throw new Error(`Expected invalid Egyptian mobile: ${phone}`);
}

console.log('Egyptian mobile validation regressions passed.');
