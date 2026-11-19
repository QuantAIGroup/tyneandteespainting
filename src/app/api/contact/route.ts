import { NextResponse } from "next/server";
import { z } from "zod";
import { sendNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.email("Please enter a valid email address").max(200),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(10, "Please write a short message").max(3000),
  website: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "The contact form isn't connected yet. Please phone or email us." }, { status: 503 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the form" }, { status: 400 });
  }
  const { name, email, phone, message, website } = parsed.data;
  if (website) return NextResponse.json({ ok: true });

  const { error } = await supabase.from("contact_messages").insert({ name, email: email.toLowerCase(), phone: phone || null, message });
  if (error) {
    console.error("Contact insert failed", error);
    return NextResponse.json({ error: "We couldn't send your message. Please try again." }, { status: 500 });
  }
  await sendNotification(`New website message from ${name}`, [`Name: ${name}`, `Email: ${email}`, `Phone: ${phone || "Not given"}`, "", message]);
  return NextResponse.json({ ok: true });
}
