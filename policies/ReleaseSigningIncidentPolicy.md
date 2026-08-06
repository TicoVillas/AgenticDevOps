# Release Signing and Compromised-Key Incident Policy

## Scope and authority

This policy governs release-contract verification, Ed25519 public trust metadata, rotation, revocation, and compromised-key response. It does not authorize signing, draft creation, upload, publication, repository configuration, credential access, or use of a real private key. Those operations require separate current authorization and a protected signing environment in `Supervised` mode.

Drafts, reviews, recommendations, defaults, test fixtures, configuration, and successful validation are not approval. Artifact attestation is optional and non-blocking; it cannot replace manifest or checksum signature verification.

## Private-key boundary

Core code accepts an injected signer callback over caller-supplied bytes. Core code must not read a private-key file, secret environment variable, keyring, credential store, KMS/HSM, network service, or signing agent. Private material must remain outside repositories, packages, release assets, logs, evidence, fixtures, command arguments, and operational state. Tests may generate ephemeral keys in memory or temporary roots and must label all persistent synthetic material `TEST_ONLY`.

The manifest and `SHA256SUMS` are signed independently with Ed25519. Verification binds the exact target bytes, target SHA-256, key ID, SHA-256 fingerprint of DER SPKI public bytes, trust-store status, validity interval, and detached signature envelope. A mutable branch, `refs/heads`, unresolved/movable tag, clone, or raw branch URL is never a release identity.

## Trust, rotation, and revocation

A trust store contains public material only. Key IDs and fingerprints are unique. Exactly one or more current `ACTIVE` keys may exist during a documented overlap. Rotation requires an authenticated `ROTATION` event naming the previous and new keys and an explicit overlap end. `RETIRED` keys remain available only for historical verification at the release signing time; they cannot authorize a new signature.

Revocation requires authenticated revocation metadata bound by SHA-256. A `REVOKED` key fails all verification unless a future independently reviewed policy explicitly defines bounded historical treatment; this policy defines no such exception. Unknown keys, fingerprint mismatch, malformed public material, invalid time bounds, contradictory event history, unauthenticated metadata, and absent trust state fail closed.

## Compromise hard stop

Suspected or confirmed private-key exposure immediately sets `hard_stop: true` and `publish_authorized: false`. No new signing, draft mutation, upload, publication, retry, or release assertion may proceed. The incident owner must:

1. identify and authenticate the affected key IDs;
2. issue authenticated revocation metadata;
3. inventory and assess every potentially affected release;
4. generate replacement material only in a separately approved protected environment;
5. activate replacement public metadata through an authenticated rotation path;
6. communicate affected releases and remediation without exposing sensitive material;
7. reverify manifest, checksums, SBOM, exact tag/commit/release identity, and immutable-release control;
8. close the incident only with complete evidence and independent authorization.

Ambiguous state remains `OPEN` and `BLOCKED`. Cleanup of evidence, trust metadata, or affected artifacts is not implied.

## Immutability gate

Publication readiness requires either observed native immutability or an explicitly approved compensating control bound to the exact release. If provider capability is unavailable, unknown, mutable, or not observed, the result is `BLOCKED` unless the compensating-control schema validates and its explicit authorization reference/hash is current. The gate is deterministic and local; it does not query or change a provider.

Neither readiness nor a compensating-control record grants draft or publish authority. A `READY` result does not grant draft or publish authority. After any eventual publication, a separate operation must redownload the exact release and reverify identity, sizes, hashes, both signatures, trust/revocation state, SBOM binding, and immutability evidence.
