import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, Plus, X, Globe, Download, FileText, Tags } from "lucide-react";
import { useVatRules, useUpdateVatRule, type VatRule } from "@/hooks/useVatRules";
import { useSystemSettings, useUpdateSystemSetting } from "@/hooks/useSystemSettings";

/* ── styles (copied from SettingsTab.tsx) ── */
const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
  boxShadow: "0 1px 3px rgba(0,0,0,.08)", overflow: "hidden",
};
const cardHeader: React.CSSProperties = {
  background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "12px 16px",
  fontSize: 13, fontWeight: 700, color: "#1e3a5f", display: "flex", gap: 8, alignItems: "center",
};
const btnPrimary: React.CSSProperties = {
  background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8,
  padding: "7px 14px", cursor: "pointer", fontSize: 13, fontFamily: "Heebo, sans-serif",
  display: "inline-flex", alignItems: "center", gap: 6,
};
const btnSm: React.CSSProperties = { padding: "5px 10px", fontSize: 12 };
const btnGhost: React.CSSProperties = {
  background: "transparent", border: "none", borderRadius: 8,
  padding: "5px 10px", cursor: "pointer", fontSize: 12, fontFamily: "Heebo, sans-serif",
  display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b",
};
const inputBase: React.CSSProperties = {
  border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, fontFamily: "Heebo, sans-serif", outline: "none", width: "100%",
};
const inputLtr: React.CSSProperties = { ...inputBase, direction: "ltr", fontFamily: "monospace" };
const statRow: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", padding: "10px 0",
  borderBottom: "1px solid #f1f5f9", fontSize: 13, gap: 12, alignItems: "flex-start",
};
const scrollList: React.CSSProperties = {
  maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0",
  borderRadius: 8, background: "#f8fafc",
};

type TabKey = "ai" | "money" | "domains" | "prompts";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ai", label: "🤖 AI וסריקה" },
  { key: "money", label: "💰 כספים ומע״מ" },
  { key: "domains", label: "📋 דומיינים וקטגוריות" },
  { key: "prompts", label: "📝 פרומפטים" },
];

/* ── Setting row: editable input + per-row save button ── */
function SettingField({
  label, description, type, loadedValue, onSave, step, min, max,
}: {
  label: string;
  description?: string;
  type: "text" | "number" | "textarea";
  loadedValue: string;
  onSave: (val: string) => Promise<void>;
  step?: number;
  min?: number;
  max?: number;
}) {
  const [val, setVal] = useState(loadedValue);
  const [saving, setSaving] = useState(false);
  // keep local in sync if loaded value changes
  if (loadedValue !== undefined && val === "" && loadedValue !== "") {
    // Only initial sync — handled by useState initializer; no-op
  }
  const dirty = val !== loadedValue;

  const doSave = async () => {
    setSaving(true);
    try { await onSave(val); } finally { setSaving(false); }
  };

  return (
    <div style={statRow}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: "#1e3a5f" }}>{label}</div>
        {description && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, marginBottom: 6 }}>{description}</div>
        )}
        {type === "textarea" ? (
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            style={{ ...inputLtr, minHeight: 70, resize: "vertical" }}
          />
        ) : (
          <input
            type={type}
            value={val}
            step={step}
            min={min}
            max={max}
            onChange={(e) => setVal(e.target.value)}
            style={inputBase}
          />
        )}
      </div>
      <button
        onClick={doSave}
        disabled={!dirty || saving}
        style={{
          ...btnPrimary, ...btnSm,
          background: dirty ? "#1e3a5f" : "#e2e8f0",
          color: dirty ? "#fff" : "#94a3b8",
          cursor: dirty ? "pointer" : "default",
          alignSelf: "center",
        }}
      >
        {saving ? "..." : "שמור"}
      </button>
    </div>
  );
}

/* ── ListManager: input + scrollable chip list, auto-save ── */
function ListManager({
  items, placeholder, onChange,
}: {
  items: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (items.includes(v)) { toast.warning("הפריט כבר קיים"); return; }
    onChange([...items, v]);
    setInput("");
  };
  const remove = (v: string) => onChange(items.filter((x) => x !== v));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          style={{ ...inputLtr, flex: 1 }}
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        />
        <button style={{ ...btnPrimary, ...btnSm }} onClick={add}>
          <Plus size={14} />
        </button>
      </div>
      <div style={scrollList}>
        {items.length === 0 && (
          <div style={{ padding: 10, fontSize: 12, color: "#64748b" }}>ריק</div>
        )}
        {items.map((v) => (
          <div
            key={v}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "5px 10px", borderBottom: "1px solid #f1f5f9",
            }}
          >
            <span style={{ fontSize: 12, fontFamily: "monospace", direction: "ltr" }}>{v}</span>
            <button style={btnGhost} onClick={() => remove(v)}><X size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── component ── */
export default function AdminSystemTab() {
  const [activeTab, setActiveTab] = useState<TabKey>("ai");
  const [vatExpanded, setVatExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: settings = [], isLoading: settingsLoading } = useSystemSettings();
  const { mutateAsync: updateSetting } = useUpdateSystemSetting();

  const { data: vatRules = [], isLoading: vatLoading } = useVatRules();
  const { mutateAsync: updateRule } = useUpdateVatRule();
  const [dirty, setDirty] = useState<Record<string, Partial<VatRule>>>({});
  const [savingRule, setSavingRule] = useState<string | null>(null);

  const getSetting = (key: string) =>
    settings.find((s) => s.key === key)?.value ?? "";

  const saveSetting = async (key: string, value: string) => {
    try {
      await updateSetting({ key, value });
      toast.success("נשמר");
    } catch {
      toast.error("שגיאה בשמירה");
    }
  };

  const parseList = (key: string): string[] => {
    try { return JSON.parse(getSetting(key) || "[]"); } catch { return []; }
  };
  const saveList = async (key: string, arr: string[]) => {
    await saveSetting(key, JSON.stringify(arr));
  };

  // OR-string: ("term1" OR "term2" OR ...)
  const parseOrString = (s: string) =>
    s.replace(/^\(|\)$/g, "")
      .split(" OR ")
      .map((t) => t.replace(/^"|"$/g, "").replace(/\\"/g, '"').trim())
      .filter(Boolean);
  const buildOrString = (items: string[]) =>
    items.length ? "(" + items.map((t) => `"${t}"`).join(" OR ") + ")" : "";
  const saveOrList = async (key: string, items: string[]) =>
    saveSetting(key, buildOrString(items));

  // Pipe-regex: (a|b|c)
  const parsePipeRegex = (s: string) =>
    s.replace(/^\(|\)$/g, "").split("|").map((t) => t.trim()).filter(Boolean);
  const buildPipeRegex = (items: string[]) =>
    items.length ? "(" + items.join("|") + ")" : "";
  const savePipeRegex = async (key: string, items: string[]) =>
    saveSetting(key, buildPipeRegex(items));

  const refreshAllClients = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({ settings_refresh_requested: true } as any)
        .eq("is_active", true);
      if (error) throw error;
      toast.success("✅ כל הלקוחות יקבלו הגדרות מעודכנות בסריקה הבאה");
    } catch {
      toast.error("שגיאה בעדכון");
    } finally {
      setRefreshing(false);
    }
  };

  /* ── VAT rules helpers (preserved) ── */
  const getVal = (cat: string, field: keyof VatRule, fallback: any) =>
    dirty[cat]?.[field] !== undefined ? (dirty[cat] as any)[field] : fallback;

  const markDirty = (cat: string, field: keyof VatRule, value: any) =>
    setDirty((prev) => ({ ...prev, [cat]: { ...prev[cat], [field]: value } }));

  const saveRow = async (rule: VatRule) => {
    const merged = { ...rule, ...dirty[rule.category] };
    setSavingRule(rule.category);
    try {
      await updateRule({
        category: merged.category,
        vat_rate: Number(merged.vat_rate),
        tax_rate: Number(merged.tax_rate),
        no_vat: Boolean(merged.no_vat),
      });
      setDirty((prev) => {
        const n = { ...prev };
        delete n[rule.category];
        return n;
      });
      toast.success(`${rule.category} עודכן`);
    } catch {
      toast.error("שגיאה בשמירה");
    } finally {
      setSavingRule(null);
    }
  };

  if (settingsLoading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontFamily: "Heebo, sans-serif" }}>
        טוען...
      </div>
    );
  }

  /* ── Tab content renderers ── */
  const renderAiTab = () => (
    <>
      <div style={card}>
        <div style={cardHeader}>כוונון AI</div>
        <div style={{ padding: 16 }}>
          <SettingField
            label="טמפרטורת AI"
            description="0 = יציב, 0.5 = יצירתי. ברירת מחדל: 0.1"
            type="number"
            step={0.1}
            min={0}
            max={1}
            loadedValue={getSetting("ai_temperature")}
            onSave={(v) => saveSetting("ai_temperature", v)}
          />
        </div>
      </div>

      <div style={card}>
        <div style={cardHeader}>סריקת Gmail</div>
        <div style={{ padding: 16 }}>
          <SettingField
            label="ימי סריקה אחורה"
            type="number"
            loadedValue={getSetting("gmail_search_days")}
            onSave={(v) => saveSetting("gmail_search_days", v)}
          />
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, color: "#1e3a5f", fontSize: 13, marginBottom: 8 }}>
              מילות חיפוש בסיסיות
            </div>
            <ListManager
              items={parseOrString(getSetting("gmail_base_terms"))}
              placeholder="ביטוי חיפוש (למשל חשבונית)"
              onChange={(arr) => saveOrList("gmail_base_terms", arr)}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, color: "#1e3a5f", fontSize: 13, marginBottom: 8 }}>
              תנאי קבצים מצורפים
            </div>
            <ListManager
              items={parseOrString(getSetting("gmail_attach_condition"))}
              placeholder="תנאי (למשל has:attachment)"
              onChange={(arr) => saveOrList("gmail_attach_condition", arr)}
            />
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={cardHeader}>סינון מיילים</div>
        <div style={{ padding: 16 }}>
          <div>
            <div style={{ fontWeight: 700, color: "#1e3a5f", fontSize: 13, marginBottom: 8 }}>
              ביטויי התראה בלבד
            </div>
            <ListManager
              items={parseList("notification_only_phrases")}
              placeholder="ביטוי התראה (למשל document is ready)"
              onChange={(arr) => saveList("notification_only_phrases", arr)}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, color: "#1e3a5f", fontSize: 13, marginBottom: 8 }}>
              Regex ספקי מזון
            </div>
            <ListManager
              items={parsePipeRegex(getSetting("food_vendors_regex"))}
              placeholder="שם ספק מזון (למשל רמי לוי)"
              onChange={(arr) => savePipeRegex("food_vendors_regex", arr)}
            />
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={cardHeader}>נרמול שמות ספקים</div>
        <div style={{ padding: 16 }}>
          <ListManager
            items={parseList("vendor_strip_suffixes")}
            placeholder="סיומת לגזירה (למשל בע״מ)"
            onChange={(arr) => saveList("vendor_strip_suffixes", arr)}
          />
        </div>
      </div>
    </>
  );

  const renderMoneyTab = () => (
    <>
      <div style={card}>
        <div style={cardHeader}>הגדרות כספיות</div>
        <div style={{ padding: 16 }}>
          <SettingField
            label="שיעור מע״מ (%)"
            type="number"
            loadedValue={getSetting("vat_rate_percent")}
            onSave={(v) => saveSetting("vat_rate_percent", v)}
          />
          <SettingField
            label="מטבע ברירת מחדל"
            type="text"
            loadedValue={getSetting("currency")}
            onSave={(v) => saveSetting("currency", v)}
          />
          <SettingField
            label="ימי עיבוד חשבונית"
            type="number"
            loadedValue={getSetting("invoice_processing_days")}
            onSave={(v) => saveSetting("invoice_processing_days", v)}
          />
          <SettingField
            label="שורות בדיקת כפילות"
            type="number"
            loadedValue={getSetting("duplicate_lookback_rows")}
            onSave={(v) => saveSetting("duplicate_lookback_rows", v)}
          />
        </div>
      </div>

      <div style={card}>
        <div style={cardHeader}>סף מספר הקצאה</div>
        <div style={{ padding: 16 }}>
          <SettingField
            label="לפני יוני 2026 (₪)"
            type="number"
            loadedValue={getSetting("allocation_threshold_before")}
            onSave={(v) => saveSetting("allocation_threshold_before", v)}
          />
          <SettingField
            label="מיוני 2026 ואילך (₪)"
            type="number"
            loadedValue={getSetting("allocation_threshold_after")}
            onSave={(v) => saveSetting("allocation_threshold_after", v)}
          />
        </div>
      </div>

      <div style={{ ...card, gridColumn: "1 / -1" }}>
        <button
          onClick={() => setVatExpanded((v) => !v)}
          style={{
            ...cardHeader,
            width: "100%",
            border: "none",
            cursor: "pointer",
            justifyContent: "space-between",
            fontFamily: "Heebo, sans-serif",
          }}
        >
          <span>כללי מע״מ גלובליים</span>
          <ChevronDown
            size={16}
            style={{ transform: vatExpanded ? "rotate(180deg)" : "none", transition: "transform .15s" }}
          />
        </button>
        {vatExpanded && (
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "linear-gradient(to left, #1e3a5f, #2d5a8e)" }}>
                  {["קטגוריה", "% ניכוי מע״מ", "% הוצאה מוכרת", "פטור ממע״מ", "שמירה"].map((h) => (
                    <th key={h} style={{ color: "#fff", fontSize: 12, fontWeight: 600, padding: "12px 16px", textAlign: "right" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vatLoading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 16, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                      טוען...
                    </td>
                  </tr>
                ) : (
                  vatRules.map((rule) => {
                    const isRowDirty = !!dirty[rule.category];
                    const noVat = getVal(rule.category, "no_vat", rule.no_vat);
                    const vatRate = getVal(rule.category, "vat_rate", rule.vat_rate);
                    const taxRate = getVal(rule.category, "tax_rate", rule.tax_rate);
                    return (
                      <tr key={rule.category} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "#1e3a5f", fontSize: 13 }}>
                          {rule.category}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={Math.round(Number(vatRate) * 100)}
                              disabled={!!noVat}
                              onChange={(e) => markDirty(rule.category, "vat_rate", Number(e.target.value) / 100)}
                              style={{ width: 64, textAlign: "center", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", opacity: noVat ? 0.4 : 1, fontFamily: "monospace", direction: "ltr" }}
                            />
                            <span style={{ color: "#64748b" }}>%</span>
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={Math.round(Number(taxRate) * 100)}
                              onChange={(e) => markDirty(rule.category, "tax_rate", Number(e.target.value) / 100)}
                              style={{ width: 64, textAlign: "center", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontFamily: "monospace", direction: "ltr" }}
                            />
                            <span style={{ color: "#64748b" }}>%</span>
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <input
                            type="checkbox"
                            checked={!!noVat}
                            onChange={(e) => {
                              markDirty(rule.category, "no_vat", e.target.checked);
                              if (e.target.checked) markDirty(rule.category, "vat_rate", 0);
                            }}
                            style={{ width: 16, height: 16, cursor: "pointer" }}
                          />
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <button
                            onClick={() => saveRow(rule)}
                            disabled={!isRowDirty || savingRule === rule.category}
                            style={{
                              ...btnPrimary, ...btnSm,
                              background: isRowDirty ? "#1e3a5f" : "#e2e8f0",
                              color: isRowDirty ? "#fff" : "#94a3b8",
                              cursor: isRowDirty ? "pointer" : "default",
                            }}
                          >
                            {savingRule === rule.category ? "..." : "שמור"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );

  const renderDomainsTab = () => (
    <>
      <div style={card}>
        <div style={cardHeader}><Globe size={14} /> דומיינים מוכרים (גלובלי)</div>
        <div style={{ padding: 16 }}>
          <ListManager
            items={parseList("known_domains_global")}
            placeholder="דומיין ידוע (למשל cellcom.co.il)"
            onChange={(arr) => saveList("known_domains_global", arr)}
          />
        </div>
      </div>

      <div style={card}>
        <div style={cardHeader}><Download size={14} /> דומיינים לשליפה אוטומטית (Fetch)</div>
        <div style={{ padding: 16 }}>
          <ListManager
            items={parseList("fetch_domains_global")}
            placeholder="דומיין חדש (למשל grow.business)"
            onChange={(arr) => saveList("fetch_domains_global", arr)}
          />
        </div>
      </div>

      <div style={card}>
        <div style={cardHeader}><FileText size={14} /> פלטפורמות חשבוניות</div>
        <div style={{ padding: 16 }}>
          <ListManager
            items={parseList("invoice_platforms")}
            placeholder="פלטפורמה (למשל morning.co)"
            onChange={(arr) => saveList("invoice_platforms", arr)}
          />
        </div>
      </div>

      <div style={card}>
        <div style={cardHeader}><Tags size={14} /> קטגוריות מערכת</div>
        <div style={{ padding: 16 }}>
          <ListManager
            items={parseList("categories")}
            placeholder="קטגוריה חדשה"
            onChange={(arr) => saveList("categories", arr)}
          />
        </div>
      </div>
    </>
  );

  const renderPromptsTab = () => (
    <div style={card}>
      <div style={cardHeader}>📝 פרומפטים AI</div>
      <div style={{ padding: 16, fontSize: 13, color: "#64748b" }}>
        ניהול פרומפטים יתווסף בקרוב. כרגע הפרומפטים מנוהלים ברמת הקוד ב-process-invoice Edge Function.
      </div>
    </div>
  );

  return (
    <div dir="rtl" style={{ fontFamily: "Heebo, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top: orange refresh button */}
      <button
        onClick={refreshAllClients}
        disabled={refreshing}
        style={{
          width: "100%",
          background: "#e8941a",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "10px 20px",
          fontFamily: "Heebo, sans-serif",
          fontSize: 14,
          fontWeight: 700,
          cursor: refreshing ? "wait" : "pointer",
          boxShadow: "0 2px 6px rgba(232,148,26,.3)",
        }}
      >
        {refreshing ? "..." : "🔄 עדכן הגדרות לכל הלקוחות"}
      </button>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: active ? "#1e3a5f" : "#f8fafc",
                color: active ? "#fff" : "#64748b",
                border: active ? "none" : "1px solid #e2e8f0",
                cursor: "pointer",
                fontFamily: "Heebo, sans-serif",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Card grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {activeTab === "ai" && renderAiTab()}
        {activeTab === "money" && renderMoneyTab()}
        {activeTab === "domains" && renderDomainsTab()}
        {activeTab === "prompts" && renderPromptsTab()}
      </div>
    </div>
  );
}
