import { NextRequest, NextResponse } from "next/server";
import { publishGateControl } from "@/lib/mqtt";

/**
 * Test endpoint to verify MQTT connection and publishing
 * Access via: GET /api/test-mqtt?gate=ENTRY&action=OPEN
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const gate = searchParams.get("gate") || "ENTRY";
    const action = searchParams.get("action") || "OPEN";

    console.log("[TEST] Testing gate control:", { gate, action });

    // Validate
    if (!["ENTRY", "EXIT"].includes(gate as string)) {
      return NextResponse.json({ error: "Invalid gate" }, { status: 400 });
    }
    if (!["OPEN", "CLOSE"].includes(action as string)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Try to publish
    try {
      console.log("[TEST] Attempting to publish...");
      await publishGateControl(gate as "ENTRY" | "EXIT", action as "OPEN" | "CLOSE");
      console.log("[TEST] Publish successful");
      return NextResponse.json({
        success: true,
        message: "Command published successfully",
        gate,
        action,
      });
    } catch (error) {
      console.error("[TEST] Publish failed:", error);
      return NextResponse.json(
        {
          success: false,
          error: String(error),
          message: "Failed to publish - check backend logs",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[TEST] Error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
