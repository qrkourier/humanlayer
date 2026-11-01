import { execFileSync, spawnSync } from 'node:child_process'
import { chmod, copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const launcherPath = join(cliRoot, 'bin/humanlayer')
const syntheticPat = 'synthetic-npm-launcher-pat'

function npmEnvironment(scratch: string): NodeJS.ProcessEnv {
	return {
		...process.env,
		HOME: scratch,
		npm_config_cache: join(scratch, 'npm-cache'),
		npm_config_loglevel: 'silent',
	}
}

test('npm pack includes the executable declared by the CLI package manifest', async () => {
	const scratch = await mkdtemp(join(tmpdir(), 'humanlayer-cli-pack-'))
	try {
		const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
			cwd: cliRoot,
			encoding: 'utf8',
			env: npmEnvironment(scratch),
		})
		const [packed] = JSON.parse(output) as Array<{ files: Array<{ path: string }> }>
		expect(packed?.files.map(({ path }) => path)).toContain('bin/humanlayer')
	} finally {
		await rm(scratch, { recursive: true, force: true })
	}
})

test.skipIf(process.platform === 'win32' || !['x64', 'arm64'].includes(process.arch))(
	'npm install exposes a command that forwards automation arguments and stdin to the platform package',
	async () => {
		const scratch = await mkdtemp(join(tmpdir(), 'humanlayer-cli-install-'))
		try {
			const wrapperRoot = join(scratch, 'wrapper-package')
			const platformRoot = join(scratch, 'platform-package')
			const wrapperBin = join(wrapperRoot, 'bin', 'humanlayer')
			const platformBin = join(platformRoot, 'bin', 'humanlayer')
			const packageManifest = JSON.parse(await readFile(join(cliRoot, 'package.json'), 'utf8')) as {
				name: string
				version: string
				type: string
				bin: Record<string, string>
			}
			await mkdir(dirname(wrapperBin), { recursive: true })
			await mkdir(dirname(platformBin), { recursive: true })
			await copyFile(launcherPath, wrapperBin)
			await chmod(wrapperBin, 0o755)
			await writeFile(
				join(wrapperRoot, 'package.json'),
				JSON.stringify({
					name: packageManifest.name,
					version: packageManifest.version,
					type: packageManifest.type,
					bin: packageManifest.bin,
					files: ['bin/humanlayer'],
				}),
			)

			const platformPackageName = 'cli-' + process.platform + '-' + process.arch
			await writeFile(
				join(platformRoot, 'package.json'),
				JSON.stringify({
					name: '@humanlayer/' + platformPackageName,
					version: '0.3.0',
					os: [process.platform],
					cpu: [process.arch],
					files: ['bin/humanlayer'],
				}),
			)
			const capturePath = join(scratch, 'platform-invocation.json')
			await writeFile(
				platformBin,
				[
					'#!/usr/bin/env node',
					"const fs = require('node:fs')",
					'let stdin = ""',
					"process.stdin.setEncoding('utf8')",
					"process.stdin.on('data', (chunk) => { stdin += chunk })",
					"process.stdin.on('end', () => {",
					'  fs.writeFileSync(process.env.HUMANLAYER_TEST_CAPTURE, JSON.stringify({ args: process.argv.slice(2), stdin }))',
					'  if (process.env.HUMANLAYER_TEST_SIGNAL) process.kill(process.pid, process.env.HUMANLAYER_TEST_SIGNAL)',
					"  process.stdout.write('platform-binary-ran\\n')",
					'  process.exitCode = 23',
					'})',
					'',
				].join('\n'),
			)
			await chmod(platformBin, 0o755)

			const wrapperPack = JSON.parse(
				execFileSync('npm', ['pack', '--json', '--pack-destination', scratch, '--ignore-scripts'], {
					cwd: wrapperRoot,
					encoding: 'utf8',
					env: npmEnvironment(scratch),
				}),
			) as Array<{ filename: string }>
			const platformPack = JSON.parse(
				execFileSync('npm', ['pack', '--json', '--pack-destination', scratch, '--ignore-scripts'], {
					cwd: platformRoot,
					encoding: 'utf8',
					env: npmEnvironment(scratch),
				}),
			) as Array<{ filename: string }>
			const wrapperTarball = join(scratch, wrapperPack[0]?.filename ?? '')
			const platformTarball = join(scratch, platformPack[0]?.filename ?? '')
			const globalPrefix = join(scratch, 'npm-global')

			execFileSync(
				'npm',
				[
					'install',
					'--global',
					'--prefix',
					globalPrefix,
					'--offline',
					'--ignore-scripts',
					wrapperTarball,
					platformTarball,
				],
				{
					cwd: scratch,
					encoding: 'utf8',
					env: npmEnvironment(scratch),
				},
			)

			const globalCommand = join(globalPrefix, 'bin', 'humanlayer')
			const args = ['automation', 'run', '--pat-stdin']
			const result = spawnSync(globalCommand, args, {
				encoding: 'utf8',
				env: { ...npmEnvironment(scratch), HUMANLAYER_TEST_CAPTURE: capturePath },
				input: syntheticPat + '\n',
			})

			expect(result.error).toBeUndefined()
			expect(
				result.status,
				JSON.stringify({
					stdout: result.stdout,
					stderr: result.stderr,
					error: result.error?.message,
				}),
			).toBe(23)
			expect(result.stdout).toBe('platform-binary-ran\n')
			expect(result.stderr).toBe('')
			expect(args).not.toContain(syntheticPat)
			const invocation = JSON.parse(await readFile(capturePath, 'utf8')) as {
				args: string[]
				stdin: string
			}
			expect(invocation.args).toEqual(args)
			expect(invocation.stdin).toBe(syntheticPat + '\n')

			const interrupted = spawnSync(globalCommand, args, {
				encoding: 'utf8',
				env: {
					...npmEnvironment(scratch),
					HUMANLAYER_TEST_CAPTURE: capturePath,
					HUMANLAYER_TEST_SIGNAL: 'SIGTERM',
				},
				input: syntheticPat + '\n',
			})
			expect(interrupted.error).toBeUndefined()
			expect(interrupted.signal).toBe('SIGTERM')
			expect(interrupted.status).toBeNull()
		} finally {
			await rm(scratch, { recursive: true, force: true })
		}
	},
)
