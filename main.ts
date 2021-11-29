import { server } from "./server.ts";
import { HttpError } from "./common.ts";

import { handleDdnsRequest } from "./netlify.ts";

await server(async (request: Request, conn: Deno.Conn) => {
  const { pathname } = new URL(request.url);
  console.log(pathname);
  try {
    if (pathname.startsWith("/v1/netlify-ddns/replace-all-dns-records")) {
      return await handleDdnsRequest(request, conn);
    }
    return new HttpError("Not Found", "not_found", 404).toResponse();
  } catch (e) {
    if (e instanceof HttpError) {
      return e.toResponse();
    } else {
      console.error("Unknown exception occurred in server handler:", e);
      return new HttpError("Unknown Server Error", "unknown_server_error", 500)
        .toResponse();
    }
  }
});
