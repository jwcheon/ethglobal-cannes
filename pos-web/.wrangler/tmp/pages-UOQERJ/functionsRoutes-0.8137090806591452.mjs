import { onRequestGet as __api_customer_lookup__code__ts_onRequestGet } from "/Users/jw/ethglobal-cannes/pos-web/functions/api/customer/lookup/[code].ts"
import { onRequestOptions as __api_customer_lookup__code__ts_onRequestOptions } from "/Users/jw/ethglobal-cannes/pos-web/functions/api/customer/lookup/[code].ts"
import { onRequestOptions as __api_customer_store_ts_onRequestOptions } from "/Users/jw/ethglobal-cannes/pos-web/functions/api/customer/store.ts"
import { onRequestPost as __api_customer_store_ts_onRequestPost } from "/Users/jw/ethglobal-cannes/pos-web/functions/api/customer/store.ts"
import { onRequestGet as __api_lookup__code__ts_onRequestGet } from "/Users/jw/ethglobal-cannes/pos-web/functions/api/lookup/[code].ts"
import { onRequestOptions as __api_lookup__code__ts_onRequestOptions } from "/Users/jw/ethglobal-cannes/pos-web/functions/api/lookup/[code].ts"
import { onRequestOptions as __api_store_ts_onRequestOptions } from "/Users/jw/ethglobal-cannes/pos-web/functions/api/store.ts"
import { onRequestPost as __api_store_ts_onRequestPost } from "/Users/jw/ethglobal-cannes/pos-web/functions/api/store.ts"
import { onRequestOptions as __wcgateway___path___ts_onRequestOptions } from "/Users/jw/ethglobal-cannes/pos-web/functions/wcgateway/[[path]].ts"
import { onRequestOptions as __wcpay___path___ts_onRequestOptions } from "/Users/jw/ethglobal-cannes/pos-web/functions/wcpay/[[path]].ts"
import { onRequest as __wcgateway___path___ts_onRequest } from "/Users/jw/ethglobal-cannes/pos-web/functions/wcgateway/[[path]].ts"
import { onRequest as __wcpay___path___ts_onRequest } from "/Users/jw/ethglobal-cannes/pos-web/functions/wcpay/[[path]].ts"

export const routes = [
    {
      routePath: "/api/customer/lookup/:code",
      mountPath: "/api/customer/lookup",
      method: "GET",
      middlewares: [],
      modules: [__api_customer_lookup__code__ts_onRequestGet],
    },
  {
      routePath: "/api/customer/lookup/:code",
      mountPath: "/api/customer/lookup",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_customer_lookup__code__ts_onRequestOptions],
    },
  {
      routePath: "/api/customer/store",
      mountPath: "/api/customer",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_customer_store_ts_onRequestOptions],
    },
  {
      routePath: "/api/customer/store",
      mountPath: "/api/customer",
      method: "POST",
      middlewares: [],
      modules: [__api_customer_store_ts_onRequestPost],
    },
  {
      routePath: "/api/lookup/:code",
      mountPath: "/api/lookup",
      method: "GET",
      middlewares: [],
      modules: [__api_lookup__code__ts_onRequestGet],
    },
  {
      routePath: "/api/lookup/:code",
      mountPath: "/api/lookup",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_lookup__code__ts_onRequestOptions],
    },
  {
      routePath: "/api/store",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_store_ts_onRequestOptions],
    },
  {
      routePath: "/api/store",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_store_ts_onRequestPost],
    },
  {
      routePath: "/wcgateway/:path*",
      mountPath: "/wcgateway",
      method: "OPTIONS",
      middlewares: [],
      modules: [__wcgateway___path___ts_onRequestOptions],
    },
  {
      routePath: "/wcpay/:path*",
      mountPath: "/wcpay",
      method: "OPTIONS",
      middlewares: [],
      modules: [__wcpay___path___ts_onRequestOptions],
    },
  {
      routePath: "/wcgateway/:path*",
      mountPath: "/wcgateway",
      method: "",
      middlewares: [],
      modules: [__wcgateway___path___ts_onRequest],
    },
  {
      routePath: "/wcpay/:path*",
      mountPath: "/wcpay",
      method: "",
      middlewares: [],
      modules: [__wcpay___path___ts_onRequest],
    },
  ]