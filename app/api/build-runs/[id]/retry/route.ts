import {
  retryBuildRun,
} from "@/lib/orchestrator/engine";
import { getReadableRouteError } from "@/lib/route-error";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/build-runs/[id]/retry">,
) {
  try {
    const { id } = await context.params;
    const run = await retryBuildRun(id);
    return Response.json(run);
  } catch (error) {
    return Response.json(
      { error: getReadableRouteError(error) },
      { status: 500 },
    );
  }
}
