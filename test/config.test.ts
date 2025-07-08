import { expect } from 'chai';
// import * as sinon from 'sinon';
// import * as os from 'os';
// import * as path from 'path';
// import { createRequire } from 'module';
// import * as fsPromises from 'fs/promises';

import { validateConfig } from '../src/config';

describe('validateConfig', () => {
	it('should return parsed config when input is valid', () => {
		const input = {
			bot: { token: 'secret', check_interval_minutes: 5 },
			database: { url: 'sqlite:db.sqlite' },
		};

		const result = validateConfig(input);
		expect(result).to.deep.equal(input);
	});

	it('should throw an error when input is invalid', () => {
		const badInput = {
			bot: { token: 'secret', check_interval_minutes: 0 }, // too small
			database: { url: 'sqlite:db.sqlite' },
		};
		expect(() => validateConfig(badInput)).to.throw(/Invalid configuration/);
	});
});

// will write ensureConfig tests later.
