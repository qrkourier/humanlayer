To install dependencies:
```sh
bun install
```

To run:
```sh
bun run dev
```

open http://localhost:3000

## Signing-key configuration

The proxy requires `WORKOS_CLIENT_ID` to locate the public JWKS endpoint. It does
not require `WORKOS_API_KEY` or `WORKOS_REDIRECT_URI`, and does not construct a
WorkOS management client. The API and login application still have their own
WorkOS requirements.

JWT verification, organization claims and resource authorization are unchanged.
This removes an unnecessary secret from the proxy; it does not add generic OIDC
login or make the full application independent of WorkOS.
