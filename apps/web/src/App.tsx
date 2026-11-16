import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  ExternalLink,
  Flag,
  Grid2X2,
  LayoutDashboard,
  ListFilter,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Users,
  X,
} from "lucide-react";
import type {
  Audit,
  Match,
  Standing,
  Team,
  Tournament,
  User,
} from "../../../packages/core/types";
import { api } from "./api";
type ViewTournament = Tournament & { standings: Record<string, Standing[]> };
type Page =
  | "overview"
  | "tournaments"
  | "teams"
  | "matches"
  | "standings"
  | "venues"
  | "activity"
  | "accounts";
type Modal = { title: string; content: ReactNode } | null;
const formats: Record<string, string> = {
  groups: "Groups + knockout",
  round_robin: "Round robin",
  knockout: "Single elimination",
};
const roles: Record<string, string> = {
  organizer: "Organizer",
  manager: "Team manager",
  scorer: "Scorer",
  admin: "Administrator",
};
const when = (date?: string, options?: Intl.DateTimeFormatOptions) =>
  date
    ? new Date(date).toLocaleString(
        "en-PK",
        options || {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      )
    : "Unscheduled";
const dateOnly = (date?: string) =>
  when(date, { day: "numeric", month: "short", year: "numeric" });
function Tag({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
function Badge({ team, size = "" }: { team?: Partial<Team>; size?: string }) {
  return (
    <span
      className={`team-badge ${size}`}
      style={{ "--team-color": team?.color || "#82917f" } as any}
    >
      <Shield size={size === "small" ? 15 : 22} />
      <b>{team?.shortName?.slice(0, 1) || "?"}</b>
    </span>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Flag size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button className="button primary" disabled={busy} type="submit">
      {busy ? <Loader2 className="spin" size={17} /> : null}
      {children}
    </button>
  );
}
function Form({
  children,
  onSubmit,
  label = "Save changes",
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => Promise<void>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(new FormData(e.currentTarget));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form">
      {children}
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <div className="form-actions">
        <Submit busy={busy}>{label}</Submit>
      </div>
    </form>
  );
}
function Dialog({
  modal,
  close,
}: {
  modal: NonNullable<Modal>;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="dialog-head">
        <div>
          <span className="eyebrow">ARENIX WORKSPACE</span>
          <h2>{modal.title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {modal.content}
    </dialog>
  );
}

function Login({
  onLogin,
  explore,
}: {
  onLogin: (u: User) => void;
  explore: () => void;
}) {
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = { email: f.get("email"), password: f.get("password") };
      if (signup) {
        await api("/auth/register", {
          ...body,
          name: f.get("name"),
          role: f.get("role"),
        });
        setSignup(false);
        setMessage("Account created. Sign in with your new credentials.");
      } else onLogin(await api("/auth/login", body));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-layout">
      <section className="login-story">
        <a className="brand" href="#">
          <span className="brand-mark">A</span>arenix
          <span className="brand-dot">.</span>
        </a>
        <div className="login-copy">
          <Tag tone="lime">
            <span className="status-dot" /> THE TOURNAMENT WORKSPACE
          </Tag>
          <h1>
            Great games.
            <br />
            Seamless
            <br />
            <em>organization.</em>
          </h1>
          <p>
            From the first registration to the final whistle. Bring your entire
            tournament together.
          </p>
          <div className="court-art">
            <div className="court-line" />
            <div className="court-circle" />
            <div className="court-goal left" />
            <div className="court-goal right" />
            <span className="court-player one" />
            <span className="court-player two" />
            <span className="court-player three" />
            <span className="court-ball" />
            <div className="court-label">
              <Trophy size={16} /> YOUR NEXT CHAMPION STARTS HERE
            </div>
          </div>
        </div>
        <small>Built for campus sport. Ready for match day.</small>
      </section>
      <main className="login-form-area">
        <button className="button subtle explore" onClick={explore}>
          Explore tournaments <ArrowUpRight size={17} />
        </button>
        <div className="login-form">
          <span className="eyebrow">WELCOME TO ARENIX</span>
          <h2>
            {signup ? "Your next tournament starts here." : "Back in the game."}
          </h2>
          <p>
            {signup
              ? "Create your account to join the action."
              : "Sign in to your tournament workspace."}
          </p>
          <form className="form" onSubmit={submit}>
            {signup && (
              <>
                <Field label="Full name">
                  <input
                    name="name"
                    minLength={2}
                    maxLength={80}
                    required
                    autoComplete="name"
                  />
                </Field>
                <Field label="Your role">
                  <select name="role">
                    <option value="manager">Team manager</option>
                    <option value="organizer">Organizer</option>
                    <option value="scorer">Scorer</option>
                  </select>
                </Field>
              </>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                placeholder="you@university.edu"
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Password">
              <input
                name="password"
                type="password"
                minLength={signup ? 8 : 1}
                maxLength={72}
                placeholder="Enter your password"
                autoComplete={signup ? "new-password" : "current-password"}
                required
              />
            </Field>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="success" role="status">
                {message}
              </div>
            )}
            <Submit busy={busy}>
              {signup ? "Create account" : "Sign in to workspace"}
              <ArrowRight size={17} />
            </Submit>
          </form>
          <p className="signup-switch">
            {signup ? "Already have an account?" : "New to Arenix?"}{" "}
            <button
              onClick={() => {
                setSignup(!signup);
                setError("");
              }}
            >
              {signup ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="demo-note">
            <ShieldCheck size={20} />
            <div>
              <b>Local sample accounts</b>
              <p>
                organizer@arenix.test · manager@arenix.test
                <br />
                scorer@arenix.test · admin@arenix.test
              </p>
              <code>ArenixDemo!2026</code>
              <small>Available after running the sample seed command.</small>
            </div>
          </div>
        </div>
        <small className="login-footer">
          One platform. Every team. Every match.
        </small>
      </main>
    </div>
  );
}

function EnvironmentNotice() {
  const [temporary, setTemporary] = useState(false);
  useEffect(() => { api<{temporaryReview: boolean}>("/meta").then(data => setTemporary(data.temporaryReview)).catch(() => {}); }, []);
  return temporary ? <div className="review-notice">Temporary review environment · changes disappear when this server stops.</div> : null;
}

export function App() {
  const [user, setUser] = useState<User | null>(),
    [page, setPage] = useState<Page>("overview"),
    [list, setList] = useState<ViewTournament[]>([]),
    [currentId, setCurrentId] = useState(""),
    [teams, setTeams] = useState<Team[]>([]),
    [scorers, setScorers] = useState<{ id: string; name: string }[]>([]),
    [audits, setAudits] = useState<Audit[]>([]),
    [accounts, setAccounts] = useState<User[]>([]),
    [loading, setLoading] = useState(false),
    [failure, setFailure] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState<Modal>(null),
    [search, setSearch] = useState(""),
    [sidebar, setSidebar] = useState(false),
    [hash, setHash] = useState(location.hash);
  const current = list.find((t) => t.id === currentId) || list.find(t => t.status === 'published') || list[0];
  useEffect(() => {
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null));
    const handler = () => setHash(location.hash);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function load() {
    if (!user) return;
    setLoading(true);
    setFailure("");
    try {
      const data = await api<ViewTournament[]>("/tournaments");
      setList(data);
      if (user.role === "manager") setTeams(await api("/teams"));
      if (["organizer", "admin"].includes(user.role))
        setScorers(await api("/scorers"));
      if (user.role === "admin") {
        setAccounts(await api("/users"));
        setAudits(await api("/audit"));
      }
    } catch (e: any) {
      if (e.status === 401) setUser(null);
      setFailure(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [user]);
  useEffect(() => {
    if (user && current && user.role === "organizer")
      api<Audit[]>(`/tournaments/${current.id}/audit`)
        .then(setAudits)
        .catch(() => setAudits([]));
  }, [current, user]);
  const tell = (message: string) => setToast(message);
  const go = (p: Page) => {
    setPage(p);
    setSearch("");
    setSidebar(false);
  };
  async function action(
    type: string,
    body: unknown,
    message = "Changes saved.",
  ) {
    if (!current) return;
    const res = await api<{
      tournament: ViewTournament;
      result?: { unplaced: string[] };
    }>(`/tournaments/${current.id}/actions/${type}`, body);
    setList((old) =>
      old.map((t) => (t.id === current.id ? res.tournament : t)),
    );
    if (res.result?.unplaced?.length)
      tell(
        `${res.result.unplaced.length} matches need more slots. Add capacity, then schedule again.`,
      );
    else tell(message);
    return res;
  }
  async function run(fn: () => Promise<unknown>) {
    setLoading(true);
    try {
      await fn();
    } catch (e: any) {
      setFailure(e.message);
    } finally {
      setLoading(false);
    }
  }
  const teamFor = (id: string | null) =>
    current?.registrations.find((r) => r.team.id === id)?.team;
  function createTournament() {
    setModal({
      title: "Create a tournament",
      content: (
        <Form
          label="Create tournament"
          onSubmit={async (f) => {
            const iso = (n: string) => new Date(String(f.get(n))).toISOString();
            const data = await api<ViewTournament>("/tournaments", {
              name: f.get("name"),
              sport: f.get("sport"),
              format: f.get("format"),
              startDate: iso("start"),
              endDate: iso("end"),
              deadline: iso("deadline"),
              maxTeams: Number(f.get("capacity")),
              minRoster: Number(f.get("min")),
              maxRoster: Number(f.get("max")),
              restMinutes: Number(f.get("rest")),
              groupCount: Number(f.get("groups")),
              description: f.get("description"),
            });
            setList((old) => [data, ...old]);
            setCurrentId(data.id);
            setModal(null);
            go("teams");
            tell(
              "Tournament created. Approve teams, add venues and slots, then generate the draw.",
            );
          }}
        >
          <Field label="Tournament name">
            <input
              name="name"
              placeholder="e.g. Campus Champions Cup"
              minLength={3}
              maxLength={100}
              required
            />
          </Field>
          <div className="form-grid">
            <Field label="Sport">
              <select name="sport">
                <option value="football">Football</option>
                <option value="futsal">Futsal</option>
              </select>
            </Field>
            <Field label="Format">
              <select name="format">
                <option value="groups">Groups + knockout</option>
                <option value="round_robin">Round robin</option>
                <option value="knockout">Single elimination</option>
              </select>
            </Field>
            <Field label="Start">
              <input name="start" type="datetime-local" required />
            </Field>
            <Field label="End">
              <input name="end" type="datetime-local" required />
            </Field>
            <Field label="Registration deadline">
              <input name="deadline" type="datetime-local" required />
            </Field>
            <Field label="Maximum teams">
              <input
                name="capacity"
                type="number"
                min={4}
                max={32}
                defaultValue={16}
                required
              />
            </Field>
            <Field label="Minimum roster">
              <input
                name="min"
                type="number"
                min={1}
                max={30}
                defaultValue={5}
                required
              />
            </Field>
            <Field label="Maximum roster">
              <input
                name="max"
                type="number"
                min={1}
                max={30}
                defaultValue={14}
                required
              />
            </Field>
            <Field label="Rest between matches in minutes">
              <input
                name="rest"
                type="number"
                min={0}
                max={1440}
                defaultValue={60}
                required
              />
            </Field>
            <Field
              label="Groups for group format"
              hint="Two qualifiers per group. Use 2, 4, 8, or 16."
            >
              <select name="groups">
                <option>2</option>
                <option>4</option>
                <option>8</option>
                <option>16</option>
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea name="description" maxLength={1000} rows={3} />
          </Field>
        </Form>
      ),
    });
  }
  function teamForm(edit?: Team) {
    setModal({
      title: edit ? "Edit your team" : "Create your team",
      content: (
        <Form
          label={edit ? "Update team" : "Create team"}
          onSubmit={async (f) => {
            const roster = String(f.get("roster"))
              .split("\n")
              .filter((s) => s.trim())
              .map((line) => {
                const [number, ...name] = line.trim().split(" ");
                return { number: Number(number), name: name.join(" ") };
              });
            await api(
              edit ? `/teams/${edit.id}` : "/teams",
              {
                name: f.get("name"),
                shortName: f.get("shortName"),
                color: f.get("color"),
                roster,
              },
              edit ? "PUT" : "POST",
            );
            setModal(null);
            await load();
            tell(
              "Team saved. Registration snapshots are preserved; register a team after finalizing its roster.",
            );
          }}
        >
          <Field label="Team name">
            <input
              name="name"
              defaultValue={edit?.name}
              minLength={2}
              maxLength={80}
              required
            />
          </Field>
          <div className="form-grid">
            <Field label="Short code">
              <input
                name="shortName"
                defaultValue={edit?.shortName}
                minLength={2}
                maxLength={4}
                required
              />
            </Field>
            <Field label="Team color">
              <input
                name="color"
                type="color"
                defaultValue={edit?.color || "#b6f36b"}
                required
              />
            </Field>
          </div>
          <Field
            label="Roster"
            hint="One player per line: squad number then full name. Example: 7 Ali Khan. Each number must be unique."
          >
            <textarea
              name="roster"
              rows={8}
              defaultValue={edit?.roster
                .map((p) => `${p.number} ${p.name}`)
                .join("\n")}
              placeholder={"1 Ali Khan\n7 Hassan Ahmed\n9 Omar Shah"}
              required
            />
          </Field>
        </Form>
      ),
    });
  }
  function draw() {
    if (!current) return;
    const approved = current.registrations.filter(
      (r) => r.status === "approved",
    );
    setModal({
      title: "Generate the tournament draw",
      content: (
        <Form
          label="Generate fixtures"
          onSubmit={async (f) => {
            const method = String(f.get("method"));
            const body =
              method === "random"
                ? { method, ...(f.get("seed") ? { seed: f.get("seed") } : {}) }
                : {
                    method,
                    order: String(f.get("order"))
                      .split(",")
                      .map(
                        (s) => approved[Number(s.trim()) - 1]?.team.id || "",
                      ),
                  };
            await action(
              "generate",
              body,
              "Draw generated. Add enough time slots, then auto-schedule.",
            );
            setModal(null);
            go("matches");
          }}
        >
          <p className="muted">
            {approved.length} approved teams · {formats[current.config.format]}.
            Regenerating a draft replaces its assignments and schedule.
          </p>
          <Field label="Draw method">
            <select name="method">
              <option value="random">Reproducible random draw</option>
              <option value="manual">Manual seeding</option>
            </select>
          </Field>
          <Field
            label="Random draw seed"
            hint="Leave blank to generate and record a random seed."
          >
            <input name="seed" maxLength={100} placeholder="e.g. campus-2026" />
          </Field>
          <Field
            label="Manual seed order"
            hint="Enter team numbers in seed order, separated by commas."
          >
            <input
              name="order"
              defaultValue={approved.map((_, i) => i + 1).join(", ")}
            />
          </Field>
          <ol className="seed-list">
            {approved.map((r) => (
              <li key={r.id}>{r.team.name}</li>
            ))}
          </ol>
        </Form>
      ),
    });
  }
  function venueForm() {
    setModal({
      title: "Add a venue",
      content: (
        <Form
          label="Add venue"
          onSubmit={async (f) => {
            await action("venue", { name: f.get("name") }, "Venue added.");
            setModal(null);
          }}
        >
          <Field label="Venue name">
            <input
              name="name"
              placeholder="e.g. Main Arena"
              minLength={2}
              maxLength={80}
              required
            />
          </Field>
        </Form>
      ),
    });
  }
  function slotsForm() {
    if (!current) return;
    setModal({
      title: "Add match time slots",
      content: (
        <Form
          label="Add slots"
          onSubmit={async (f) => {
            const start = new Date(String(f.get("start"))).getTime(),
              duration = Number(f.get("duration")),
              spacing = Number(f.get("spacing")),
              count = Number(f.get("count"));
            for (let i = 0; i < count; i++)
              await action("slot", {
                start: new Date(start + i * spacing * 60000).toISOString(),
                end: new Date(
                  start + (i * spacing + duration) * 60000,
                ).toISOString(),
              });
            setModal(null);
            tell(`${count} time slots added.`);
          }}
        >
          <p className="muted">
            Slots are shared across venues. The scheduler checks team rest and
            actual time overlaps. All times use your browser timezone.
          </p>
          <Field label="First slot starts">
            <input name="start" type="datetime-local" required />
          </Field>
          <div className="form-grid">
            <Field label="Duration in minutes">
              <input
                name="duration"
                type="number"
                min={1}
                max={1440}
                defaultValue={60}
                required
              />
            </Field>
            <Field label="Start interval in minutes">
              <input
                name="spacing"
                type="number"
                min={1}
                max={1440}
                defaultValue={120}
                required
              />
            </Field>
            <Field label="Number of slots">
              <input
                name="count"
                type="number"
                min={1}
                max={100}
                defaultValue={8}
                required
              />
            </Field>
          </div>
          <small>
            Slots already added remain saved if a later slot fails validation.
          </small>
        </Form>
      ),
    });
  }
  function matchForm(m: Match, kind: "result" | "manage" | "correction") {
    if (!current) return;
    const h = teamFor(m.homeId),
      a = teamFor(m.awayId);
    setModal({
      title:
        kind === "manage"
          ? "Manage match"
          : kind === "correction"
            ? "Request result correction"
            : "Record match result",
      content: (
        <div>
          <div className="match-form-title">
            <Badge team={h} />
            <b>{h?.name || "TBD"}</b>
            <span>vs</span>
            <b>{a?.name || "TBD"}</b>
            <Badge team={a} />
          </div>
          {kind === "manage" ? (
            <>
              <Form
                label="Update schedule"
                onSubmit={async (f) => {
                  await action("reschedule", {
                    matchId: m.id,
                    version: m.version,
                    venueId: f.get("venue"),
                    slotId: f.get("slot"),
                  });
                  setModal(null);
                }}
              >
                <Field label="Venue">
                  <select name="venue" defaultValue={m.venueId}>
                    {current.venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Time slot">
                  <select name="slot" defaultValue={m.slotId}>
                    {current.slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {when(s.start)} –{" "}
                        {when(s.end, { hour: "2-digit", minute: "2-digit" })}
                      </option>
                    ))}
                  </select>
                </Field>
              </Form>
              <div className="form-divider" />
              <Form
                label="Assign scorer"
                onSubmit={async (f) => {
                  await action("assign-scorer", {
                    matchId: m.id,
                    version: m.version,
                    scorerId: f.get("scorer"),
                  });
                  setModal(null);
                }}
              >
                <Field label="Assigned scorer">
                  <select name="scorer" defaultValue={m.scorerId} required>
                    <option value="">Choose a scorer</option>
                    {scorers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </Form>
            </>
          ) : (
            <Form
              label={
                kind === "correction"
                  ? "Send for approval"
                  : "Submit final result"
              }
              onSubmit={async (f) => {
                const body = {
                  matchId: m.id,
                  version: m.version,
                  homeScore: Number(f.get("home")),
                  awayScore: Number(f.get("away")),
                  ...(f.get("ph") !== "" && f.get("ph") !== null
                    ? {
                        penaltyHome: Number(f.get("ph")),
                        penaltyAway: Number(f.get("pa")),
                      }
                    : {}),
                  ...(kind === "correction" ? { reason: f.get("reason") } : {}),
                };
                await action(
                  kind === "correction" ? "request-correction" : "result",
                  body,
                  kind === "correction"
                    ? "Correction sent to the organizer."
                    : "Result saved. Standings and bracket updated.",
                );
                setModal(null);
              }}
            >
              <div className="form-grid">
                <Field label={`${h?.shortName || "Home"} goals`}>
                  <input
                    name="home"
                    type="number"
                    min={0}
                    max={99}
                    defaultValue={m.homeScore ?? 0}
                    required
                  />
                </Field>
                <Field label={`${a?.shortName || "Away"} goals`}>
                  <input
                    name="away"
                    type="number"
                    min={0}
                    max={99}
                    defaultValue={m.awayScore ?? 0}
                    required
                  />
                </Field>
              </div>
              {m.stage === "knockout" && (
                <>
                  <p className="muted">
                    If goals are tied, enter a decisive penalty shootout.
                    Penalties do not count as goals.
                  </p>
                  <div className="form-grid">
                    <Field label="Home penalties">
                      <input
                        name="ph"
                        type="number"
                        min={0}
                        max={99}
                        defaultValue={m.penaltyHome}
                      />
                    </Field>
                    <Field label="Away penalties">
                      <input
                        name="pa"
                        type="number"
                        min={0}
                        max={99}
                        defaultValue={m.penaltyAway}
                      />
                    </Field>
                  </div>
                </>
              )}
              {kind === "correction" && (
                <Field label="Reason for correction">
                  <textarea
                    name="reason"
                    minLength={10}
                    maxLength={500}
                    required
                    rows={3}
                  />
                </Field>
              )}
              <small>
                Result changes are audited. A submitted result requires
                organizer approval to correct.
              </small>
            </Form>
          )}
        </div>
      ),
    });
  }
  function publicLink() {
    if (current)
      window.open(
        `${location.origin}/#/public/${current.slug}`,
        "_blank",
        "noopener,noreferrer",
      );
  }
  function fixtures(rows: Match[], compact = false) {
    return !rows.length ? (
      <Empty
        title="No matches here yet"
        text="Approved teams become fixtures when the organizer generates the draw."
      />
    ) : (
      <div className="fixture-list">
        {rows.map((m) => {
          const h = teamFor(m.homeId),
            a = teamFor(m.awayId),
            slot = current!.slots.find((s) => s.id === m.slotId),
            venue = current!.venues.find((v) => v.id === m.venueId);
          return (
            <div
              className={`fixture-row ${compact ? "compact" : ""}`}
              key={m.id}
            >
              <div className="fixture-date">
                <b>
                  {slot
                    ? when(slot.start, { day: "2-digit", month: "short" })
                    : "TBD"}
                </b>
                <span>
                  {slot
                    ? when(slot.start, { hour: "2-digit", minute: "2-digit" })
                    : "Not placed"}
                </span>
              </div>
              <div className="fixture-team home">
                <Badge team={h} size="small" />
                <b>
                  {h?.name || (m.homeFrom ? "Winner of " + m.homeFrom : "Bye")}
                </b>
              </div>
              <div
                className={`fixture-score ${m.status === "final" ? "scored" : ""}`}
              >
                {m.status === "final"
                  ? `${m.homeScore} : ${m.awayScore}`
                  : m.status === "bye"
                    ? "BYE"
                    : "vs"}
                {m.penaltyHome !== undefined && (
                  <small>
                    pens {m.penaltyHome}–{m.penaltyAway}
                  </small>
                )}
              </div>
              <div className="fixture-team">
                <Badge team={a} size="small" />
                <b>
                  {a?.name || (m.awayFrom ? "Winner of " + m.awayFrom : "Bye")}
                </b>
              </div>
              <div className="fixture-meta">
                <span>
                  <MapPin size={12} />
                  {venue?.name || "Unassigned"}
                </span>
                <small>
                  {m.group
                    ? `Group ${m.group}`
                    : m.stage === "knockout"
                      ? "Knockout"
                      : "League"}{" "}
                  · Round {m.round}
                </small>
              </div>
              <div className="fixture-action">
                {m.status === "final" ? (
                  user?.role === "scorer" && m.scorerId === user.id ? (
                    <button
                      className="text-button"
                      onClick={() => matchForm(m, "correction")}
                    >
                      Correct
                    </button>
                  ) : (
                    <Tag>Final</Tag>
                  )
                ) : m.status === "bye" ? (
                  <Tag>Bye</Tag>
                ) : user?.role === "organizer" ? (
                  <button
                    className="icon-button"
                    aria-label={`Manage ${h?.name || "match"} versus ${a?.name || "TBD"}`}
                    onClick={() => matchForm(m, "manage")}
                  >
                    <ChevronRight size={18} />
                  </button>
                ) : user?.role === "scorer" && m.scorerId === user.id ? (
                  <button
                    className="button primary small"
                    disabled={!m.homeId || !m.awayId || !m.slotId}
                    onClick={() => matchForm(m, "result")}
                  >
                    Score
                  </button>
                ) : (
                  <Tag tone="muted-tag">Scheduled</Tag>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  if (hash.startsWith("#/public"))
    return <PublicView hash={hash} onExit={() => (location.hash = "")} />;
  if (user === undefined)
    return (
      <div className="splash">
        <Loader2 className="spin" />
        <p>Opening Arenix…</p>
      </div>
    );
  if (!user)
    return (
      <Login onLogin={setUser} explore={() => (location.hash = "/public")} />
    );
  const approved =
      current?.registrations.filter((r) => r.status === "approved") || [],
    pending =
      current?.registrations.filter((r) => r.status === "pending") || [],
    done = current?.matches.filter((m) => m.status === "final") || [],
    scheduled = current?.matches.filter((m) => m.status === "scheduled") || [];
  const nav: {
    id: Page;
    title: string;
    icon: typeof Trophy;
    count?: number;
  }[] = [
    { id: "overview", title: "Overview", icon: LayoutDashboard },
    {
      id: "tournaments",
      title: "Tournaments",
      icon: Trophy,
      count: list.length,
    },
    {
      id: "teams",
      title: user.role === "manager" ? "My teams" : "Teams & registrations",
      icon: Users,
    },
    { id: "matches", title: "Match center", icon: Swords },
    { id: "standings", title: "Standings & bracket", icon: Grid2X2 },
    ...(user.role === "organizer"
      ? [{ id: "venues" as Page, title: "Venues & time slots", icon: MapPin }]
      : []),
    ...(["organizer", "admin"].includes(user.role)
      ? [{ id: "activity" as Page, title: "Activity log", icon: Activity }]
      : []),
    ...(user.role === "admin"
      ? [{ id: "accounts" as Page, title: "User accounts", icon: ShieldCheck }]
      : []),
  ];
  const title = nav.find((n) => n.id === page)?.title || "Overview";
  const filteredMatches = (current?.matches || []).filter((m) =>
    `${teamFor(m.homeId)?.name} ${teamFor(m.awayId)?.name} ${m.group || ""} ${m.status}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="workspace">
      {sidebar && (
        <div className="nav-scrim" onClick={() => setSidebar(false)} />
      )}
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <a className="brand" href="#">
          <span className="brand-mark">A</span>arenix
          <span className="brand-dot">.</span>
        </a>
        <div className="workspace-selector">
          <span className="workspace-symbol">
            <Flag size={19} />
          </span>
          <div>
            <b>Campus workspace</b>
            <small>Football & futsal</small>
          </div>
          <ShieldCheck size={15} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={18} />
              <span>{n.title}</span>
              {n.count !== undefined && (
                <small>{n.count.toString().padStart(2, "0")}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-promo">
            <div className="promo-symbol">
              <Target size={23} />
              <span>✦</span>
            </div>
            <b>Made for match day.</b>
            <p>
              Give every team a place
              <br />
              to follow the action.
            </p>
            <button
              className="text-button"
              onClick={() => (location.hash = "/public")}
            >
              Explore public tournaments <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className="help-button"
            onClick={() =>
              setModal({
                title: "Your tournament playbook",
                content: (
                  <div className="help-copy">
                    <p>
                      <b>Organizer:</b> Create a tournament, approve at least
                      four teams, add venues and slots, generate the draw,
                      auto-schedule, assign scorers, then publish.
                    </p>
                    <p>
                      <b>Manager:</b> Create a team with a valid roster, choose
                      an open tournament, and submit its registration.
                    </p>
                    <p>
                      <b>Scorer:</b> Open Match center. Only your assigned
                      matches can be scored. Drawn knockout matches require
                      penalties.
                    </p>
                    <p>
                      Groups qualify two teams each after every group result is
                      final. New knockout fixtures need a schedule and scorer
                      assignment.
                    </p>
                    <p>
                      Public pages refresh every two seconds while open. Times
                      display in the viewer’s browser timezone.
                    </p>
                  </div>
                ),
              })
            }
          >
            <CircleHelp size={17} /> How Arenix works <ArrowUpRight size={14} />
          </button>
          <div className="user-panel">
            <span className="user-avatar">
              {user.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <b>{user.name}</b>
              <small>{roles[user.role]}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={() =>
                run(async () => {
                  await api("/auth/logout", {});
                  setUser(null);
                  setList([]);
                  setPage("overview");
                })
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            aria-label="Open navigation"
            onClick={() => setSidebar(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <b>{title}</b>
          </div>
          <div className="topbar-right">
            <span className="today">
              <CalendarDays size={14} />
              {dateOnly(new Date().toISOString())}
            </span>
            <span className="role-chip">
              <ShieldCheck size={13} />
              {roles[user.role]}
            </span>
          </div>
        </header>
        <main className="main-content">
          <EnvironmentNotice />
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR TOURNAMENT HQ</span>
              <h1>
                {page === "overview"
                  ? `Let's make it a great match day.`
                  : title}
              </h1>
              <p>
                {page === "overview"
                  ? `Welcome back, ${user.name.split(" ")[0]}. Here’s where the action stands.`
                  : page === "matches"
                    ? "Every fixture, every result. One clear view."
                    : page === "teams"
                      ? "The people and teams behind the competition."
                      : page === "standings"
                        ? "Follow the table. See the path to the trophy."
                        : "Keep your tournament moving."}
              </p>
            </div>
            {user.role === "organizer" && (
              <button className="button primary" onClick={createTournament}>
                <Plus size={17} /> New tournament
              </button>
            )}
          </div>
          {failure && (
            <div className="error page-error" role="alert">
              <span>{failure}</span>
              <button
                onClick={() => {
                  setFailure("");
                  void load();
                }}
              >
                Retry
              </button>
              <button aria-label="Dismiss error" onClick={() => setFailure("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {loading && (
            <div className="loading-strip" role="status">
              <Loader2 size={14} className="spin" /> Syncing workspace…
            </div>
          )}
          {page !== "tournaments" && page !== "accounts" && (
            <div className="context-bar">
              <div className="context-select">
                <Trophy size={17} />
                <select
                  aria-label="Active tournament"
                  value={current?.id || ""}
                  onChange={(e) => setCurrentId(e.target.value)}
                >
                  {!list.length && <option value="">No tournaments yet</option>}
                  {list.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.config.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
              {current && (
                <div className="context-tags">
                  <Tag
                    tone={current.status === "registration" ? "amber" : "lime"}
                  >
                    <span className="status-dot" />
                    {current.status === "registration"
                      ? "Registration open"
                      : current.status === "published"
                        ? "Published"
                        : current.status === "completed"
                          ? "Completed"
                          : "Draft fixtures"}
                  </Tag>
                  <span>{formats[current.config.format]}</span>
                  <button
                    className="text-button"
                    onClick={publicLink}
                    disabled={current.status === "draft"}
                  >
                    Public page <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
          {page === "overview" &&
            (current ? (
              <>
                <section className="hero-panel">
                  <div className="hero-copy">
                    <Tag>
                      <span className="status-dot" />{" "}
                      {current.config.sport.toUpperCase()} · CAMPUS SPORT
                    </Tag>
                    <h2>
                      Every match.
                      <br />
                      <span>Under control.</span>
                    </h2>
                    <p>
                      {current.config.name}
                      <br />
                      <small>
                        {dateOnly(current.config.startDate)} —{" "}
                        {dateOnly(current.config.endDate)}
                      </small>
                    </p>
                    <button
                      className="button primary"
                      onClick={() => go("matches")}
                    >
                      Open match center <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <div className="hero-pitch">
                    <div className="pitch-outline">
                      <div className="pitch-half" />
                      <div className="pitch-center" />
                      <div className="pitch-box left" />
                      <div className="pitch-box right" />
                    </div>
                    <div className="hero-trophy">
                      <Trophy strokeWidth={1.1} />
                      <span>
                        THE NEXT CHAPTER
                        <br />
                        <b>IS YOURS TO PLAY.</b>
                      </span>
                    </div>
                    <span className="hero-number">01 / ARENIX</span>
                  </div>
                  <div className="hero-watermark">PLAY.</div>
                </section>
                <section className="stats-grid">
                  {[
                    {
                      label: "Approved teams",
                      value: approved.length,
                      meta: `${current.config.maxTeams - approved.length} places remaining`,
                      icon: Users,
                    },
                    {
                      label: "Total fixtures",
                      value: current.matches.length,
                      meta: formats[current.config.format],
                      icon: Swords,
                    },
                    {
                      label: "Results recorded",
                      value: done.length,
                      meta: `${scheduled.length} matches ahead`,
                      icon: Flag,
                    },
                    {
                      label: "Pending approvals",
                      value: pending.length,
                      meta: pending.length
                        ? "Ready for your review"
                        : "All caught up",
                      icon: ShieldCheck,
                    },
                  ].map((s) => (
                    <div className="stat-card" key={s.label}>
                      <div className="stat-top">
                        <span>{s.label}</span>
                        <s.icon size={17} />
                      </div>
                      <strong>{String(s.value).padStart(2, "0")}</strong>
                      <small>
                        <span className="mini-dot" />
                        {s.meta}
                      </small>
                    </div>
                  ))}
                </section>
                <div className="dashboard-grid">
                  <div>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <span className="section-index">01</span>
                          <h3>Next on the pitch</h3>
                          <Tag>{scheduled.length} upcoming</Tag>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => go("matches")}
                        >
                          All matches <ArrowRight size={14} />
                        </button>
                      </div>
                      {fixtures(
                        scheduled
                          .filter((m) => m.homeId && m.awayId)
                          .slice(0, 4),
                        true,
                      )}
                      <div className="panel-foot">
                        <Clock3 size={13} /> Times shown in{" "}
                        {Intl.DateTimeFormat().resolvedOptions().timeZone}
                      </div>
                    </section>
                    <section className="panel recent-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="section-index">02</span>
                          <h3>Recent results</h3>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => go("standings")}
                        >
                          Standings <ArrowRight size={14} />
                        </button>
                      </div>
                      <div className="result-cards">
                        {done.slice(-3).map((m) => (
                          <div className="result-card" key={m.id}>
                            <span className="eyebrow">
                              {m.group ? `GROUP ${m.group}` : "KNOCKOUT"} · FULL
                              TIME
                            </span>
                            <div>
                              <Badge team={teamFor(m.homeId)} />
                              <strong>
                                {m.homeScore}
                                <span>–</span>
                                {m.awayScore}
                              </strong>
                              <Badge team={teamFor(m.awayId)} />
                            </div>
                            <p>
                              {teamFor(m.homeId)?.shortName}
                              <span>{teamFor(m.awayId)?.shortName}</span>
                            </p>
                          </div>
                        ))}
                        {!done.length && (
                          <p className="muted">
                            Results appear here after your scorer submits a
                            match.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>
                  <div>
                    <section className="panel standings-preview">
                      <div className="panel-heading">
                        <div>
                          <h3>The leaderboard</h3>
                        </div>
                        <Trophy size={18} />
                      </div>
                      {Object.entries(current.standings || {})
                        .slice(0, 1)
                        .map(([group, rows]) => (
                          <div key={group}>
                            <div className="standings-subhead">
                              <span>{group}</span>
                              <span>PTS</span>
                            </div>
                            {rows.slice(0, 5).map((r, i) => (
                              <div
                                className={`leader-row ${i === 0 ? "leader" : ""}`}
                                key={r.teamId}
                              >
                                <span className="rank">
                                  {String(i + 1).padStart(2, "0")}
                                </span>
                                <Badge team={teamFor(r.teamId)} size="small" />
                                <b>{teamFor(r.teamId)?.name}</b>
                                <strong>{r.points}</strong>
                              </div>
                            ))}
                          </div>
                        ))}
                      <button
                        className="leaderboard-link"
                        onClick={() => go("standings")}
                      >
                        View full standings <ArrowUpRight size={15} />
                      </button>
                    </section>
                    <section className="progress-panel">
                      <span className="eyebrow">
                        <Sparkles size={13} /> TOURNAMENT PULSE
                      </span>
                      <h3>
                        Every result brings
                        <br />
                        us closer.
                      </h3>
                      <div className="progress-label">
                        <span>Competition progress</span>
                        <b>
                          {current.matches.length
                            ? Math.round(
                                (done.length / current.matches.length) * 100,
                              )
                            : 0}
                          %
                        </b>
                      </div>
                      <div className="progress-track">
                        <span
                          style={{
                            width: `${current.matches.length ? (done.length / current.matches.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <p>
                        {done.length} of {current.matches.length} fixtures
                        played
                      </p>
                      <span className="pulse-asterisk">✳</span>
                    </section>
                  </div>
                </div>
              </>
            ) : (
              <Empty
                title="Your workspace is ready"
                text={
                  user.role === "organizer"
                    ? "Create your first tournament to get started."
                    : user.role === "scorer"
                      ? "An organizer will assign your matches. Refresh after receiving an assignment."
                      : "Choose Tournaments to find open competitions."
                }
              />
            ))}
          {page === "tournaments" && (
            <>
              <div className="content-toolbar">
                <label className="search-field">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Find a tournament…"
                  />
                </label>
                <span className="muted">{list.length} tournaments</span>
              </div>
              <div className="tournament-grid">
                {list
                  .filter((t) =>
                    t.config.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((t) => (
                    <button
                      className="tournament-card"
                      key={t.id}
                      onClick={() => {
                        setCurrentId(t.id);
                        go("overview");
                      }}
                    >
                      <div className={`tournament-card-art ${t.config.sport}`}>
                        <Trophy size={64} strokeWidth={1} />
                        <span>{t.config.sport.toUpperCase()}</span>
                        <Tag tone="lime">{t.status}</Tag>
                      </div>
                      <div className="tournament-card-body">
                        <small>{formats[t.config.format]}</small>
                        <h3>{t.config.name}</h3>
                        <p>
                          {dateOnly(t.config.startDate)} ·{" "}
                          {
                            t.registrations.filter(
                              (r) => r.status === "approved",
                            ).length
                          }
                          /{t.config.maxTeams} teams
                        </p>
                        <span>
                          Open tournament <ArrowUpRight size={17} />
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
              {!list.length && (
                <Empty
                  title="No tournaments yet"
                  text="Create a tournament or check back when an organizer opens registration."
                />
              )}
            </>
          )}
          {page === "teams" && (
            <>
              <div className="content-toolbar">
                <div>
                  <h2>
                    {user.role === "manager"
                      ? "Your teams"
                      : "Tournament registrations"}
                  </h2>
                  <p className="muted">
                    {current
                      ? `Roster requirement: ${current.config.minRoster}–${current.config.maxRoster} players`
                      : "Create a team with its roster."}
                  </p>
                </div>
                {user.role === "manager" && (
                  <button className="button primary" onClick={() => teamForm()}>
                    <Plus size={16} /> Create team
                  </button>
                )}
              </div>
              {user.role === "manager" && (
                <div className="team-grid">
                  {teams.map((team) => (
                    <div className="team-card" key={team.id}>
                      <Badge team={team} />
                      <h3>{team.name}</h3>
                      <span className="muted">
                        {team.roster.length} players · {team.shortName}
                      </span>
                      <div className="team-card-actions">
                        <button
                          className="button subtle small"
                          onClick={() => teamForm(team)}
                        >
                          Edit roster
                        </button>
                        {current && (
                          <button
                            className="button primary small"
                            disabled={
                              current.status !== "registration" ||
                              current.registrations.some(
                                (r) => r.team.id === team.id,
                              )
                            }
                            onClick={() =>
                              run(async () => {
                                await action(
                                  "register",
                                  { teamId: team.id },
                                  "Registration submitted for organizer approval.",
                                );
                              })
                            }
                          >
                            {current.registrations.find(
                              (r) => r.team.id === team.id,
                            )?.status || "Register team"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {current && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Registration list</h3>
                      <Tag>{current.registrations.length}</Tag>
                    </div>
                    {user.role === "organizer" &&
                      ["registration", "draft"].includes(current.status) && (
                        <button
                          className="button primary small"
                          disabled={approved.length < 4}
                          onClick={draw}
                        >
                          Generate draw <ArrowRight size={14} />
                        </button>
                      )}
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th>Roster</th>
                          <th>Status</th>
                          <th>Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {current.registrations.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <div className="table-team">
                                <Badge team={r.team} size="small" />
                                {r.team.name}
                              </div>
                            </td>
                            <td>{r.team.roster.length || "Private"}</td>
                            <td>
                              <Tag
                                tone={
                                  r.status === "approved"
                                    ? "lime"
                                    : r.status === "pending"
                                      ? "amber"
                                      : ""
                                }
                              >
                                {r.status}
                              </Tag>
                            </td>
                            <td>
                              {user.role === "organizer" &&
                              current.status === "registration" ? (
                                <div className="inline-actions">
                                  <button
                                    disabled={r.status === "approved"}
                                    className="text-button"
                                    onClick={() =>
                                      run(async () => {
                                        await action("decide-registration", {
                                          registrationId: r.id,
                                          decision: "approved",
                                        });
                                      })
                                    }
                                  >
                                    Approve
                                  </button>
                                  <button
                                    disabled={r.status === "rejected"}
                                    className="text-button danger"
                                    onClick={() =>
                                      run(async () => {
                                        await action("decide-registration", {
                                          registrationId: r.id,
                                          decision: "rejected",
                                        });
                                      })
                                    }
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : r.decisionAt ? (
                                dateOnly(r.decisionAt)
                              ) : (
                                "Awaiting review"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!current.registrations.length && (
                    <Empty
                      title="Ready for the first team"
                      text="Managers can submit a roster before the registration deadline."
                    />
                  )}
                </section>
              )}
            </>
          )}
          {page === "matches" && current && (
            <>
              <div className="content-toolbar wrap">
                <label className="search-field">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search team, group, or status…"
                  />
                </label>
                <div className="inline-actions">
                  {user.role === "organizer" &&
                    ["registration", "draft"].includes(current.status) && (
                      <button className="button subtle" onClick={draw}>
                        Generate draw
                      </button>
                    )}
                  {user.role === "organizer" && current.status === "draft" && (
                    <>
                      <button
                        className="button subtle"
                        onClick={() =>
                          run(async () => {
                            await action(
                              "schedule",
                              {},
                              "All matches scheduled without conflicts.",
                            );
                          })
                        }
                      >
                        <CalendarDays size={15} /> Auto-schedule
                      </button>
                      <button
                        className="button primary"
                        onClick={() =>
                          run(async () => {
                            await action(
                              "publish",
                              {},
                              "Fixtures are now public.",
                            );
                          })
                        }
                      >
                        Publish fixtures <ArrowUpRight size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>
                      {user.role === "scorer"
                        ? "Your assigned matches"
                        : "Fixtures & results"}
                    </h3>
                    <Tag>{filteredMatches.length}</Tag>
                  </div>
                  {current.drawSeed && (
                    <span className="draw-seed">
                      Draw seed: {current.drawSeed}
                    </span>
                  )}
                </div>
                {fixtures(filteredMatches)}
              </section>
              {current.corrections.length > 0 && (
                <section className="panel corrections">
                  <div className="panel-heading">
                    <h3>Result corrections</h3>
                  </div>
                  {current.corrections.map((c) => (
                    <div className="correction-row" key={c.id}>
                      <div>
                        <b>
                          {c.matchId}: {c.homeScore}–{c.awayScore}
                        </b>
                        <p>{c.reason}</p>
                      </div>
                      <Tag tone="amber">{c.status}</Tag>
                      {user.role === "organizer" && c.status === "pending" && (
                        <div className="inline-actions">
                          {(["approved", "rejected"] as const).map(
                            (decision) => (
                              <button
                                className="button subtle small"
                                key={decision}
                                onClick={() =>
                                  run(async () => {
                                    await action("decide-correction", {
                                      correctionId: c.id,
                                      decision,
                                    });
                                  })
                                }
                              >
                                {decision === "approved" ? "Approve" : "Reject"}
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
          {page === "standings" && current && (
            <StandingsView tournament={current} />
          )}
          {page === "venues" && current && (
            <>
              <div className="content-toolbar">
                <h2>Build a clash-free match day</h2>
                <div className="inline-actions">
                  <button className="button subtle" onClick={venueForm}>
                    <Plus size={16} /> Add venue
                  </button>
                  <button className="button primary" onClick={slotsForm}>
                    <Plus size={16} /> Add time slots
                  </button>
                </div>
              </div>
              <div className="venues-grid">
                {current.venues.map((v, i) => (
                  <div className="venue-card" key={v.id}>
                    <div className="venue-art">
                      <div className="mini-pitch" />
                      <span>{String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <h3>
                      <MapPin size={17} />
                      {v.name}
                    </h3>
                    <p>
                      {current.matches.filter((m) => m.venueId === v.id).length}{" "}
                      assigned matches
                    </p>
                  </div>
                ))}
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Available time slots</h3>
                    <Tag>{current.slots.length}</Tag>
                  </div>
                  <span className="muted">
                    {current.config.restMinutes} minute team rest
                  </span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Assigned matches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...current.slots]
                        .sort((a, b) => a.start.localeCompare(b.start))
                        .map((s) => (
                          <tr key={s.id}>
                            <td>{dateOnly(s.start)}</td>
                            <td>
                              {when(s.start, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td>
                              {when(s.end, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td>
                              {
                                current.matches.filter((m) => m.slotId === s.id)
                                  .length
                              }{" "}
                              / {current.venues.length} venues
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!current.slots.length && (
                  <Empty
                    title="Make room for the action"
                    text="Add time slots within your tournament dates. Overlapping slots are rechecked by the scheduler."
                  />
                )}
              </section>
            </>
          )}
          {page === "activity" && <AuditView rows={audits} />}
          {page === "accounts" && (
            <section className="panel">
              <div className="panel-heading">
                <h3>User access</h3>
                <Tag>{accounts.length} accounts</Tag>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.id}>
                        <td>{a.name}</td>
                        <td>{a.email}</td>
                        <td>{roles[a.role]}</td>
                        <td>
                          <Tag tone={a.active ? "lime" : ""}>
                            {a.active ? "Active" : "Deactivated"}
                          </Tag>
                        </td>
                        <td>
                          <button
                            className="button subtle small"
                            disabled={a.id === user.id}
                            onClick={() =>
                              run(async () => {
                                await api(`/users/${a.id}/active`, {
                                  active: !a.active,
                                });
                                await load();
                                tell(
                                  "Account access updated. Existing sessions have been revoked.",
                                );
                              })
                            }
                          >
                            {a.active ? "Deactivate" : "Reactivate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {["matches", "standings", "venues"].includes(page) && !current && (
            <Empty
              title="Choose a tournament first"
              text="Open Tournaments to create or select a competition."
            />
          )}
          <footer className="workspace-footer">
            <span>
              ARENIX <span> / </span> THE TOURNAMENT WORKSPACE
            </span>
            <span>
              Built for the love of the game{" "}
              <span className="lime-text">↗</span>
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal && <Dialog modal={modal} close={() => setModal(null)} />}
    </div>
  );
}

function StandingsView({ tournament: t }: { tournament: ViewTournament }) {
  const team = (id: string | null) =>
    t.registrations.find((r) => r.team.id === id)?.team;
  const knockout = t.matches.filter((m) => m.stage === "knockout"),
    rounds = [...new Set(knockout.map((m) => m.round))];
  return (
    <>
      <div className="standings-grid">
        {Object.entries(t.standings || {})
          .filter(([, rows]) => rows.length)
          .map(([name, rows]) => (
            <section className="panel" key={name}>
              <div className="panel-heading">
                <div>
                  <Trophy size={17} />
                  <h3>{name}</h3>
                </div>
                <Tag>{rows.length} teams</Tag>
              </div>
              <div className="table-scroll">
                <table className="standings-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>P</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      <th>GF</th>
                      <th>GA</th>
                      <th>GD</th>
                      <th>PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.teamId}>
                        <td className={r.rank <= 2 ? "qualifier" : ""}>
                          {r.rank}
                        </td>
                        <td>
                          <div className="table-team">
                            <Badge team={team(r.teamId)} size="small" />
                            {team(r.teamId)?.name}
                          </div>
                        </td>
                        <td>{r.played}</td>
                        <td>{r.won}</td>
                        <td>{r.drawn}</td>
                        <td>{r.lost}</td>
                        <td>{r.goalsFor}</td>
                        <td>{r.goalsAgainst}</td>
                        <td>
                          {r.difference > 0 ? "+" : ""}
                          {r.difference}
                        </td>
                        <td className="points">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="table-note">
                3 points for a win · 1 for a draw · Ties: goal difference, goals
                for, head-to-head mini-table, stable team ID.
                {t.config.format === "groups" ? " Top two qualify." : ""}
              </p>
            </section>
          ))}
      </div>
      {knockout.length > 0 ? (
        <section className="panel bracket-panel">
          <div className="panel-heading">
            <div>
              <Swords size={18} />
              <h3>Road to the trophy</h3>
            </div>
            <Tag tone="lime">Knockout bracket</Tag>
          </div>
          <div className="bracket-scroll">
            <div className="bracket">
              {rounds.map((round, i) => (
                <div className="bracket-round" key={round}>
                  <h4>
                    {i === rounds.length - 1
                      ? "FINAL"
                      : i === rounds.length - 2
                        ? "SEMI-FINALS"
                        : `ROUND ${round}`}
                  </h4>
                  <div className="bracket-round-matches">
                    {knockout
                      .filter((m) => m.round === round)
                      .map((m) => (
                        <div className="bracket-match" key={m.id}>
                          <small>
                            {m.id} {m.status === "bye" ? "· BYE" : ""}
                          </small>
                          {[m.homeId, m.awayId].map((id, side) => (
                            <div
                              className={
                                m.winnerId === id && id ? "winner" : ""
                              }
                              key={side}
                            >
                              <Badge team={team(id)} size="small" />
                              <b>
                                {team(id)?.name ||
                                  (side === 0 ? m.homeFrom : m.awayFrom) ||
                                  "Bye"}
                              </b>
                              <strong>
                                {m.status === "final"
                                  ? side === 0
                                    ? m.homeScore
                                    : m.awayScore
                                  : "–"}
                              </strong>
                            </div>
                          ))}
                          {m.penaltyHome !== undefined && (
                            <small>
                              Penalties {m.penaltyHome}–{m.penaltyAway}
                            </small>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : t.config.format === "groups" ? (
        <Empty
          title="The knockout journey is ahead"
          text="Once every group match is final, the top two teams qualify automatically into cross-group knockout pairings."
        />
      ) : !t.matches.length ? (
        <Empty
          title="Standings start with the draw"
          text="Generate fixtures to create the competition table."
        />
      ) : null}
    </>
  );
}
function AuditView({ rows }: { rows: Audit[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <Activity size={18} />
          <h3>Accountable from the first whistle</h3>
        </div>
        <Tag>Latest {rows.length} events</Tag>
      </div>
      {rows.map((a) => (
        <details className="audit-row" key={a.id}>
          <summary>
            <span className="audit-symbol">
              <ShieldCheck size={16} />
            </span>
            <div>
              <b>{a.action.replaceAll(".", " ").replaceAll("-", " ")}</b>
              <span>
                {a.actorName || "Account"} · {when(a.createdAt)}
              </span>
            </div>
            <ChevronDown size={15} />
          </summary>
          <pre>{JSON.stringify(a.details, null, 2)}</pre>
        </details>
      ))}
      {!rows.length && (
        <Empty
          title="A clear record from the start"
          text="Changes to fixtures, schedules and results appear here with an actor and timestamp."
        />
      )}
    </section>
  );
}

function PublicView({ hash, onExit }: { hash: string; onExit: () => void }) {
  const slug = hash.split("/")[2],
    [list, setList] = useState<any[]>([]),
    [t, setT] = useState<ViewTournament | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("fixtures"),
    [updated, setUpdated] = useState("");
  useEffect(() => {
    let alive = true;
    async function update() {
      try {
        if (slug) {
          const data = await api<ViewTournament>(
            `/public/tournaments/${encodeURIComponent(slug)}`,
          );
          if (alive) {
            setT(data);
            setUpdated(new Date().toLocaleTimeString());
          }
        } else {
          const data = await api<any[]>("/public/tournaments");
          if (alive) setList(data);
        }
        if (alive) setError("");
      } catch (e: any) {
        if (alive) setError(e.message);
      }
    }
    setT(null);
    void update();
    const interval = setInterval(() => {
      if (!document.hidden) void update();
    }, 2000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [slug]);
  const team = (id: string | null) =>
    t?.registrations.find((r) => r.team.id === id)?.team;
  return (
    <div className="public-site">
      <header className="public-header">
        <a className="brand" href="#/public">
          <span className="brand-mark">A</span>arenix
          <span className="brand-dot">.</span>
        </a>
        <span className="public-header-label">THE GAME IS FOR EVERYONE.</span>
        <button className="button subtle" onClick={onExit}>
          Workspace <ArrowUpRight size={16} />
        </button>
      </header>
      <main className="public-main">
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!slug ? (
          <>
            <section className="public-hero">
              <Tag tone="lime">
                <span className="status-dot" /> CAMPUS SPORT, CONNECTED
              </Tag>
              <h1>
                Find your team.
                <br />
                <em>Follow the action.</em>
              </h1>
              <p>
                Fixtures, results, and the road to the trophy.
                <br />
                Your tournament, in one place.
              </p>
              <Trophy className="public-hero-trophy" strokeWidth={0.7} />
            </section>
            <div className="public-section-heading">
              <h2>On the calendar</h2>
              <span className="muted">Football & futsal</span>
            </div>
            <div className="tournament-grid">
              {list.map((item) => (
                <a
                  className="tournament-card"
                  href={`#/public/${item.slug}`}
                  key={item.id}
                >
                  <div className={`tournament-card-art ${item.config.sport}`}>
                    <Trophy size={66} strokeWidth={1} />
                    <Tag tone="lime">
                      {item.status === "registration"
                        ? "Registration open"
                        : item.status}
                    </Tag>
                  </div>
                  <div className="tournament-card-body">
                    <small>{formats[item.config.format]}</small>
                    <h3>{item.config.name}</h3>
                    <p>
                      {dateOnly(item.config.startDate)} · {item.teams} teams
                    </p>
                    <span>
                      Follow tournament <ArrowUpRight size={16} />
                    </span>
                  </div>
                </a>
              ))}
            </div>
            {!list.length && !error && (
              <Empty
                title="The next competition is on its way"
                text="Public tournaments appear when registration opens or fixtures are published."
              />
            )}
          </>
        ) : t ? (
          <>
            <a className="back-link" href="#/public">
              <ChevronLeft size={15} /> All tournaments
            </a>
            <section className="public-tournament-hero">
              <div>
                <Tag tone="lime">
                  {t.config.sport} · {formats[t.config.format]}
                </Tag>
                <h1>{t.config.name}</h1>
                <p>{t.config.description}</p>
                <span>
                  <CalendarDays size={15} />
                  {dateOnly(t.config.startDate)} — {dateOnly(t.config.endDate)}
                </span>
              </div>
              <Trophy size={100} strokeWidth={0.8} />
            </section>
            <div className="public-live-bar">
              <Tag tone="lime">
                <span className="status-dot" /> AUTO REFRESH
              </Tag>
              <span>
                Last synced {updated} · Times in{" "}
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
            </div>
            <div className="tabs">
              {["fixtures", "standings", "teams"].map((name) => (
                <button
                  className={tab === name ? "active" : ""}
                  key={name}
                  onClick={() => setTab(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            {tab === "standings" ? (
              <StandingsView tournament={t} />
            ) : tab === "teams" ? (
              <div className="team-grid">
                {t.registrations.map((r) => (
                  <div className="team-card" key={r.id}>
                    <Badge team={r.team} />
                    <h3>{r.team.name}</h3>
                    <Tag tone="lime">Approved</Tag>
                  </div>
                ))}
              </div>
            ) : (
              <section className="panel">
                <div className="panel-heading">
                  <h3>Fixtures & results</h3>
                  <Tag>{t.matches.length} matches</Tag>
                </div>
                {t.matches.map((m) => (
                  <div className="public-fixture" key={m.id}>
                    <div className="fixture-date">
                      <b>
                        {when(t.slots.find((s) => s.id === m.slotId)?.start)}
                      </b>
                      <span>
                        {t.venues.find((v) => v.id === m.venueId)?.name ||
                          "Venue pending"}
                      </span>
                    </div>
                    <div className="public-team">
                      <Badge team={team(m.homeId)} size="small" />
                      <b>{team(m.homeId)?.name || m.homeFrom || "Bye"}</b>
                    </div>
                    <strong className="public-score">
                      {m.status === "final"
                        ? `${m.homeScore} : ${m.awayScore}`
                        : m.status === "bye"
                          ? "BYE"
                          : "vs"}
                      {m.penaltyHome !== undefined && (
                        <small>
                          pens {m.penaltyHome}–{m.penaltyAway}
                        </small>
                      )}
                    </strong>
                    <div className="public-team">
                      <Badge team={team(m.awayId)} size="small" />
                      <b>{team(m.awayId)?.name || m.awayFrom || "Bye"}</b>
                    </div>
                    <Tag tone={m.status === "final" ? "lime" : ""}>
                      {m.status === "final"
                        ? "Final"
                        : m.group
                          ? `Group ${m.group}`
                          : `Round ${m.round}`}
                    </Tag>
                  </div>
                ))}
                {!t.matches.length && (
                  <Empty
                    title="The draw is coming"
                    text={`Registration closes ${when(t.config.deadline)}. Managers can sign in to register their teams.`}
                  />
                )}
              </section>
            )}
          </>
        ) : (
          !error && (
            <div className="splash">
              <Loader2 className="spin" />
              <p>Loading tournament…</p>
            </div>
          )
        )}
      </main>
      <footer className="public-footer">
        <span>arenix.</span> Every match deserves a home.
      </footer>
    </div>
  );
}
