import { recentMcpEvents, subscribeMcpEvents, type McpCallEvent } from "@/lib/mcp-events";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  if (new URL(req.url).searchParams.get("snapshot") === "1") {
    return Response.json(
      { events: recentMcpEvents(20) },
      {
        headers: {
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setInterval> | undefined;
      let unsub: (() => void) | undefined;

      cleanup = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        if (unsub) unsub();
        req.signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          // stream already closed
        }
      };

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };

      send(`: connected\n\nevent: snapshot\ndata: ${JSON.stringify(recentMcpEvents(12))}\n\n`);

      unsub = subscribeMcpEvents((ev: McpCallEvent) => {
        send(`id: ${ev.id}\nevent: mcp\ndata: ${JSON.stringify(ev)}\n\n`);
      });

      timer = setInterval(() => send(": ping\n\n"), 20_000);
      req.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
