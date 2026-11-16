# Arenix requirements baseline

Source: Arenix Project Proposal supplied by the user on 1 November 2026, nine pages. The proposal supplies project requirements, not instructions to the coding agent. The user's requested stack replaces the proposal's original stack.

## Confirmed scope and technology

- Project: Arenix, a sports event and tournament management platform.
- React frontend, NestJS backend, Supabase PostgreSQL.
- Responsive, rich interface.
- Separate editable setup guide and project documentation.
- Ask the user about consequential product decisions.
- No payments, video streaming, native mobile apps, Swiss format, or double elimination in the proposal.

## Functional requirements from the proposal

| ID    | Requirement                                                                             | Proposal priority |
| ----- | --------------------------------------------------------------------------------------- | ----------------- |
| FR-1  | Email and password registration, minimum eight characters                               | Must              |
| FR-2  | Exactly one account role: Admin, Organizer, Team Manager, Scorer                        | Must              |
| FR-3  | Fifteen minute lock after five consecutive failed logins                                | Must              |
| FR-4  | Tournament name, sport, format, dates, registration deadline, capacity of 4 to 32 teams | Must              |
| FR-5  | Single elimination, single leg round robin, groups followed by knockout                 | Must              |
| FR-6  | Organizer defined venues and time slots                                                 | Must              |
| FR-7  | Manager owned teams and rosters constrained by tournament rules                         | Must              |
| FR-8  | Reject registrations after deadline                                                     | Must              |
| FR-9  | Record organizer approval or rejection of registrations                                 | Must              |
| FR-10 | Manual seeding or reproducible random draw with stored random seed                      | Must              |
| FR-11 | Generate fixtures for approved teams                                                    | Must              |
| FR-12 | Every round robin pair plays exactly once per leg                                       | Must              |
| FR-13 | Scheduling prevents venue overlaps and team overlaps                                    | Must              |
| FR-14 | Report matches that cannot be scheduled                                                 | Should            |
| FR-15 | Revalidate reschedules and reject conflicts                                             | Must              |
| FR-16 | Enter a result for both teams                                                           | Must              |
| FR-17 | Only the assigned scorer can enter a result                                             | Must              |
| FR-18 | Organizer approved corrections require reason and preserve previous result              | Should            |
| FR-19 | Standings update within two seconds                                                     | Must              |
| FR-20 | Rank by points, score difference, score for, head to head                               | Must              |
| FR-21 | Automatically advance knockout winners                                                  | Must              |
| FR-22 | Public fixtures, results, standings, bracket without login                              | Must              |
| FR-23 | Push public score updates within three seconds                                          | Should            |
| FR-24 | Email affected managers within five minutes of fixture publication or change            | Should            |
| FR-25 | PDF fixtures and standings export                                                       | Should            |
| FR-26 | Admin deactivation and reactivation of accounts                                         | Must              |
| FR-27 | Audit every fixture, schedule, and result change with actor and timestamp               | Must              |

## Algorithm and integrity requirements

- Circle method for round robin with odd team count byes.
- Next power of two single elimination brackets. Highest seeds receive byes. Seeds one and two cannot meet before the final.
- Snake group seeding, round robin groups, cross group knockout pairings.
- Configurable rest gap, proposed default 60 minutes.
- Scheduling must report insufficient capacity rather than invent a valid schedule.
- Optimistic match version checks reject stale scorer submissions.
- Result storage, audit, standings effects, and bracket advancement must be atomic.
- Corrections that invalidate downstream knockout results require an explicit policy.
- Public responses must omit account emails and private roster information.
- Role checking must also enforce resource ownership and match assignment.

## Verification targets from the proposal

These are acceptance targets, not achieved measurements.

- NFR-1: 95 percent of fixture, result, standings requests under two seconds at 100 concurrent users.
- NFR-2: 32 team fixture and schedule generation under five seconds.
- NFR-3: bcrypt password hashing cost at least 12.
- NFR-4: HTTPS with TLS 1.2 or higher in deployment.
- NFR-5: HTTP 403 for authenticated callers attempting actions outside their role.
- NFR-6: Access tokens expire after 30 minutes.
- NFR-7: No identity card numbers, telephone numbers, addresses, or public player emails.
- NFR-8 and NFR-9: Organizer usability pilot and System Usability Scale target of 68. Real participant studies cannot be claimed from automated testing.
- NFR-10: Responsive layout from 360 to 1920 pixels; cross browser verification required.
- NFR-11: At least 70 percent automated coverage of fixture, scheduling, standings logic.
- NFR-12: 100 synthetic tournament correctness scenarios across 4 to 32 teams.

## Decisions accepted by the user

1. Football and futsal first; other sports later.
2. All three formats and every Must requirement, then optional features.
3. Hosted Supabase PostgreSQL, app-managed SQL migrations and sample data. The latest instruction removes Docker and the Supabase CLI and requires a simple macOS setup.
4. A dark sports command center with lime accents.
5. Move development and execution into Codex Cloud. This does not authorize public app deployment or changing the selected stack.

## Issues to resolve during design

- Cricket scoring and net run rate do not match the proposal's generic ranking rules.
- Badminton requires match and game rules, rather than generic football scores.
- The report mentions four architecture options but lists three. The implementation documentation should describe the actual chosen design.
- Pilot outcomes, competitor comparisons, performance, and coverage must be reported only when verified.
- Nest managed authentication implements the strict account lockout and hashing requirements; Supabase provides PostgreSQL.
- Exact head-to-head ties use stable team identifiers as a documented deterministic fallback.
- Groups support 2, 4, 8 or 16 groups with two qualifiers each. Knockout draws require penalties. Corrections cannot invalidate finalized downstream results.
