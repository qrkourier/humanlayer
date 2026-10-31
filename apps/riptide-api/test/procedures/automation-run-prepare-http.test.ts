import { randomUUID } from 'node:crypto'

import { conversationEvents } from '@humanlayer/db/tables/conversation-events'
import { organizations } from '@humanlayer/db/tables/organizations'
import { sessions } from '@humanlayer/db/tables/sessions'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { automationRunPrepareProcedure as liveAutomationRunPrepareProcedure } from '../../src/orpc/api/automation-run-prepare.effect'
import { createMockApiAuth, createMockApiContext } from '../mocks'
import { bindProcedureToRuntime, createRuntimeWithTestPostgresLayer } from '../utils/effect-procedure-test-runtime'
import { requireExternalTestServices } from '../utils/external-test-services'
import { createTestDb } from '../utils/test-db'

await requireExternalTestServices()

describe('automation.run.prepare HTTP handler', () => {
	let db: PostgresJsDatabase
	let cleanup: (() => Promise<void>) | undefined
	let effectRuntime: ReturnType<typeof createRuntimeWithTestPostgresLayer> | undefined
	let organizationId: string
	const userId = 'automation-http-user'
	const workosOrganizationId = `workos-automation-http-${randomUUID()}`

	beforeAll(async () => {
		const testDb = await createTestDb('automation_prepare_http')
		db = testDb.db
		cleanup = testDb.cleanup
		effectRuntime = createRuntimeWithTestPostgresLayer(db)
		const [organization] = await db
			.insert(organizations)
			.values({ name: 'Automation HTTP test', workos_organization_id: workosOrganizationId })
			.returning()
		if (!organization) throw new Error('Failed to create HTTP test organization')
		organizationId = organization.id
	}, 60_000)

	afterAll(async () => {
		await effectRuntime?.dispose()
		await cleanup?.()
	}, 30_000)

	function context() {
		return createMockApiContext({
			auth: createMockApiAuth({ userId, organizationId, workosOrganizationId }),
			services: { db, dbReadReplica: db },
		})
	}

	function ensureInput(slug: string) {
		return {
			taskMode: 'ensure' as const,
			slug,
			task: { name: 'HTTP idempotent run', workflowType: 'freeform' as const, worktreeTiming: 'never' as const },
			hostId: randomUUID(),
			sessionId: randomUUID(),
			sessionName: 'HTTP idempotent run',
			prompt: 'Prepare an isolated test session',
			workingDirectory: '/checkout',
			codingAgent: 'codelayer' as const,
			provider: 'anthropic',
			model: 'opus',
			permissionsMode: 'bypass' as const,
		}
	}

	test('concurrent HTTP replay returns one receipt and changed input conflicts', async () => {
		const automationRunPrepareProcedure = bindProcedureToRuntime(liveAutomationRunPrepareProcedure, effectRuntime!)
		const testRouter = {
			automation: {
				run: { prepare: automationRunPrepareProcedure },
			},
		}
		const handler = new OpenAPIHandler(testRouter)

		async function request(input: ReturnType<typeof ensureInput>) {
			const result = await handler.handle(
				new Request('http://localhost/rpc/api/v1/automation/run/prepare', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(input),
				}),
				{ prefix: '/rpc/api/v1', context: context() },
			)
			if (!result.matched) throw new Error('Automation prepare request did not match the OpenAPI handler')
			return result.response
		}

		const input = ensureInput(`http-${randomUUID()}`)
		const [firstResponse, replayResponse] = await Promise.all([request(input), request(input)])
		expect(firstResponse.status).toBe(200)
		expect(replayResponse.status).toBe(200)
		const first = await firstResponse.json()
		const replay = await replayResponse.json()
		expect(replay).toEqual(first)
		expect(first).toMatchObject({ userId, hostId: input.hostId, sessionId: input.sessionId })

		const conflictResponse = await request({ ...input, prompt: 'Changed request payload' })
		expect(conflictResponse.status).toBe(409)
		expect(await conflictResponse.json()).toMatchObject({ code: 'AUTOMATION_PREPARATION_CONFLICT' })

		expect(await db.select().from(sessions).where(eq(sessions.id, input.sessionId))).toHaveLength(1)
		expect(
			await db.select().from(conversationEvents).where(eq(conversationEvents.session_id, input.sessionId)),
		).toHaveLength(1)
	})
})
