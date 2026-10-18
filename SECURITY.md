# Security Policy

## Supported versions

Mobix is an experimental beta. No version is guaranteed to receive production security fixes. The maintainers will triage responsibly disclosed vulnerabilities as resources allow.

## Reporting vulnerabilities

**Do not post exploitable security vulnerabilities in public issues.** Use GitHub **Security → Report a vulnerability** after the maintainer enables private vulnerability reporting. If unavailable, contact the repository owner privately. Maintainers must configure a dedicated security email or private reporting channel before public launch.

Include affected version, impact, reproduction steps, and proof of concept where safe. Do not publish credentials, signing keys, or private user data.

## Threat model

Treat web content as untrusted. Native bridge messages must be validated, origin-scoped, permission-checked, and size-bounded. Signing credentials and publishing tokens must never be stored in the repository.
