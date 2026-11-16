import "reflect-metadata";
import "dotenv/config";
import {
  Body,
  Catch,
  Controller,
  Get,
  HttpException,
  Inject,
  Module,
  Param,
  Post,
  Put,
  Req,
  Res,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { Request, Response } from "express";
import express from "express";
import { resolve } from "node:path";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { ZodError } from "zod";
import { pathToFileURL } from "node:url";
import { database, Repository, type Database } from "./db.js";
import { Auth, role } from "./auth.js";
import { Service } from "./service.js";
import { RuleError } from "../../../packages/core/engine.js";
const DB = "DATABASE";
@Catch()
class Errors implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500,
      message = "An unexpected server error occurred.";
    if (e instanceof ZodError) {
      status = 400;
      message = e.issues
        .map((x) => `${x.path.join(".") || "Input"}: ${x.message}`)
        .join(" ");
    } else if (e instanceof RuleError) {
      status = /changed|Refresh/.test(e.message) ? 409 : 400;
      message = e.message;
    } else if (e instanceof HttpException) {
      status = e.getStatus();
      message = e.message;
    } else console.error(e);
    res.status(status).json({ statusCode: status, message });
  }
}
@Controller("api")
class Api {
  constructor(
    @Inject(Auth) private auth: Auth,
    @Inject(Service) private service: Service,
    @Inject(Repository) private repo: Repository,
  ) {}
  user(req: Request) {
    return this.auth.user(req.cookies?.arenix_session);
  }
  @Get("health") async health() {
    await this.repo.db.query("SELECT 1");
    return { status: "ok", service: "Arenix API" };
  }
  @Get("meta") meta() {
    return { temporaryReview: process.env.ARENIX_REVIEW === "true" };
  }
  @Post("auth/register") async register(
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    this.auth.throttle(req.ip || "local");
    return this.auth.signup(body);
  }
  @Post("auth/login") async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.auth.throttle(req.ip || "local");
    const { token, user } = await this.auth.login(body);
    res.cookie("arenix_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1800000,
      path: "/api",
    });
    return user;
  }
  @Get("auth/me") async me(@Req() req: Request) {
    return this.user(req);
  }
  @Post("auth/logout") async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(await this.user(req));
    res.clearCookie("arenix_session", { path: "/api" });
    return { message: "Signed out." };
  }
  @Get("public/tournaments") publicList() {
    return this.service.publicList();
  }
  @Get("public/tournaments/:id") publicDetail(@Param("id") id: string) {
    return this.service.publicDetail(id);
  }
  @Get("tournaments") async list(@Req() req: Request) {
    return this.service.list(await this.user(req));
  }
  @Post("tournaments") async create(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    return this.service.create(body, await this.user(req));
  }
  @Get("tournaments/:id") async detail(
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    return this.service.detail(id, await this.user(req));
  }
  @Post("tournaments/:id/actions/:action") async action(
    @Param("id") id: string,
    @Param("action") action: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.service.action(id, action, body, await this.user(req));
  }
  @Get("teams") async teams(@Req() req: Request) {
    const u = await this.user(req);
    role(u, "manager");
    return this.repo.teams(u.id);
  }
  @Post("teams") async team(@Req() req: Request, @Body() body: unknown) {
    return this.service.createTeam(body, await this.user(req));
  }
  @Put("teams/:id") async editTeam(
    @Param("id") id: string,
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    return this.service.editTeam(id, body, await this.user(req));
  }
  @Get("users") async users(@Req() req: Request) {
    return this.service.users(await this.user(req));
  }
  @Post("users/:id/active") async active(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.service.active(id, body, await this.user(req));
  }
  @Get("scorers") async scorers(@Req() req: Request) {
    return this.service.scorers(await this.user(req));
  }
  @Get("audit") async allAudit(@Req() req: Request) {
    const u = await this.user(req);
    role(u, "admin");
    return this.repo.audits();
  }
  @Get("tournaments/:id/audit") async audit(
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    const u = await this.user(req),
      t = await this.repo.get(id);
    if (u.role !== "admin") this.service.owner(t, u);
    return this.repo.audits(t.id);
  }
}
export async function createApp(db: Database) {
  @Module({
    controllers: [Api],
    providers: [
      { provide: DB, useValue: db },
      {
        provide: Repository,
        useFactory: (d: Database) => new Repository(d),
        inject: [DB],
      },
      { provide: Auth, useFactory: (d: Database) => new Auth(d), inject: [DB] },
      {
        provide: Service,
        useFactory: (r: Repository) => new Service(r),
        inject: [Repository],
      },
    ],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === "test" ? false : ["error", "warn", "log"],
  });
  app.use(helmet());
  app.use(cookieParser());
  const origin = process.env.APP_ORIGIN || "http://127.0.0.1:5180";
  app.enableCors({
    origin,
    credentials: true,
    methods: ["GET", "POST", "PUT"],
  });
  app.use((req: Request, res: Response, next: () => void) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== origin
    ) {
      res.status(403).json({ message: "Request origin is not allowed." });
      return;
    }
    next();
  });
  if (process.env.NODE_ENV === "production")
    app.use(express.static(resolve("dist/web")));
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
  await app.init();
  return app;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const db = database();
  const app = await createApp(db);
 await db.query("SELECT 1 FROM arenix.users LIMIT 1");
  await app.listen(Number(process.env.PORT || 3001), "127.0.0.1");
  console.log(
    `Arenix API: http://127.0.0.1:${process.env.PORT || 3001}/api/health`,
  );
}
