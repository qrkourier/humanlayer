import { spawn } from 'node:child_process'
import { createServer, type IncomingHttpHeaders } from 'node:http'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

const cliEntry = fileURLToPath(new URL('../src/index.ts', import.meta.url))
const syntheticPat = 'synthetic-cli-stdin-pat'

test('humanlayer automation run sends a piped PAT to prepare without an argv token or daemon launch', async () => {
	const requests: Array<{
		method: string | undefined
		url: string | undefined
		headers: IncomingHttpHeaders
		body: string
	}> = []

	const server = createServer((request, response) => {
		let body = ''
		request.setEncoding('utf8')
		request.on('data', (chunk: string) => {
			body += chunk
		})
		request.on('end', () => {
			requests.push({
				method: request.method,
				url: request.url,
				headers: request.headers,
				body,
			})
			response.writeHead(401, { 'content-type': 'application/json' })
			response.end(JSON.stringify({ json: { error: { code: 'UNAUTHORIZED', message: 'synthetic denial' } } }))
		})
	})

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject)
		server.listen(0, '127.0.0.1', resolve)
	})

	const address = server.address()
	if (address === null || typeof address === 'string') throw new Error('Expected an ephemeral TCP listener')
	const apiOrigin = 'http://127.0.0.1:' + address.port
	const args = [
		cliEntry,
		'--local',
		'automation',
		'run',
		'--pat-stdin',
		'--ensure-task',
		'cli-stdin-process-test',
		'--task-name',
		'CLI stdin process test',
		'--session-name',
		'CLI stdin process test',
		'--prompt',
		'No-effect fixture prompt',
	]
	const child = spawn('bun', args, {
		cwd: fileURLToPath(new URL('..', import.meta.url)),
		env: {
			PATH: process.env.PATH ?? '',
			NO_COLOR: '1',
			RIPTIDE_API_ORIGIN: apiOrigin,
		},
		stdio: ['pipe', 'pipe', 'pipe'],
	})

	let output = ''
	child.stdout.setEncoding('utf8')
	child.stderr.setEncoding('utf8')
	child.stdout.on('data', (chunk: string) => {
		output += chunk
	})
	child.stderr.on('data', (chunk: string) => {
		output += chunk
	})

	try {
		child.stdin.end(syntheticPat + '\n')
		const exitCode = await new Promise<number>((resolve, reject) => {
			const timeout = setTimeout(() => {
				child.kill('SIGKILL')
				reject(new Error('CLI subprocess did not finish against the local fake API'))
			}, 10_000)
			child.once('error', (error) => {
				clearTimeout(timeout)
				reject(error)
			})
			child.once('close', (code) => {
				clearTimeout(timeout)
				resolve(code ?? -1)
			})
		})

		expect(exitCode).not.toBe(0)
		expect(args).toContain('--pat-stdin')
		expect(args).not.toContain(syntheticPat)
		if (requests.length !== 1) {
			const safeOutput = output.replaceAll(syntheticPat, '[redacted]')
			throw new Error(`Expected one prepare request, got ${requests.length}. CLI output: ${safeOutput}`)
		}
		const request = requests[0]
		if (request === undefined) throw new Error('Expected one captured API request')
		expect(request).toMatchObject({
			method: 'POST',
			url: '/rpc/api/v1/automation/run/prepare',
		})
		const { authorization, ...otherHeaders } = request.headers
		expect(authorization).toBe('Bearer ' + syntheticPat)
		expect(JSON.stringify(otherHeaders)).not.toContain(syntheticPat)
		expect(request.url).not.toContain(syntheticPat)
		expect(request.body).not.toContain(syntheticPat)
		expect(output).not.toContain(syntheticPat)
	} finally {
		if (child.exitCode === null) child.kill('SIGKILL')
		server.closeAllConnections()
		await new Promise<void>((resolve) => server.close(() => resolve()))
	}
}, 15_000)
