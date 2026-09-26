import { NextRequest, NextResponse } from "next/server";


export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhooks = await prisma.webhook.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ webhooks });
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
  }

}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = webhookSchema.parse(body);

    const webhook = await prisma.webhook.create({
      data: {
        userId: session.user.id,
        url: validatedData.url,
        events: validatedData.events,
        secret: validatedData.secret,
        description: validatedData.description,
        active: true,
      },
    });

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Error creating webhook:", error);
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }
}