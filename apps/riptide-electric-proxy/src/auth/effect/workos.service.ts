import { Context, Effect, Layer } from 'effect'

import { EnvironmentVariable } from '@/lib/effect/environment'

/** Public signing-key configuration; the proxy never calls the WorkOS management API. */
export class WorkosConfig extends Context.Service<
	WorkosConfig,
	{
		workosClientId: string
		jwksUrl: string
	}
>()('WorkosConfig') {}

export const WorkosConfigLive = Layer.effect(
	WorkosConfig,
	Effect.gen(function* () {
		const workosClientId = yield* EnvironmentVariable('WORKOS_CLIENT_ID')

		return {
			workosClientId,
			// Same public endpoint as WorkOS userManagement.getJwksUrl, without a privileged SDK client.
			jwksUrl: `https://api.workos.com/sso/jwks/${encodeURIComponent(workosClientId)}`,
		}
	}),
)
