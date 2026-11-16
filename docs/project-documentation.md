# Arenix Project Documentation

Sports Event and Tournament Management Platform

Ahad Sajjad | F-24-BSSE-059 | Section 5B

BS Software Engineering fifth semester | Foundation University Islamabad

Software Requirement Engineering Lab | Instructor Sir Waqas

Implementation documentation | 2 November 2026

## Project overview

Arenix coordinates a football or futsal tournament from team registration to final results. Organizers approve entries, create reproducible draws, schedule fixtures over venues and slots, and assign scorers. Team managers own teams and rosters. Assigned scorers submit final results. Spectators follow published fixtures, standings and brackets without an account.

The system addresses disconnected registration forms, manual draws, scheduling clashes, slow standings updates and disputed score changes. The implemented stack is React with TypeScript, NestJS and Supabase PostgreSQL.

## Objectives and scope

The first version supports single elimination, single-leg round robin, and groups followed by knockout. Tournament capacity is 4 to 32 approved teams. It implements the proposal's Must workflows, with result correction approval and unplaced-match reporting as additional features. The interface is English and responsive.

Football and futsal share win-draw-loss league rules: three points for a win and one for a draw. Knockout draws require penalties. This version does not implement cricket, badminton, payments, video streaming, native mobile apps, Swiss tournaments or double elimination. Ball-by-ball scoring and live match clocks are outside the current result-entry model.

The supplied proposal describes planned pilot and performance targets. Those targets must be evaluated with real participants and deployment measurements; they are not automatically achieved by implementing the interface.

<!-- PAGE -->

## Stakeholders and permissions

| Role           | Main capabilities                                                                                                                       | Boundary                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Organizer      | Create own tournaments, approve entries, manage venues and slots, draw fixtures, schedule, assign scorers, publish, approve corrections | Cannot manage another organizer's tournament or submit scorer-only results |
| Team manager   | Create and edit owned teams and rosters, register in open tournaments, view own registration decisions                                  | Cannot submit another manager's team or approve registrations              |
| Scorer         | Submit final results for assigned matches and request corrections                                                                       | Cannot score unassigned matches or approve own correction                  |
| Admin          | View account access and global audit records, activate or deactivate accounts                                                           | No implicit match-running permission                                       |
| Public visitor | Browse public tournaments, fixtures, results, standings and brackets                                                                    | No login, writes, private rosters or account contact details               |

Each account has exactly one role. Public signup offers organizer, team manager and scorer. An admin account is provisioned through a controlled process. Every protected API request reloads account state, so account deactivation and session revocation take effect on subsequent requests.

## Principal use cases

An organizer creates a tournament with future registration and match dates. Managers submit roster snapshots before the deadline. The organizer records approval decisions until the draw is generated. The draw uses only approved registrations and then locks registration decisions for that competition.

The organizer adds venues and time slots, generates the selected format, schedules the matches and publishes the fixtures. A scorer enters each assigned result. The system commits that result, records the previous tournament state in the audit, recalculates standings and advances knockout winners. Public pages obtain the resulting state on their next refresh.

If a scorer finds a mistake, the scorer submits a correction request with a reason. The organizer approves or rejects it. Approved changes preserve the original value in the audit history. A correction cannot silently invalidate an already finalized downstream match.

<!-- PAGE -->

## Architecture

The React frontend communicates only with the NestJS API. In development, the Vite server proxies /api requests to the loopback API. In production, Nest can serve the built React files behind an HTTPS reverse proxy. Hash-based navigation keeps public tournament URLs independent of server-side route rewriting.

The API separates HTTP handling, authentication, application services, repository operations and pure tournament rules. Zod validates incoming structures and rejects unknown fields. The core module contains deterministic fixture generation, scheduling, standings and bracket progression without database or UI dependencies.

Nest accesses hosted Supabase PostgreSQL through a backend-only connection pool with verified TLS. Supabase Auth is not used: Nest implements the proposal's bcrypt, lockout and token-lifetime rules. Supabase supplies the persistent database and its web dashboard. A Mac runs only Node.js and the app; no local database service is needed.

## Data model

| Relation           | Stored information                                                                               | Relationships                               |
| ------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| arenix.users       | Identity, one role, password hash, active flag, failed attempts, lock expiry and session version | Referenced by teams, tournaments and audits |
| arenix.teams       | Team identifier, manager identifier and validated team JSON                                      | Manager foreign key to users                |
| arenix.tournaments | Identifier, organizer, unique public slug and tournament aggregate JSON                          | Organizer foreign key to users              |
| arenix.audit       | Actor, optional tournament, action, timestamp and before and after details                       | Foreign keys to user and tournament         |

The tournament aggregate contains configuration, venues, slots, registration snapshots, seed order, matches and correction requests. This is an intentional small-tournament design. A transaction locks one tournament row, changes its aggregate, appends an audit entry and commits. This makes related match, bracket and correction changes atomic without a multi-table synchronization problem.

The tradeoff is that independent writes to the same tournament serialize, and each audit can contain a complete aggregate snapshot. This is suitable for the bounded 32-team pilot. A larger product should normalize matches, slots and registrations, use targeted audit differences, add pagination and benchmark concurrency before expansion.

## Source organization

apps/web contains React views, CSS and the HTTP client. apps/api contains controllers, authentication, repository and application services. packages/core contains types and rules. supabase/migrations contains versioned SQL files applied by the app migration runner. scripts contains environment initialization, migration and seed utilities. tests contains algorithm and PostgreSQL-backed API tests.

<!-- PAGE -->

## Fixture and draw algorithms

Round robin uses the circle method. An odd number of teams receives a rotating bye. Across the schedule, each real team pair appears exactly once. A group competition applies the same generator separately to each snake-seeded group.

Single elimination expands to the next power-of-two bracket size. Seed placement mirrors the bracket so the top two seeds can meet only in the final. Empty positions become byes; the highest seeds receive them. Bye winners advance without a fabricated score.

A random draw shuffles the approved team identifiers with a deterministic seeded generator. The draw seed and resulting order are stored and audited. Manual seeding must contain every approved team exactly once. The random generator supports reproducibility; it is not designed as a gambling-grade or adversarially fair lottery.

Group competitions support a power-of-two count of groups and require at least two teams in each. Every group plays one round robin. After all group results are final, the top two teams qualify. Adjacent groups cross: A1 plays B2, B1 plays A2, and equivalent pairings follow for later groups.

## Scheduling

The scheduler scans slots in chronological order and chooses the first compatible venue. It checks actual start and end intervals rather than assuming slot identifiers cannot overlap. A venue cannot host overlapping matches. A team cannot overlap another match and must receive the configured rest interval after the previous match ends.

For knockout fixtures with unknown winners, the scheduler reserves the possible participants of feeder matches. It also places each dependent round after its scheduled feeder matches and their rest interval. This is conservative: it may reserve more capacity than a later known result needs, but it avoids scheduling a future winner into a clash.

The implemented strategy is deterministic greedy placement with indexed reservations and pre-parsed times. It reports unplaced matches when capacity is insufficient. Limited backtracking, optimization solvers and randomized restart comparisons remain evaluation extensions; they are not implemented or claimed as completed research.

Manual rescheduling uses the same interval, team-rest and feeder-order constraints. Invalid changes are rejected before the transaction commits. Public fixtures cannot be regenerated after publication. Group knockout creation attempts scheduling automatically; the organizer resolves any remaining placements and assigns scorers.

<!-- PAGE -->

## Results and ranking

Only a match's assigned active scorer can submit its final score. Both teams and a venue and time slot must be known. Goals are integers from 0 to 99. League and group matches permit draws. A drawn knockout requires unequal penalty scores, also bounded from 0 to 99. Penalty goals decide advancement but are excluded from goal totals.

Standings calculate played, won, drawn, lost, goals for, goals against, difference and points from final group or league matches. Ranking compares points, goal difference and goals scored. Exact ties form a head-to-head mini-table ordered by points, difference and goals scored among tied teams. A stable team-identifier order resolves any remaining tie, making qualification reproducible. Organizers must communicate that fallback before a real event; there is no manual playoff or disciplinary tie-break feature.

Knockout advancement updates the next match participant in the same transaction as the saved result. Once all knockout fixtures are final or byes, the tournament becomes completed. A pure round robin completes when every fixture is final.

## Concurrency and corrections

Every match has an integer version. Assignment, rescheduling and result operations require the expected version and increase it after a change. A stale caller receives HTTP 409 and must refresh. This prevents the second of two concurrent scorer saves from silently replacing the first.

The repository also locks the tournament row with SELECT FOR UPDATE. A transaction includes the result, tournament state and audit append. If validation or persistence fails, the transaction rolls back. Other requests see the old or new aggregate, rather than a partially advanced bracket.

Submitted results are immutable through ordinary scoring. A scorer may request one pending correction per match, with a written reason. Organizer approval rechecks the match version and applies the replacement score. The before and after tournament values remain in audit history. Group corrections are blocked after qualification creates a knockout. Knockout corrections are blocked if any descendant match already has a final result. Reversing that situation needs a separately designed administrative review workflow.

## Public updates

Spectator pages are unauthenticated and read-only. They poll every two seconds while visible, avoid browser caching and display the last successful synchronization time. This provides timely refresh for the pilot, but it does not implement the proposal's optional server-push requirement or guarantee a three-second maximum under all network conditions.

<!-- PAGE -->

## Security and privacy

Passwords are hashed with bcrypt cost 12. Signup requires at least eight characters and caps input at 72 UTF-8 bytes to avoid bcrypt truncation. Five consecutive login failures lock an account for fifteen minutes. Failure counts and lock expiry are persistent PostgreSQL fields; correct credentials cannot bypass an active lock.

Signed HS256 JWTs expire after thirty minutes and carry a session version. They use an HttpOnly, SameSite Strict cookie scoped to /api. Secure cookies are enabled in production. Logging out or changing account activation increases the database session version, invalidating existing tokens. Every authenticated request checks active status and session version against the database.

Mutating browser requests must have the configured Origin header. CORS permits the same configured origin, and browser requests use the same origin through the proxy. Helmet supplies standard response headers. API responses use no-store caching. The API uses parameterized SQL and strict input validation. Unexpected errors return a generic response rather than database details.

Role checks are combined with resource ownership and scorer assignment. An organizer role alone does not grant access to every tournament. Admin oversight does not grant organizer or scorer actions. Public signup cannot create an admin.

Application tables use the arenix schema, outside the default public Supabase Data API. Their row-level security is enabled without browser policies. The database owner can bypass row-level security, so Nest remains the authorization boundary. A public production service should use a dedicated backend login with controlled grants. Database credentials are never sent to React.

No national identity number, telephone number or address is collected. Public views omit account emails, private roster names, manager identifiers, pending registrations, scorer identifiers and correction requests. Audit access is restricted to the owning organizer or admin.

## Operational limitations

The current per-IP authentication throttle is held in process memory and permits twenty attempts per minute. Multi-instance hosting needs a shared limiter. The database-backed account lock remains authoritative. HTTPS is a deployment responsibility. Password reset, email verification, invitations, self-service account deletion and automated data retention are future account-lifecycle features, and should be completed before offering this beyond a controlled pilot.

<!-- PAGE -->

## API contract

All routes start with /api. Protected routes authenticate the session cookie. Writes require the configured Origin header. Validation failures return 400, unauthenticated or expired sessions return 401, forbidden role or ownership actions return 403, missing resources return 404 and stale match versions return 409. Account lock returns 423 and authentication throttling returns 429.

| Routes                                            | Purpose                                                    |
| ------------------------------------------------- | ---------------------------------------------------------- |
| POST auth/register and auth/login                 | Create a non-admin account and sign in                     |
| GET auth/me and POST auth/logout                  | Current identity and session invalidation                  |
| GET public/tournaments and public/tournaments/:id | Discover public competitions and read a safe snapshot      |
| GET and POST tournaments                          | List accessible tournaments and create an owned tournament |
| GET tournaments/:id                               | Authorized detailed tournament state                       |
| POST tournaments/:id/actions/:action              | Validated tournament operations                            |
| GET and POST teams and PUT teams/:id              | Manager-owned teams and master rosters                     |
| GET scorers                                       | Active scorer identifiers and display names for organizers |
| GET users and POST users/:id/active               | Admin account oversight                                    |
| GET audit and tournaments/:id/audit               | Authorized audit history                                   |
| GET health and meta                               | Database readiness and temporary-review status             |

Tournament actions are register, decide-registration, venue, slot, generate, schedule, reschedule, assign-scorer, publish, result, request-correction and decide-correction. Each action uses a separate strict validation schema. The service performs transaction-time role, ownership and state checks.

<!-- PAGE -->

## Requirements traceability

| Proposal requirement     | Implemented behavior                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| FR 1 to FR 3             | Email and password signup, one role per account, persistent failed-login lock            |
| FR 4 to FR 6             | Tournament configuration, three formats, venues and time slots                           |
| FR 7 to FR 9             | Owned teams, validated roster snapshots, deadline enforcement and recorded decisions     |
| FR 10 to FR 12           | Manual or reproducible seeded draws, approved entries only, exact round-robin pairs      |
| FR 13 and FR 15          | Overlap and rest constraints, feeder-order checks, rejected conflicting reschedules      |
| FR 16 and FR 17          | Bounded two-team score entry restricted to the assigned scorer                           |
| FR 19 and FR 20          | Synchronous table calculation and documented multi-level ranking                         |
| FR 21 and FR 22          | Transactional knockout advancement and safe public fixtures, scores, tables and brackets |
| FR 26 and FR 27          | Admin activation control and actor-stamped audit history                                 |
| Optional FR 14 and FR 18 | Unplaced fixture reporting and approved, reasoned result corrections                     |
| Optional FR 23 to FR 25  | Polling replaces server push; email and PDF tournament export are deferred               |

## Nonfunctional evaluation

Algorithm correctness is checked across one hundred generated tournaments with four to thirty-two teams and all three formats. Additional tests cover odd counts, byes, seeding, group qualification, penalties, tie-breaks and downstream correction protection. Core coverage exceeds the proposal's seventy-percent target in the recorded run; consult the verification record for exact results.

The local benchmark checks that a thirty-two-team round robin can generate and schedule its 496 fixtures within five seconds. This is a local algorithm measurement, not evidence that a hosted API meets a hundred-concurrent-user latency target. A production load test and database benchmark remain required.

HTTPS, deployment certificate settings, mobile and desktop browser compatibility, pilot organizer completion time, manual pilot standings comparison and System Usability Scale scores need their respective environment or participant evidence. No real tournament pilot or SUS result is claimed in this documentation.

<!-- PAGE -->

## Interface design

The frontend uses a dark olive background, lime primary actions, condensed sports typography and team-color badges. The organizer overview shows the selected tournament, approved team count, fixtures, results, pending entries, upcoming matches, recent scores and a leaderboard. Counts are derived from the selected tournament's stored state.

Dedicated screens support tournaments, team registrations, match management, tables and brackets, venues and slots, audit history and admin accounts. Forms show validation errors, dialogs preserve keyboard interaction and the mobile layout uses an expandable sidebar. Public pages have a separate discovery and tournament experience with no login requirement.

Fonts are currently requested from Google Fonts with local fallbacks. A strict offline or privacy-focused deployment can self-host those fonts. Decorative pitch graphics are CSS and SVG, so they do not require external image services.

## Screen responsibilities

| Screen                  | Main task                                                                 |
| ----------------------- | ------------------------------------------------------------------------- |
| Overview                | Inspect tournament counts, upcoming fixtures, results and the leaderboard |
| Tournaments             | Create or select a competition                                            |
| Teams and registrations | Create master rosters, submit teams, and record approval decisions        |
| Match center            | Generate draws, schedule, assign scorers, publish and record results      |
| Standings and bracket   | Compare teams and follow knockout progression                             |
| Venues and time slots   | Configure locations and time capacity                                     |
| Activity log            | Inspect actor, time and before and after values                           |
| User accounts           | Admin activation control                                                  |

Forms validate input on the client and server. Empty states explain the next workflow step. Errors are displayed beside the current task, and saved changes are confirmed through notifications. The public experience separates read-only following from staff operations.

<!-- PAGE -->

## Validation and future work

The verification record in docs/verification.md distinguishes automated checks, browser inspection and the live Supabase integration check. API tests use isolated in-memory PostgreSQL so they cannot reset the developer's Supabase data. Normal development uses a hosted Supabase database configured in .env. The separate preview command uses temporary data and does not validate a hosted connection.

Important failure paths include late registration, oversized rosters, capacity overflow, cross-owner access, unassigned scoring, stale saves, conflicting venues, insufficient rest, inactive accounts and invalid knockout draws. The suite exercises these boundaries alongside successful state changes.

## Remaining product decisions

Before a real university pilot, agree on the exact-tie fallback, roster substitution policy and procedures for reversing finalized downstream results. Confirm competition duration, slot lengths and rest requirements with the sports office. A conflict-free schedule can still be operationally unsuitable if the configured durations are unrealistic.

The first account-lifecycle extensions should be password recovery, email verification and invitation-based staff assignment. Infrastructure extensions should add shared rate limiting, backups with tested restore, structured monitoring, and a measured production load test. Optional tournament work includes transactional email delivery, server-pushed public updates and PDF fixture exports.

Cricket and badminton should be separate rule modules rather than extra labels on football score forms. Their scoring, ties, progression and ranking need dedicated requirements and tests before the product claims support.

## Delivery contents

The handover includes source code, a dependency lockfile, environment examples, SQL migrations, sample accounts, automated tests, a macOS setup guide and this project documentation. The private Arenix repository contains the source. The app runs on the Mac and connects to a hosted Supabase development project; no public app deployment is configured.

## References

The requirements baseline is the nine-page Arenix project proposal supplied for this task. Implementation details are supported by the repository source, tests and recorded verification results.

- React documentation: https://react.dev/
- NestJS documentation: https://docs.nestjs.com/
- Vite guide: https://vite.dev/guide/
- Supabase database connections: https://supabase.com/docs/guides/database/connecting-to-postgres
- node-postgres TLS: https://node-postgres.com/features/ssl

The original proposal's competitor judgments and planned usability or pilot outcomes were not independently evaluated in this implementation. They should not be presented as completed findings in a submission or product pitch.
