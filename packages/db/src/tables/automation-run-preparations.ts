import { sql } from 'drizzle-orm'
import { bigint, index, pgTable, text, uuid } from 'drizzle-orm/pg-core'

import { organizations } from './organizations'
import { sessions } from './sessions'

/**
 * Private replay records for caller-keyed automation session preparation.
 * This table is deliberately excluded from applicationTables and Electric sync.
 */
export const automationRunPreparations = pgTable(
	'automation_run_preparations',
	{
		session_id: uuid('session_id')
			.primaryKey()
			.references(() => sessions.id, { onDelete: 'cascade' }),
		organization_id: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		created_by: text('created_by').notNull(),
		request_fingerprint: text('request_fingerprint').notNull(),
		created_at: bigint('created_at', { mode: 'bigint' })
			.notNull()
			.default(sql`(extract(epoch from now()) * 1000)::bigint`),
	},
	(table) => [index('automation_run_preparations_org_created_by_idx').on(table.organization_id, table.created_by)],
)
