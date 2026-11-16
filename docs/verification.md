# Verification record

Updated on 2 November 2026 for the simplified macOS and hosted Supabase setup.

- Removed the Supabase CLI dependency, local service configuration, container startup scripts and shipped Windows-only document converter.
- npm run build passed, including TypeScript checks and the production frontend/backend builds.
- npm run test:coverage passed: 125 tests across 3 files, exit 0.
- Includes 100 generated tournament cases and 5 hosted-connection configuration tests.
- Configuration checks cover separate passwords with reserved characters, strict TLS, copied SSL options, missing certificates and missing settings.
- Core engine coverage: 100 percent statements, lines and functions; 97.22 percent branches.
- Aggregate core coverage including type declarations: 81.08 percent lines, 96.83 percent branches, 95.23 percent functions.
- Latest local 32-team round-robin generation and scheduling: 496 fixtures in 294.0 ms.
- The setup guide targets macOS, but execution was verified on Windows, not on a Mac.
- No hosted Supabase connection was attempted because no project credentials were supplied.
- No real pilot, SUS result, hosted load test or complete cross-browser result is claimed.
- Word documents were rendered with Microsoft Word and rasterized with Poppler. All 14 pages were visually inspected; the final refined pages were rechecked and the remaining pages matched the already inspected images.
