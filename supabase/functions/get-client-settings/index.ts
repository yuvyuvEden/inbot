import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONNECTOR_SECRET = Deno.env.get("CONNECTOR_SECRET") ?? "";

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  if (!CONNECTOR_SECRET || auth !== `Bearer ${CONNECTOR_SECRET}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const clientId = req.headers.get("X-Client-Id") ?? "";
  if (!clientId || !isValidUuid(clientId)) {
    return json({ error: "X-Client-Id header missing or invalid" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const [settingsRes, clientRes] = await Promise.all([
    supabase.from("system_settings").select("key, value"),
    supabase.from("clients").select(`
      id, brand_name, vat_number, business_nature, custom_categories,
      owner_aliases, fetch_domains, known_domains, learned_words, tax_rules,
      thread_limit, max_logo_bytes, lookback_rows, max_distance,
      alloc_threshold_before, alloc_threshold_after, ai_temperature,
      gemini_api_key, telegram_chat_id, sheet_id, drive_folder_id,
      settings_refresh_requested
    `).eq("id", clientId).eq("is_active", true).maybeSingle(),
  ]);

  if (settingsRes.error) return json({ error: "Failed to fetch system settings" }, 500);
  if (clientRes.error)   return json({ error: "Failed to fetch client" }, 500);
  if (!clientRes.data)   return json({ error: "Client not found or inactive" }, 404);

  const globalSettings: Record<string, any> = {};
  for (const row of settingsRes.data ?? []) {
    try { globalSettings[row.key] = JSON.parse(row.value); }
    catch { globalSettings[row.key] = row.value; }
  }

  if (clientRes.data.settings_refresh_requested) {
    await supabase.from("clients").update({
      settings_refresh_requested: false,
      settings_refreshed_at: new Date().toISOString(),
    }).eq("id", clientId);
  }

  const client = clientRes.data;

  return json({
    success: true,
    globalSettings: {
      vat_rules:                   globalSettings.vat_rules                 ?? {},
      income_tax_rules:            globalSettings.income_tax_rules          ?? {},
      no_vat_categories:           globalSettings.no_vat_categories         ?? [],
      categories:                  globalSettings.categories                ?? [],
      allocation_threshold_before: Number(globalSettings.allocation_threshold_before ?? 10000),
      allocation_threshold_after:  Number(globalSettings.allocation_threshold_after  ?? 5000),
      known_domains_global:        globalSettings.known_domains_global      ?? [],
      fetch_domains_global:        globalSettings.fetch_domains_global      ?? [],
      gmail_search_days:           Number(globalSettings.gmail_search_days  ?? 60),
      gmail_base_terms:            globalSettings.gmail_base_terms          ?? "",
      gmail_attach_condition:      globalSettings.gmail_attach_condition    ?? "",
      notification_only_phrases:   globalSettings.notification_only_phrases ?? [],
      invoice_platforms:           globalSettings.invoice_platforms         ?? [],
      duplicate_lookback_rows:     Number(globalSettings.duplicate_lookback_rows ?? 1000),
      food_vendors_regex:          globalSettings.food_vendors_regex        ?? "",
      vendor_strip_suffixes:       globalSettings.vendor_strip_suffixes     ?? [],
      ai_temperature:              Number(globalSettings.ai_temperature     ?? 0.1),
      vat_rate_percent:            Number(globalSettings.vat_rate_percent   ?? 18),
    },
    clientSettings: {
      client_id:              client.id,
      brand_name:             client.brand_name,
      vat_number:             client.vat_number             ?? "",
      telegram_chat_id:       client.telegram_chat_id       ?? "",
      sheet_id:               client.sheet_id               ?? "",
      drive_folder_id:        client.drive_folder_id        ?? "",
      gemini_api_key:         client.gemini_api_key         ?? "",
      business_nature:        client.business_nature        ?? "",
      custom_categories:      client.custom_categories      ?? [],
      owner_aliases:          client.owner_aliases          ?? [],
      fetch_domains:          client.fetch_domains          ?? [],
      known_domains:          client.known_domains          ?? [],
      learned_words:          client.learned_words          ?? [],
      tax_rules:              client.tax_rules              ?? {},
      thread_limit:           client.thread_limit           ?? null,
      max_logo_bytes:         client.max_logo_bytes         ?? null,
      lookback_rows:          client.lookback_rows          ?? null,
      max_distance:           client.max_distance           ?? null,
      alloc_threshold_before: client.alloc_threshold_before ?? null,
      alloc_threshold_after:  client.alloc_threshold_after  ?? null,
      ai_temperature:         client.ai_temperature         ?? null,
    },
  });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
