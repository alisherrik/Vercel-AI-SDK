import {
  getBuildRunSnapshot,
} from "@/lib/orchestrator/engine";
import { getReadableRouteError } from "@/lib/route-error";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/build-runs/[id]">,
) {
  try {
    const { id } = await context.params;
    const run = await getBuildRunSnapshot(id);

    if (!run) {
      return Response.json({ error: "Build run not found." }, { status: 404 });
    }

    return Response.json(run);
  } catch (error) {
    return Response.json(
      { error: getReadableRouteError(error) },
      { status: 500 },
    );
  }
}
