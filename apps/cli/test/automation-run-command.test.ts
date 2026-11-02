import { Readable } from 'node:stream'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	createApiORPCClient: vi.fn(),
	createUnauthenticatedApiORPCClient: vi.fn(),
	prepare: vi.fn(),
	createLaunchToken: vi.fn(),
	exchange: vi.fn(),
	startManagedDaemon: vi.fn(),
}))

vi.mock('../src/orpc/client', () => ({
	createApiORPCClient: mocks.createApiORPCClient,
	createUnauthenticatedApiORPCClient: mocks.createUnauthenticatedApiORPCClient,
}))

vi.mock('@humanlayer/riptide-daemon/start', () => ({
	startManagedDaemon: mocks.startManagedDaemon,
}))

import { automationRunCommand } from '../src/commands/automation-run'
import type { AutomationRunCliOptions } from '../src/commands/AutomationRun'
import type { EnvironmentConfig } from '../src/lib/macros'

const hostId = 'a1111111-1111-4111-8111-111111111111'
const sessionId = 'b2222222-2222-4222-8222-222222222222'
const otherHostId = 'c3333333-3333-4333-8333-333333333333'
const otherSessionId = 'd4444444-4444-4444-8444-444444444444'

const envConfig = {
	workosClientId: 'synthetic-workos-client',
	apiOrigin: 'http://api.test',
	syncOrigin: 'http://sync.test',
	cloudOrigin: 'http://cloud.test',
	appOrigin: 'http://app.test',
} satisfies EnvironmentConfig

const options = {
	pat: 'synthetic-pat',
	hostId,
	sessionId,
	ensureTask: 'cli-tdd-seam',
	taskName: 'CLI TDD seam',
	sessionName: 'CLI TDD seam',
	prompt: 'No-effect fixture prompt',
	codingAgent: 'codelayer',
	provider: 'codex',
	shutdownOn: 'stop',
	inactivity: '2m',
	onFailure: 'stop',
} satisfies AutomationRunCliOptions

const environmentKeys = ['LOG_LEVEL', 'RIPTIDE_CLOUD_ORIGIN', 'RIPTIDE_APP_ORIGIN'] as const
function makeStdinOptions(): Record<string, unknown> {
	const stdinOptions: Record<string, unknown> = { ...options, patStdin: true }
	Reflect.deleteProperty(stdinOptions, 'pat')
	return stdinOptions
}

const originalStdinDescriptor = Object.getOwnPropertyDescriptor(process, 'stdin')
let previousEnvironment = new Map<string, string | undefined>()

describe('automation run command identity', () => {
	beforeEach(() => {
		previousEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]))
		for (const key of environmentKeys) delete process.env[key]

		vi.clearAllMocks()
		mocks.prepare.mockResolvedValue({ taskId: 'task-id', sessionId, hostId, userId: 'user-id' })
		mocks.createLaunchToken.mockResolvedValue({ token: 'launch-token' })
		mocks.exchange.mockResolvedValue({ token: 'daemon-token' })
		mocks.startManagedDaemon.mockResolvedValue({
			type: 'automation_complete',
			completionReason: 'ready_for_input',
			finalStatus: 'ready_for_input',
		})
		mocks.createApiORPCClient.mockReturnValue({
			automation: { run: { prepare: mocks.prepare } },
			auth: { daemon: { launchToken: { create: mocks.createLaunchToken } } },
		})
		mocks.createUnauthenticatedApiORPCClient.mockReturnValue({
			auth: { daemon: { token: { exchange: mocks.exchange } } },
		})
	})

	afterEach(() => {
		for (const key of environmentKeys) {
			const value = previousEnvironment.get(key)
			if (value === undefined) delete process.env[key]
			else process.env[key] = value
		}
		if (originalStdinDescriptor !== undefined) {
			Object.defineProperty(process, 'stdin', originalStdinDescriptor)
		}
	})

	test.each([
		['host ID', { hostId: otherHostId }],
		['session ID', { sessionId: otherSessionId }],
	] as const)(
		'stops before token exchange and daemon startup when prepare returns a different %s',
		async (_identity, mismatch) => {
			mocks.prepare.mockResolvedValue({
				taskId: 'task-id',
				sessionId,
				hostId,
				userId: 'user-id',
				...mismatch,
			})

			await expect(automationRunCommand('local', envConfig, options)).rejects.toThrow(
				'Prepared automation identity does not match the requested host/session',
			)

			expect(mocks.createLaunchToken).not.toHaveBeenCalled()
			expect(mocks.exchange).not.toHaveBeenCalled()
			expect(mocks.startManagedDaemon).not.toHaveBeenCalled()
		},
	)

	test('passes the prepared host/session identity through token exchange and daemon startup', async () => {
		await expect(automationRunCommand('local', envConfig, options)).resolves.toBe(0)

		expect(mocks.prepare).toHaveBeenCalledWith(
			expect.objectContaining({
				hostId,
				sessionId,
			}),
		)
		expect(mocks.exchange).toHaveBeenCalledWith({ launchToken: 'launch-token', hostId })
		expect(mocks.startManagedDaemon).toHaveBeenCalledWith(
			expect.objectContaining({
				expectedIdentity: { userId: 'user-id', hostId },
				automation: expect.objectContaining({ targetSessionId: sessionId }),
			}),
		)
	})

	test('does not exchange tokens or start a daemon when prepare rejects', async () => {
		const conflict = new Error('Automation preparation conflicts with an existing session')
		mocks.prepare.mockRejectedValue(conflict)

		await expect(automationRunCommand('local', envConfig, options)).rejects.toBe(conflict)

		expect(mocks.createLaunchToken).not.toHaveBeenCalled()
		expect(mocks.exchange).not.toHaveBeenCalled()
		expect(mocks.startManagedDaemon).not.toHaveBeenCalled()
	})

	test('canonicalizes uppercase UUID options before prepare and daemon startup', async () => {
		const uppercaseOptions = {
			...options,
			hostId: hostId.toUpperCase(),
			sessionId: sessionId.toUpperCase(),
		}

		await expect(automationRunCommand('local', envConfig, uppercaseOptions)).resolves.toBe(0)

		expect(mocks.prepare).toHaveBeenCalledWith(expect.objectContaining({ hostId, sessionId }))
		expect(mocks.exchange).toHaveBeenCalledWith({ launchToken: 'launch-token', hostId })
		expect(mocks.startManagedDaemon).toHaveBeenCalledWith(
			expect.objectContaining({
				expectedIdentity: { userId: 'user-id', hostId },
				automation: expect.objectContaining({ targetSessionId: sessionId }),
			}),
		)
	})

	test('reads the PAT from stdin when the option contains no PAT value', async () => {
		Object.defineProperty(process, 'stdin', {
			configurable: true,
			writable: true,
			value: Readable.from(['synthetic-pat\n']),
		})

		const stdinOptions = makeStdinOptions()

		await expect(automationRunCommand('local', envConfig, stdinOptions)).resolves.toBe(0)

		expect(mocks.createApiORPCClient).toHaveBeenCalledWith(envConfig.apiOrigin, 'synthetic-pat')
	})

	test('rejects stdin PAT input from an interactive terminal', async () => {
		const stdin = Readable.from(['synthetic-pat\n'])
		Object.defineProperty(stdin, 'isTTY', { configurable: true, value: true })
		Object.defineProperty(process, 'stdin', { configurable: true, writable: true, value: stdin })

		const stdinOptions = makeStdinOptions()

		await expect(automationRunCommand('local', envConfig, stdinOptions)).rejects.toThrow('interactive terminal')
		expect(mocks.createApiORPCClient).not.toHaveBeenCalled()
	})

	test('rejects empty stdin PAT input before API calls', async () => {
		Object.defineProperty(process, 'stdin', {
			configurable: true,
			writable: true,
			value: Readable.from([]),
		})

		const stdinOptions = makeStdinOptions()

		await expect(automationRunCommand('local', envConfig, stdinOptions)).rejects.toThrow(
			'Expected one non-empty HumanLayer PAT on stdin',
		)
		expect(mocks.createApiORPCClient).not.toHaveBeenCalled()
	})
})
