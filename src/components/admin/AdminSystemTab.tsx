import { useVatRules, useUpdateVatRule, type VatRule } from "@/hooks/useVatRules";
import { useSystemSettings, useUpdateSystemSetting } from "@/hooks/useSystemSettings";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type TabKey = "ai" | "money" | "domains" | "prompts";

interface FieldDef {
  key: string;
  label: string;
  description?: string;
  type: "text" | "number" | "textarea";
}

const TAB_AI_FIELDS: FieldDef[] = [
  { key: "ai_temperature", label: "טמפרטורת AI", description: "0 = יציב, 0.5 = יצירתי. ברירת מחדל: 0.1", type: "number" },
  { key: "gmail_search_days", label: "ימי סריקה לאחור", description: "כמה ימים אחורה לסרוק Gmail. ברירת מחדל: 60", type: "number" },
  { key: "gmail_base_terms", label: "מילות חיפוש Gmail", description: "ביטויים לזיהוי מיילים פיננסיים", type: "textarea" },
  { key: "gmail_attach_condition", label: "תנאי קבצים מצורפים", type: "textarea" },
  { key: "notification_only_phrases", label: "ביטויי התראה בלבד", description: "מיילים עם ביטויים אלו יסוננו", type: "textarea" },
  { key: "food_vendors_regex", label: "Regex ספקי מזון", type: "textarea" },
  { key: "vendor_strip_suffixes", label: "סיומות לגזירה משם ספק", type: "textarea" },
];

const TAB_MONEY_FIELDS: FieldDef[] = [
  { key: "vat_rate_percent", label: "שיעור מע״מ (%)", type: "number" },
  { key: "allocation_threshold_before", label: "סף הקצאה לפני יוני 2026 (₪)", type: "number" },
  { key: "allocation_threshold_after", label: "סף הקצאה מיוני 2026 ואילך (₪)", type: "number" },
  { key: "invoice_processing_days", label: "ימי עיבוד חשבונית", type: "number" },
  { key: "currency", label: "מטבע ברירת מחדל", type: "text" },
  { key: "duplicate_lookback_rows", label: "שורות בדיקת כפילות", type: "number" },
];

const TAB_DOMAINS_FIELDS: FieldDef[] = [
  { key: "known_domains_global", label: "דומיינים מוכרים (גלובלי)", type: "textarea" },
  { key: "fetch_domains_global", label: "דומיינים לשליפה אוטומטית (Fetch)", type: "textarea" },
  { key: "invoice_platforms", label: "פלטפורמות חשבוניות", type: "textarea" },
  { key: "categories", label: "קטגוריות מערכת", description: "JSON array", type: "textarea" },
];

export default function AdminSystemTab() {
  const [activeTab, setActiveTab] = useState<TabKey>("ai");
  const [vatExpanded, setVatExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: settings = [], isLoading: settingsLoading } = useSystemSettings();
  const { mutateAsync: updateSetting } = useUpdateSystemSetting();
  const [settingsDirty, setSettingsDirty] = useState<Record<string, string>>({});
  const [savingSetting, setSavingSetting] = useState<string | null>(null);

  const { data: vatRules = [], isLoading: vatLoading } = useVatRules();
  const { mutateAsync: updateRule } = useUpdateVatRule();
  const [dirty, setDirty] = useState<Record<string, Partial<VatRule>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const getSettingValue = (key: string): string => {
    if (settingsDirty[key] !== undefined) return settingsDirty[key];
    const found = settings.find((s) => s.key === key);
    return found?.value ?? "";
  };

  const isSettingDirty = (key: string) => settingsDirty[key] !== undefined;

  const saveSetting = async (key: string) => {
    setSavingSetting(key);
    try {
      await updateSetting({ key, value: getSettingValue(key) });
      setSettingsDirty((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
      toast.success("ההגדרה עודכנה");
    } catch {
      toast.error("שגיאה בשמירה");
    } finally {
      setSavingSetting(null);
    }
  };

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

  const getVal = (cat: string, field: keyof VatRule, fallback: any) =>
    dirty[cat]?.[field] !== undefined ? (dirty[cat] as any)[field] : fallback;

  const markDirty = (cat: string, field: keyof VatRule, value: any) =>
    setDirty((prev) => ({ ...prev, [cat]: { ...prev[cat], [field]: value } }));

  const saveRow = async (rule: VatRule) => {
    const merged = { ...rule, ...dirty[rule.category] };
    setSaving(rule.category);
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
      setSaving(null);
    }
  };

  const renderField = (f: FieldDef) => {
    const value = getSettingValue(f.key);
    const dirtyFlag = isSettingDirty(f.key);
    const inputStyle: React.CSSProperties = {
      width: "100%",
      border: "1px solid #e2e8f0",
      borderRadius: "6px",
      padding: "8px 12px",
      fontFamily: f.type === "textarea" ? "monospace" : "Heebo, sans-serif",
      direction: f.type === "textarea" ? "ltr" : "rtl",
      fontSize: "13px",
      boxSizing: "border-box",
    };

    return (
      <div
        key={f.key}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "12px",
          alignItems: "start",
          padding: "16px",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: "#1e3a5f", fontSize: "14px", marginBottom: "2px" }}>
            {f.label}
          </div>
          {f.description && (
            <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "8px" }}>
              {f.description}
            </div>
          )}
          {f.type === "textarea" ? (
            <textarea
              value={value}
              onChange={(e) => setSettingsDirty((p) => ({ ...p, [f.key]: e.target.value }))}
              style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
            />
          ) : (
            <input
              type={f.type}
              value={value}
              onChange={(e) => setSettingsDirty((p) => ({ ...p, [f.key]: e.target.value }))}
              style={inputStyle}
            />
          )}
        </div>
        <button
          onClick={() => saveSetting(f.key)}
          disabled={!dirtyFlag || savingSetting === f.key}
          style={{
            padding: "6px 16px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            backgroundColor: dirtyFlag ? "#1e3a5f" : "#e2e8f0",
            color: dirtyFlag ? "#fff" : "#94a3b8",
            border: "none",
            cursor: dirtyFlag ? "pointer" : "default",
            fontFamily: "Heebo, sans-serif",
            alignSelf: "start",
            marginTop: f.description ? "26px" : "20px",
            whiteSpace: "nowrap",
          }}
        >
          {savingSetting === f.key ? "..." : "שמור"}
        </button>
      </div>
    );
  };

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "ai", label: "🤖 AI וסריקה" },
    { key: "money", label: "💰 כספים ומע״מ" },
    { key: "domains", label: "📋 דומיינים וקטגוריות" },
    { key: "prompts", label: "📝 פרומפטים AI" },
  ];

  const renderFieldList = (fields: FieldDef[]) => {
    if (settingsLoading) {
      return <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>טוען...</div>;
    }
    return <div>{fields.map(renderField)}</div>;
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "Heebo, sans-serif" }} dir="rtl">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#1e3a5f", margin: 0 }}>
            הגדרות מערכת
          </h2>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
            הגדרות גלובליות המשפיעות על כל המערכת.
          </p>
        </div>
        <button
          onClick={refreshAllClients}
          disabled={refreshing}
          style={{
            padding: "10px 18px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 700,
            backgroundColor: "#e8941a",
            color: "#fff",
            border: "none",
            cursor: refreshing ? "wait" : "pointer",
            fontFamily: "Heebo, sans-serif",
            boxShadow: "0 2px 6px rgba(232,148,26,0.3)",
          }}
        >
          {refreshing ? "..." : "🔄 עדכן הגדרות לכל הלקוחות"}
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {tabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                backgroundColor: active ? "#1e3a5f" : "#f8fafc",
                color: active ? "#fff" : "#64748b",
                border: active ? "none" : "1px solid #e2e8f0",
                cursor: "pointer",
                fontFamily: "Heebo, sans-serif",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === "ai" && <div style={cardStyle}>{renderFieldList(TAB_AI_FIELDS)}</div>}

      {activeTab === "money" && (
        <>
          <div style={cardStyle}>{renderFieldList(TAB_MONEY_FIELDS)}</div>

          <div style={cardStyle}>
            <button
              onClick={() => setVatExpanded((v) => !v)}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 700,
                color: "#1e3a5f",
                fontFamily: "Heebo, sans-serif",
                textAlign: "right",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>כללי מע״מ לפי קטגוריה</span>
              <span>{vatExpanded ? "▲" : "▼"}</span>
            </button>
            {vatExpanded && (
              <div style={{ borderTop: "1px solid #f1f5f9" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "linear-gradient(to left, #1e3a5f, #2d5a8e)" }}>
                      {["קטגוריה", "% ניכוי מע״מ", "% הוצאה מוכרת", "פטור ממע״מ", "שמירה"].map((h) => (
                        <th
                          key={h}
                          style={{
                            color: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 600,
                            padding: "12px 16px",
                            textAlign: "right",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vatLoading ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "16px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
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
                            <td style={{ padding: "12px 16px", fontWeight: 600, color: "#1e3a5f", fontSize: "13px" }}>
                              {rule.category}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={Math.round(Number(vatRate) * 100)}
                                  disabled={!!noVat}
                                  onChange={(e) =>
                                    markDirty(rule.category, "vat_rate", Number(e.target.value) / 100)
                                  }
                                  style={{
                                    width: "64px",
                                    textAlign: "center",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "6px",
                                    padding: "4px 8px",
                                    opacity: noVat ? 0.4 : 1,
                                    fontFamily: "monospace",
                                    direction: "ltr",
                                  }}
                                />
                                <span style={{ color: "#64748b" }}>%</span>
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={Math.round(Number(taxRate) * 100)}
                                  onChange={(e) =>
                                    markDirty(rule.category, "tax_rate", Number(e.target.value) / 100)
                                  }
                                  style={{
                                    width: "64px",
                                    textAlign: "center",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "6px",
                                    padding: "4px 8px",
                                    fontFamily: "monospace",
                                    direction: "ltr",
                                  }}
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
                                style={{ width: "16px", height: "16px", cursor: "pointer" }}
                              />
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <button
                                onClick={() => saveRow(rule)}
                                disabled={!isRowDirty || saving === rule.category}
                                style={{
                                  padding: "5px 14px",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  backgroundColor: isRowDirty ? "#1e3a5f" : "#e2e8f0",
                                  color: isRowDirty ? "#fff" : "#94a3b8",
                                  border: "none",
                                  cursor: isRowDirty ? "pointer" : "default",
                                  fontFamily: "Heebo, sans-serif",
                                }}
                              >
                                {saving === rule.category ? "..." : "שמור"}
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
      )}

      {activeTab === "domains" && <div style={cardStyle}>{renderFieldList(TAB_DOMAINS_FIELDS)}</div>}

      {activeTab === "prompts" && (
        <div style={{ ...cardStyle, padding: "32px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#1e3a5f", margin: 0 }}>
            פרומפטים AI
          </h3>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "8px" }}>
            ניהול פרומפטים יתווסף בקרוב. הפרומפטים מנוהלים ברמת הקוד.
          </p>
        </div>
      )}
    </div>
  );
}
