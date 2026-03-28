import {
  getBuildRunArtifacts,
} from "@/lib/orchestrator/engine";
import { getReadableRouteError } from "@/lib/route-error";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/build-runs/[id]/artifacts">,
) {
  try {
    const { id } = await context.params;
    const artifacts = await getBuildRunArtifacts(id);
    return Response.json(artifacts);
  } catch (error) {
    const message = getReadableRouteError(error);
    const status = message.includes("was not found") ? 404 : 500;

    return Response.json({ error: message }, { status });
  }
}
