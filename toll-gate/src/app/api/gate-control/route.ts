import { NextRequest, NextResponse } from "next/server";
import { publishGateControl } from "@/lib/mqtt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gate, action } = body;

    console.log("[API] Gate control request:", { gate, action });

    // Validate inputs
    if (!gate || !action) {
      return NextResponse.json(
        { error: "Missing gate or action parameter" },
        { status: 400 }
      );
    }

    if (!["ENTRY", "EXIT"].includes(gate)) {
      return NextResponse.json(
        { error: "Invalid gate. Must be ENTRY or EXIT" },
        { status: 400 }
      );
    }

    if (!["OPEN", "CLOSE"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be OPEN or CLOSE" },
        { status: 400 }
      );
    }

    // Publish to MQTT
    try {
      await publishGateControl(gate, action);
    } catch (mqttError) {
      console.error("[API] MQTT publish error:", mqttError);
      return NextResponse.json(
        { error: "Failed to send command to MQTT broker" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Gate ${gate} command ${action} sent successfully`,
      gate,
      action,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Gate control error:", error);
    return NextResponse.json(
      { error: "Failed to control gate: " + String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: "Use POST to control gates. Parameters: gate (ENTRY|EXIT), action (OPEN|CLOSE)" },
    { status: 405 }
  );
}
