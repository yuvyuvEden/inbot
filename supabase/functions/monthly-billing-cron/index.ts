import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAT = 0.18;

Deno.serve(async (req) => {
  // אבטחה — רק Supabase cron יכול לקרוא לפונקציה
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  let created = 0, skipped = 0, failed = 0;
  const errors: string[] = [];

  // --- חיוב רואי חשבון ---
  const { data: accountants, error: accErr } = await supabase
    .from("accountants")
    .select("id, name, base_client_count, monthly_fee, price_per_client, billing_day, free_months")
    .eq("is_active", true);

  if (accErr) {
    return new Response(JSON.stringify({ error: accErr.message }), { status: 500 });
  }

  for (const acc of accountants ?? []) {
    const { data: existing } = await supabase
      .from("billing_log")
      .select("id")
      .eq("entity_type", "accountant")
      .eq("entity_id", acc.id)
      .eq("billing_period", currentMonthStr)
      .maybeSingle();

    if (existing) { skipped++; continue; }

    const { count: activeCount } = await supabase
      .from("accountant_clients")
      .select("id", { count: "exact", head: true })
      .eq("accountant_id", acc.id)
      .is("unassigned_at", null);

    const isFree = (acc.free_months ?? 0) > 0;
    const baseCount = acc.base_client_count ?? 10;
    const active = activeCount ?? 0;
    const extraCount = Math.max(0, active - baseCount);
    const baseAmount = acc.monthly_fee ?? 0;
    const extraAmount = extraCount * (acc.price_per_client ?? 0);
    const totalBeforeVat = baseAmount + extraAmount;
    const vatAmount = Math.round(totalBeforeVat * VAT * 100) / 100;
    const totalWithVat = Math.round((totalBeforeVat + vatAmount) * 100) / 100;

    const { error: insertErr } = await supabase.from("billing_log").insert({
      entity_type: "accountant",
      entity_id: acc.id,
      billing_period: currentMonthStr,
      billing_day: acc.billing_day ?? 1,
      base_count: baseCount,
      extra_count: extraCount,
      base_amount: isFree ? 0 : baseAmount,
      extra_amount: isFree ? 0 : extraAmount,
      total_before_vat: isFree ? 0 : totalBeforeVat,
      vat_amount: isFree ? 0 : vatAmount,
      total_with_vat: isFree ? 0 : totalWithVat,
      status: isFree ? "waived" : "pending",
      payment_method: isFree ? "free" : null,
      notes: isFree ? `חודש חינם (נותרו ${acc.free_months - 1})` : null,
    });

    if (insertErr) {
      failed++;
      errors.push(`accountant ${acc.id}: ${insertErr.message}`);
      continue;
    }

    if (isFree) {
      await supabase
        .from("accountants")
        .update({ free_months: acc.free_months - 1 })
        .eq("id", acc.id);
    }
    created++;
  }

  // --- חיוב לקוחות ישירים (לא מנוהלים) ---
  const { data: managedIds } = await supabase
    .from("accountant_clients")
    .select("client_id")
    .is("unassigned_at", null);

  const managedSet = new Set((managedIds ?? []).map((r: any) => r.client_id));

  const { data: clients, error: clientErr } = await supabase
    .from("clients")
    .select("id, billing_cycle, billing_day, free_months, locked_monthly_price, locked_yearly_price, plan_id, plans(monthly_price, yearly_price)")
    .eq("is_active", true);

  if (clientErr) {
    return new Response(JSON.stringify({ error: clientErr.message, partial: { created, skipped, failed } }), { status: 500 });
  }

  for (const client of (clients ?? []).filter((c: any) => !managedSet.has(c.id))) {
    const { data: existing } = await supabase
      .from("billing_log")
      .select("id")
      .eq("entity_type", "client_direct")
      .eq("entity_id", client.id)
      .eq("billing_period", currentMonthStr)
      .maybeSingle();

    if (existing) { skipped++; continue; }

    const isFree = (client.free_months ?? 0) > 0;
    const planMonthly = (client as any).plans?.monthly_price ?? 0;
    const planYearly = (client as any).plans?.yearly_price ?? 0;
    const amount = client.billing_cycle === "yearly"
      ? (client.locked_yearly_price ?? planYearly)
      : (client.locked_monthly_price ?? planMonthly);
    const vatAmount = Math.round(amount * VAT * 100) / 100;
    const totalWithVat = Math.round((amount + vatAmount) * 100) / 100;

    const { error: insertErr } = await supabase.from("billing_log").insert({
      entity_type: "client_direct",
      entity_id: client.id,
      billing_period: currentMonthStr,
      billing_day: client.billing_day ?? 1,
      base_count: 1,
      extra_count: 0,
      base_amount: isFree ? 0 : amount,
      extra_amount: 0,
      total_before_vat: isFree ? 0 : amount,
      vat_amount: isFree ? 0 : vatAmount,
      total_with_vat: isFree ? 0 : totalWithVat,
      status: isFree ? "waived" : "pending",
      payment_method: isFree ? "free" : null,
      notes: isFree ? `חודש חינם (נותרו ${client.free_months - 1})` : null,
    });

    if (insertErr) {
      failed++;
      errors.push(`client ${client.id}: ${insertErr.message}`);
      continue;
    }

    if (isFree) {
      await supabase
        .from("clients")
        .update({ free_months: client.free_months - 1 })
        .eq("id", client.id);
    }
    created++;
  }

  return new Response(
    JSON.stringify({ success: true, period: currentMonthStr, created, skipped, failed, errors }),
    { headers: { "Content-Type": "application/json" }, status: 200 }
  );
});
