import { queryEnv } from "./common.ts";

export type Handler = (req: Request, conn: Deno.Conn) => Promise<Response>;

export const server = async (handler: Handler) => {
  const hostname = await queryEnv("BIND_HOST", "localhost");
  const port: number = parseInt(await queryEnv("BIND_PORT", "0"));
  const listener: Deno.Listener = Deno.listen({ hostname, port });
  console.log(`Listening on port ${(listener.addr as Deno.NetAddr).port}`);

  for await (const conn of listener) {
    try {
      const httpConn = Deno.serveHttp(conn);
      for await (const e of httpConn) {
        try {
          e.respondWith(handler(e.request, conn));
        } catch (err) {
          console.error("Failed to respond to request:", e, err);
        }
      }
    } catch (e) {
      console.error("Failed awaiting connection from listener:", e);
    }
  }
};
