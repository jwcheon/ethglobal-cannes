/// <reference types="@cloudflare/workers-types" />

declare type PagesFunction<Env = unknown> = (
  context: EventContext<Env, string, unknown>
) => Response | Promise<Response>;

declare interface EventContext<Env, P extends string, Data> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: Record<P, string>;
  data: Data;
}
