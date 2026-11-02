import { describe, expect, test } from 'vitest'

import { applicationTables, automationRunPreparations, sessions } from './schema'

describe('application table registry', () => {
	test('keeps private automation preparation replay records out of the registry', () => {
		expect(applicationTables).toContain(sessions)
		expect(applicationTables).not.toContain(automationRunPreparations)
	})
})
