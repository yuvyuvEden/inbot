import { useVatRules, useUpdateVatRule, type VatRule } from "@/hooks/useVatRules";
import { useSystemSettings, useUpdateSystemSetting } from "@/hooks/useSystemSettings";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminSystemTab() {
  const { data: vatRules = [], isLoading } = useVatRules();
  const { mutateAsync: updateRule } = useUpdateVatRule();
  const [dirty, setDirty] = useState<Record<string, Partial<VatRule>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const { data: settings = [], isLoading: settingsLoading } = useSystemSettings();
  const { mutateAsync: updateSetting } = useUpdateSystemSetting();
  const [settingsDirty, setSettingsDirty] = useState<Record<string, string>>({});
  const [savingSetting, setSavingSetting] = useState<string | null>(null);

  const getSettingVal = (key: string, fallback: string) =>
    settingsDirty[key] !== undefined ? settingsDirty[key] : fallback;

  const saveSetting = async (key: string, value: string) => {
    setSavingSetting(key);
    try {
      await updateSetting({ key, value });
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

  if (isLoading) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontFamily: "Heebo, sans-serif" }}>
        טוען...
      </div>
    );
  }

  return (
    <div className="space-y-4" style={{ fontFamily: "Heebo, sans-serif" }} dir="rtl">
      <div>
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#1e3a5f", margin: 0 }}>
          כללי מע״מ גלובליים
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
          שינויים כאן ישפיעו על חישובי המע״מ לכלל הלקוחות. לקוח יכול לבטל עם override אישי.
        </p>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
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
            {vatRules.map((rule) => {
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
                        transition: "all 0.15s",
                        fontFamily: "Heebo, sans-serif",
                      }}
                    >
                      {saving === rule.category ? "..." : "שמור"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
