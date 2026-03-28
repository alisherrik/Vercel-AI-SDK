import { z } from "zod";

import {
  createBuildRun,
  listBuildRunSnapshots,
} from "@/lib/orchestrator/engine";
import { buildRunCreateRequestSchema } from "@/lib/planner/schemas";
import { getReadableRouteError } from "@/lib/route-error";

export const runtime = "nodejs";

export async function GET() {
  try {
    const runs = await listBuildRunSnapshots();
    return Response.json(runs);
  } catch (error) {
    return Response.json(
      { error: getReadableRouteError(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = buildRunCreateRequestSchema.parse(await request.json());

    try {
      const run = await createBuildRun(body);
      return Response.json(run, { status: 201 });
    } catch (innerError) {
      console.error("[build-runs] createBuildRun error:", innerError);
      return Response.json(
        { error: getReadableRouteError(innerError) },
        { status: 500 },
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("[build-runs] ZodError:", JSON.stringify(error.issues, null, 2));
      return Response.json(
        { error: "The build-run request shape was invalid.", details: error.issues },
        { status: 400 },
      );
    }

    return Response.json(
      { error: getReadableRouteError(error) },
      { status: 500 },
    );
  }
}
