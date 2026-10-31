import { randomUUID } from 'node:crypto'

import { conversationEvents } from '@humanlayer/db/tables/conversation-events'
import { organizations } from '@humanlayer/db/tables/organizations'
import { sessions } from '@humanlayer/db/tables/sessions'
import type { ApiKey } from '@workos-inc/node'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { Effect, Layer } from 'effect'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { WorkosService } from '../../src/effects/services/workos/workos.service'
import { createMockStripeService, createMockWorkosService } from '../mocks'
import type { createApp } from '../test-factory'
import { createRuntimeWithTestPostgresLayer, makeTestWorkosService } from '../utils/effect-procedure-test-runtime'
import { requireExternalTestServices } from '../utils/external-test-services'
import { createTestDb } from '../utils/test-db'

await requireExternalTestServices()

describe('automation.run.prepare API route', () => {
	let db: PostgresJsDatabase
	let cleanup: (() => Promise<void>) | undefined
	let effectRuntime: ReturnType<typeof createRuntimeWithTestPostgresLayer> | undefined
	let app: ReturnType<typeof createApp> | undefined
	let organizationId: string
	const userId = 'automation-http-user'
	const workosOrganizationId = `workos-automation-http-${randomUUID()}`
	const syntheticPat = 'automation_http_test_pat'
	let apiKeyValidationCalls = 0

	beforeAll(async () => {
		const testDb = await createTestDb('automation_prepare_http')
		db = testDb.db
		cleanup = testDb.cleanup
		const [organization] = await db
			.insert(organizations)
			.values({ name: 'Automation HTTP test', workos_organization_id: workosOrganizationId })
			.returning()
		if (!organization) throw new Error('Failed to create HTTP test organization')
		organizationId = organization.id

		const userApiKey = {
			object: 'api_key',
			id: 'automation-http-key',
			name: 'Automation HTTP test',
			owner: { type: 'user', id: userId, organizationId: workosOrganizationId },
			obfuscatedValue: 'sk_...test',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			expiresAt: new Date(Date.now() + 60_000).toISOString(),
			lastUsedAt: null,
			permissions: [],
		} as unknown as ApiKey
		const workosService = makeTestWorkosService({
			validateApiKey: ({ value }) => {
				apiKeyValidationCalls += 1
				return Effect.succeed(value === syntheticPat ? userApiKey : null)
			},
		})
		const runtime = createRuntimeWithTestPostgresLayer(db, {
			workos: Layer.succeed(WorkosService, workosService),
		})
		effectRuntime = runtime
		vi.doMock('../../src/effects/app-runtime', () => ({ appRuntime: runtime }))
		const { createApp } = await import('../test-factory')
		app = createApp({
			db,
			workos: createMockWorkosService(),
			stripe: createMockStripeService(),
			effectRuntime: runtime,
		})
	}, 60_000)

	afterAll(async () => {
		await effectRuntime?.dispose()
		await cleanup?.()
	}, 30_000)

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

	test('authenticates prepare replays and rejects changed or invalid requests', async () => {
		if (!app) throw new Error('Test Hono API app was not initialized')

		async function request(input: ReturnType<typeof ensureInput>, pat = syntheticPat) {
			return app!.request('/rpc/api/v1/automation/run/prepare', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${pat}`,
				},
				body: JSON.stringify(input),
			})
		}

		const input = ensureInput(`hono-${randomUUID()}`)
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

		const unauthenticatedInput = ensureInput(`unauthenticated-${randomUUID()}`)
		const unauthenticatedResponse = await request(unauthenticatedInput, 'invalid_prepare_pat')
		expect(unauthenticatedResponse.status).toBe(401)
		expect(await unauthenticatedResponse.json()).toMatchObject({ code: 'UNAUTHORIZED' })

		expect(apiKeyValidationCalls).toBe(4)
		expect(await db.select().from(sessions).where(eq(sessions.id, unauthenticatedInput.sessionId))).toHaveLength(0)
		expect(await db.select().from(sessions).where(eq(sessions.id, input.sessionId))).toHaveLength(1)
		expect(
			await db.select().from(conversationEvents).where(eq(conversationEvents.session_id, input.sessionId)),
		).toHaveLength(1)
	})
})
