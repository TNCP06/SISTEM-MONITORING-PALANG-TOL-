let latestData = {
  uid: "-",
  status: "-",
  total: 0,
};

export async function GET() {
  return Response.json(latestData);
}

export async function POST(req) {
  const body = await req.json();
  latestData = body;
  return Response.json({ ok: true });
}