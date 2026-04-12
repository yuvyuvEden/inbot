import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot, BookOpen, Percent, Scale, Settings2, Wrench,
  ChevronDown, Plus, X, Pencil, RotateCcw, Save, Trash2,
  Download, Globe, FileText, Brain, UserCheck, Tags, SlidersHorizontal,
  AlertTriangle, RefreshCw,
} from "lucide-react";

/* ── types ─────────────────────────────────────── */
interface AdvancedSettings {
  fetchDomains: string[];
  invoicePlatforms: string[];
  knownDomains: string[];
  ownerAliases: string[];
  customCategories: Array<{ name: string; description: string }>;
  businessNature: string;
  aiTemperature: number;
  allocThresholdBefore: number;
  allocThresholdAfter: number;
  searchDays: number;
  threadLimit: number;
  lookbackRows: number;
  maxDistance: number;
  maxLogoBytes: number;
}

interface TaxRule {
  category: string;
  vatPct: number;
  taxPct: number;
  editing: boolean;
  editVat: number;
  editTax: number;
  isDefaultVat: boolean;
  isDefaultTax: boolean;
}

/* ── Tax rule defaults (Israeli tax law) ── */
const VAT_DEFAULTS: Record<string, number> = {
  "דלק": 67, "תחזוקת רכב": 67, "אגרות כביש": 67, "תקשורת": 67, "מוניות": 67,
  "חניה": 100, "שכירות": 100, "חשמל": 25, "מים": 25, "ניהול ואחזקה": 25,
  "כיבוד למשרד": 0, "ארוחות ומסעדות": 0, "מתנות ורווחה": 0, "תרומות": 0,
  "ביטוח רכב": 0, "ביטוח עסקי": 0, "ביטוח פנסיוני": 0, "ביטוח לאומי": 0,
  "מס הכנסה ומע\"מ": 0, "עמלות בנק": 0, "ריבית ומימון": 0, "תחבורה ציבורית": 0,
  "ארנונה ואגרות": 0,
};
const TAX_DEFAULTS: Record<string, number> = {
  "דלק": 45, "תחזוקת רכב": 45, "ביטוח רכב": 45, "אגרות כביש": 45,
  "מוניות": 45, "תחבורה ציבורית": 45, "חניה": 45,
  "כיבוד למשרד": 80, "ארוחות ומסעדות": 0,
  "שכירות": 25, "חשמל": 25, "מים": 25, "ארנונה ואגרות": 25, "ניהול ואחזקה": 25,
  "תקשורת": 50,
};
const getDefaultVat = (cat: string) => VAT_DEFAULTS[cat] ?? 100;
const getDefaultTax = (cat: string) => TAX_DEFAULTS[cat] ?? 100;

/* ── Tooltip helper ── */
const SubCardTooltip = ({ text }: { text: string }) => (
  <span title={text} style={{ fontSize: 11, opacity: 0.5, cursor: "help", marginRight: 4 }}>
    <i className="fas fa-question-circle" />
  </span>
);

const DEFAULT_SETTINGS: AdvancedSettings = {
  fetchDomains: [],
  invoicePlatforms: [],
  knownDomains: [],
  ownerAliases: [],
  customCategories: [],
  businessNature: "",
  aiTemperature: 0.1,
  allocThresholdBefore: 10000,
  allocThresholdAfter: 5000,
  searchDays: 60,
  threadLimit: 10,
  lookbackRows: 1000,
  maxDistance: 2,
  maxLogoBytes: 25000,
};

/* ── styles ────────────────────────────────────── */
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
const btnSecondary: React.CSSProperties = {
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
  padding: "7px 14px", cursor: "pointer", fontSize: 13, fontFamily: "Heebo, sans-serif",
  display: "inline-flex", alignItems: "center", gap: 6,
};
const btnDanger: React.CSSProperties = {
  background: "#dc2626", color: "#fff", border: "none", borderRadius: 8,
  padding: "5px 10px", cursor: "pointer", fontSize: 12, fontFamily: "Heebo, sans-serif",
  display: "inline-flex", alignItems: "center", gap: 6,
};
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
  borderBottom: "1px solid #f1f5f9", fontSize: 13,
};
const chip: React.CSSProperties = {
  background: "#f0f4f8", border: "1px solid #e2e8f0", borderRadius: 99,
  padding: "3px 6px 3px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4,
};
const scrollList: React.CSSProperties = {
  maxHeight: 140, overflowY: "auto", border: "1px solid #e2e8f0",
  borderRadius: 8, background: "#f8fafc",
};
const subCard: React.CSSProperties = {
  border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden",
};
const subCardHeader: React.CSSProperties = {
  background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "10px 14px",
  fontSize: 12, fontWeight: 700, color: "#1e3a5f", display: "flex", gap: 6, alignItems: "center",
};

/* ── component ─────────────────────────────────── */
export default function SettingsTab() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AdvancedSettings>(DEFAULT_SETTINGS);
  const [vatRate, setVatRate] = useState(1.17);
  const [vatInput, setVatInput] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiInput, setGeminiInput] = useState("");
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [dialectWords, setDialectWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState("");
  const [showAddWord, setShowAddWord] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [catNameInput, setCatNameInput] = useState("");
  const [catDescInput, setCatDescInput] = useState("");

  /* ── helpers ── */
  const asArr = (v: any): string[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") try { return JSON.parse(v); } catch { return []; }
    return [];
  };
  const asCatArr = (v: any): Array<{ name: string; description: string }> => {
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v); } catch { return []; }
  };

  /* ── load ── */
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data: c } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!c) { setIsLoading(false); return; }
      setClientId(c.id);
      setGeminiKey(c.gemini_api_key || "");
      setVatRate((c as any).vat_rate ?? 1.17);
      setDialectWords(asArr((c as any).learned_words));
      setSettings({
        fetchDomains: asArr((c as any).fetch_domains),
        invoicePlatforms: asArr((c as any).invoice_platforms),
        knownDomains: asArr((c as any).known_domains),
        ownerAliases: asArr((c as any).owner_aliases),
        customCategories: asCatArr(c.custom_categories),
        businessNature: c.business_nature || "",
        aiTemperature: (c as any).ai_temperature ?? 0.1,
        allocThresholdBefore: (c as any).alloc_threshold_before ?? 10000,
        allocThresholdAfter: (c as any).alloc_threshold_after ?? 5000,
        searchDays: (c as any).search_days ?? 60,
        threadLimit: (c as any).thread_limit ?? 10,
        lookbackRows: (c as any).lookback_rows ?? 1000,
        maxDistance: (c as any).max_distance ?? 2,
        maxLogoBytes: (c as any).max_logo_bytes ?? 25000,
      });

      // invoice count
      const { count } = await supabase
        .from("invoices").select("id", { count: "exact", head: true })
        .eq("client_id", c.id).eq("is_archived", false);
      setInvoiceCount(count || 0);

      // tax rules
      const storedRules: Array<{ category: string; vatPct: number; taxPct: number }> =
        Array.isArray((c as any).tax_rules) ? (c as any).tax_rules : [];
      const { data: cats } = await supabase
        .from("invoices").select("category").eq("client_id", c.id);
      const uniqueCats = [...new Set((cats || []).map(r => r.category).filter(Boolean))] as string[];
      const rulesMap = new Map(storedRules.map(r => [r.category, r]));
      setTaxRules(uniqueCats.sort().map(cat => {
        const s = rulesMap.get(cat);
        const vatPct = s?.vatPct ?? getDefaultVat(cat);
        const taxPct = s?.taxPct ?? getDefaultTax(cat);
        return {
          category: cat, vatPct, taxPct,
          editing: false, editVat: vatPct, editTax: taxPct,
          isDefaultVat: !s || s.vatPct === getDefaultVat(cat),
          isDefaultTax: !s || s.taxPct === getDefaultTax(cat),
        };
      }));
    } catch (e: any) {
      toast.error("שגיאה בטעינת הגדרות");
    }
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── update helper ── */
  const updateClient = async (payload: Record<string, any>) => {
    if (!clientId) return false;
    const { error } = await supabase.from("clients").update(payload as any).eq("id", clientId);
    if (error) { toast.error("שגיאה בשמירה"); return false; }
    return true;
  };

  /* ── Gemini key ── */
  const saveGeminiKey = async () => {
    if (!geminiInput.startsWith("AIza") || geminiInput.length < 30) {
      toast.warning("מפתח לא תקין — חייב להתחיל ב-AIza ולהיות לפחות 30 תווים");
      return;
    }
    if (await updateClient({ gemini_api_key: geminiInput })) {
      setGeminiKey(geminiInput);
      setGeminiInput("");
      toast.success("מפתח נשמר בהצלחה");
    }
  };

  /* ── VAT rate ── */
  const saveVatRate = async () => {
    const pct = parseFloat(vatInput);
    if (isNaN(pct) || pct < 1 || pct > 99) {
      toast.warning("הזן אחוז תקין (1–99)");
      return;
    }
    const newRate = 1 + pct / 100;
    if (await updateClient({ vat_rate: newRate } as any)) {
      setVatRate(newRate);
      setVatInput("");
      toast.success(`שיעור מע"מ עודכן ל-${pct}%`);
    }
  };

  /* ── Learned words ── */
  const addWord = async () => {
    const w = newWord.trim();
    if (!w) return;
    const next = [...dialectWords, w];
    setDialectWords(next);
    setNewWord("");
    setShowAddWord(false);
    if (await updateClient({ learned_words: next } as any)) toast.success(`"${w}" נוספה`);
  };
  const deleteWord = async (w: string) => {
    const next = dialectWords.filter(x => x !== w);
    setDialectWords(next);
    if (await updateClient({ learned_words: next } as any)) toast.success(`"${w}" נמחקה`);
  };

  /* ── Tax rules ── */
  const saveTaxRule = async (cat: string, vat: number, tax: number) => {
    const updated = taxRules.map(r =>
      r.category === cat ? { ...r, vatPct: vat, taxPct: tax, editing: false, isDefaultVat: vat === getDefaultVat(cat), isDefaultTax: tax === getDefaultTax(cat) } : r
    );
    setTaxRules(updated);
    const stored = updated.filter(r => r.vatPct !== getDefaultVat(r.category) || r.taxPct !== getDefaultTax(r.category))
      .map(r => ({ category: r.category, vatPct: r.vatPct, taxPct: r.taxPct }));
    await updateClient({ tax_rules: stored } as any);
    toast.success("כלל מס עודכן");
  };
  const resetTaxRule = async (cat: string) => {
    const defVat = getDefaultVat(cat);
    const defTax = getDefaultTax(cat);
    const updated = taxRules.map(r =>
      r.category === cat ? { ...r, vatPct: defVat, taxPct: defTax, editing: false, isDefaultVat: true, isDefaultTax: true } : r
    );
    setTaxRules(updated);
    const stored = updated.filter(r => r.vatPct !== getDefaultVat(r.category) || r.taxPct !== getDefaultTax(r.category))
      .map(r => ({ category: r.category, vatPct: r.vatPct, taxPct: r.taxPct }));
    await updateClient({ tax_rules: stored } as any);
    toast.success(`כללי ${cat} אופסו לברירת מחדל`);
  };

  /* ── Advanced list managers ── */
  const addToList = (field: keyof AdvancedSettings, val: string) => {
    const v = val.trim();
    if (!v) return;
    const arr = settings[field] as string[];
    if (arr.includes(v)) { toast.warning("הפריט כבר קיים"); return; }
    setSettings(prev => ({ ...prev, [field]: [...(prev[field] as string[]), v] }));
  };
  const removeFromList = (field: keyof AdvancedSettings, val: string) => {
    setSettings(prev => ({ ...prev, [field]: (prev[field] as string[]).filter(x => x !== val) }));
  };
  const addCustomCategory = () => {
    const name = catNameInput.trim();
    if (!name) return;
    if (settings.customCategories.some(c => c.name === name)) {
      toast.warning("קטגוריה כבר קיימת"); return;
    }
    setSettings(prev => ({
      ...prev,
      customCategories: [...prev.customCategories, { name, description: catDescInput.trim() }],
    }));
    setCatNameInput(""); setCatDescInput("");
  };
  const removeCustomCategory = (name: string) => {
    setSettings(prev => ({
      ...prev,
      customCategories: prev.customCategories.filter(c => c.name !== name),
    }));
  };

  /* ── Save advanced ── */
  const saveAdvancedSettings = async () => {
    setIsSaving(true);
    const ok = await updateClient({
      fetch_domains: settings.fetchDomains,
      invoice_platforms: settings.invoicePlatforms,
      known_domains: settings.knownDomains,
      owner_aliases: settings.ownerAliases,
      custom_categories: settings.customCategories,
      business_nature: settings.businessNature || null,
      ai_temperature: settings.aiTemperature,
      alloc_threshold_before: settings.allocThresholdBefore,
      alloc_threshold_after: settings.allocThresholdAfter,
      search_days: settings.searchDays,
      thread_limit: settings.threadLimit,
      lookback_rows: settings.lookbackRows,
      max_distance: settings.maxDistance,
      max_logo_bytes: settings.maxLogoBytes,
    } as any);
    setIsSaving(false);
    if (ok) {
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 3000);
      toast.success("הגדרות נשמרו בהצלחה");
    }
  };

  /* ── Maintenance ── */
  const confirmClearProcessed = async () => {
    if (!window.confirm("האם אתה בטוח? כל המיילים שנסרקו יעובדו מחדש בסריקה הבאה.")) return;
    if (await updateClient({ processed_ids: [] } as any))
      toast.success("Processed IDs נוקו בהצלחה");
  };
  const reloadAllData = () => { loadData(); toast.info("הנתונים רועננו"); };

  const vatPct = Math.round((vatRate - 1) * 100);

  /* ── List manager sub-component ── */
  const ListManager = ({ field, placeholder }: { field: keyof AdvancedSettings; placeholder: string }) => {
    const [input, setInput] = useState("");
    const items = settings[field] as string[];
    return (
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            style={{ ...inputLtr, flex: 1 }}
            placeholder={placeholder}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { addToList(field, input); setInput(""); } }}
          />
          <button style={{ ...btnPrimary, ...btnSm }} onClick={() => { addToList(field, input); setInput(""); }}>
            <Plus size={14} />
          </button>
        </div>
        <div style={scrollList}>
          {items.length === 0 && <div style={{ padding: 10, fontSize: 12, color: "#64748b" }}>ריק</div>}
          {items.map(v => (
            <div key={v} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 10px", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 12, fontFamily: "monospace", direction: "ltr" }}>{v}</span>
              <button style={btnGhost} onClick={() => removeFromList(field, v)}><X size={12} /></button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, padding: 16 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={card}><div style={{ padding: 16 }}><Skeleton className="h-40 w-full" /></div></div>
        ))}
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ padding: 16, fontFamily: "Heebo, sans-serif" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>

        {/* ── CARD 1: System Status ── */}
        <div style={card}>
          <div style={cardHeader}><Bot size={16} /> מצב מערכת</div>
          <div style={{ padding: 16 }}>
            <div style={statRow}><span style={{ color: "#64748b" }}>גרסה</span><span>v3.0</span></div>
            <div style={statRow}>
              <span style={{ color: "#64748b" }}>Gemini מפתח</span>
              <span style={{ color: geminiKey ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                {geminiKey ? "מוגדר ✓" : "לא מוגדר"}
              </span>
            </div>
            <div style={statRow}><span style={{ color: "#64748b" }}>חשבוניות</span><span>{invoiceCount.toLocaleString("he-IL")}</span></div>
            <div style={{ ...statRow, borderBottom: "none" }}>
              <span style={{ color: "#64748b" }}>מע"מ נוכחי</span><span>{vatPct}%</span>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>מפתח Gemini API</label>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>מפתח מתחיל ב-AIza... — נשמר מוצפן</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="password"
                  style={{ ...inputLtr, flex: 1 }}
                  value={geminiInput}
                  onChange={e => setGeminiInput(e.target.value)}
                  placeholder="AIza..."
                />
                <button
                  style={{ ...btnPrimary, ...btnSm, opacity: geminiInput.length < 10 ? 0.5 : 1 }}
                  disabled={geminiInput.length < 10}
                  onClick={saveGeminiKey}
                >שמור מפתח</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── CARD 2: Learned Dictionary ── */}
        <div style={card}>
          <div style={{ ...cardHeader, justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Brain size={16} /> מילון לומד</div>
            <button style={{ ...btnSecondary, ...btnSm }} onClick={() => setShowAddWord(!showAddWord)}>
              <Plus size={14} /> הוסף
            </button>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
              מילות מפתח שנלמדו מחשבוניות — משפרות את איתור המיילים ע"י Gmail Scanner.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {dialectWords.length === 0 && <span style={{ fontSize: 12, color: "#64748b" }}>אין מילים עדיין</span>}
              {dialectWords.map(w => (
                <span key={w} style={chip}>
                  {w}
                  <button style={{ ...btnGhost, padding: 0 }} onClick={() => deleteWord(w)}><X size={12} /></button>
                </span>
              ))}
            </div>
            {showAddWord && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input
                  style={{ ...inputBase, flex: 1 }}
                  value={newWord}
                  onChange={e => setNewWord(e.target.value)}
                  placeholder="מילה חדשה..."
                  onKeyDown={e => e.key === "Enter" && addWord()}
                />
                <button style={{ ...btnPrimary, ...btnSm }} onClick={addWord}>הוסף</button>
                <button style={{ ...btnGhost, ...btnSm }} onClick={() => setShowAddWord(false)}>ביטול</button>
              </div>
            )}
          </div>
        </div>

        {/* ── CARD 3: VAT Rate ── */}
        <div style={card}>
          <div style={cardHeader}><Percent size={16} /> הגדרת מע"מ</div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 13 }}>שיעור נוכחי:</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f" }}>{vatPct}%</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                {vatRate !== 1.17 ? "(מותאם אישית)" : "(ברירת מחדל)"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>שיעור חדש (%)</label>
                <input
                  type="number"
                  style={{ ...inputLtr, width: 100 }}
                  value={vatInput}
                  onChange={e => setVatInput(e.target.value)}
                  min={1} max={99} step={1} placeholder="למשל: 17"
                />
              </div>
              <button
                style={{ ...btnPrimary, ...btnSm, opacity: !vatInput ? 0.5 : 1 }}
                disabled={!vatInput}
                onClick={saveVatRate}
              ><Save size={14} /> עדכן</button>
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>שינוי ישפיע על חשבוניות חדשות בלבד מרגע העדכון.</div>
          </div>
        </div>

        {/* ── CARD 4: Tax Rules — full width ── */}
        <div style={{ ...card, gridColumn: "1 / -1" }}>
          <div style={{ ...cardHeader, justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Scale size={16} /> כללי מע"מ והוצאה מוכרת</div>
            <button style={{ ...btnSecondary, ...btnSm }} onClick={loadData}>
              <RefreshCw size={14} /> רענן
            </button>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              עריכת אחוזי הכרה לפי קטגוריה. שינויים ישפיעו על חשבוניות חדשות בלבד.
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["קטגוריה", "מע\"מ מוכר %", "הוצאה מוכרת %", "פעולות"].map(h => (
                    <th key={h} style={{ padding: 8, fontSize: 11, textTransform: "uppercase", letterSpacing: ".4px", color: "#64748b", fontWeight: 600, textAlign: h === "קטגוריה" ? "right" : "center" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {taxRules.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#64748b" }}>אין קטגוריות</td></tr>
                )}
                {taxRules.map(rule => (
                  <tr key={rule.category} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 8, fontWeight: 600 }}>{rule.category}</td>
                    {rule.editing ? (
                      <>
                        <td style={{ textAlign: "center", padding: 8 }}>
                          <input type="number" style={{ ...inputLtr, width: 64, textAlign: "center" }}
                            value={rule.editVat} min={0} max={100} step={1}
                            onChange={e => setTaxRules(prev => prev.map(r => r.category === rule.category ? { ...r, editVat: +e.target.value } : r))}
                          />
                        </td>
                        <td style={{ textAlign: "center", padding: 8 }}>
                          <input type="number" style={{ ...inputLtr, width: 64, textAlign: "center" }}
                            value={rule.editTax} min={0} max={100} step={1}
                            onChange={e => setTaxRules(prev => prev.map(r => r.category === rule.category ? { ...r, editTax: +e.target.value } : r))}
                          />
                        </td>
                        <td style={{ textAlign: "center", padding: 8, display: "flex", gap: 4, justifyContent: "center" }}>
                          <button style={btnGhost} onClick={() => saveTaxRule(rule.category, rule.editVat, rule.editTax)}><Save size={14} style={{ color: "#1e3a5f" }} /></button>
                          <button style={btnGhost} onClick={() => setTaxRules(prev => prev.map(r => r.category === rule.category ? { ...r, editing: false } : r))}><X size={14} /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ textAlign: "center", padding: 8, fontFamily: "monospace", color: rule.isDefaultVat ? "#64748b" : "#1e3a5f", fontWeight: rule.isDefaultVat ? 400 : 600 }}>{rule.vatPct}%</td>
                        <td style={{ textAlign: "center", padding: 8, fontFamily: "monospace", color: rule.isDefaultTax ? "#64748b" : "#1e3a5f", fontWeight: rule.isDefaultTax ? 400 : 600 }}>{rule.taxPct}%</td>
                        <td style={{ textAlign: "center", padding: 8, display: "flex", gap: 4, justifyContent: "center" }}>
                          <button style={btnGhost} onClick={() => setTaxRules(prev => prev.map(r => r.category === rule.category ? { ...r, editing: true, editVat: r.vatPct, editTax: r.taxPct } : r))}><Pencil size={14} /></button>
                          {(rule.vatPct !== getDefaultVat(rule.category) || rule.taxPct !== getDefaultTax(rule.category)) && (
                            <button style={{ ...btnGhost, color: "#e8941a" }} onClick={() => resetTaxRule(rule.category)}><RotateCcw size={14} /></button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── CARD 5: Advanced Settings — full width ── */}
        <div style={{ ...card, gridColumn: "1 / -1" }}>
          <div style={{ ...cardHeader, justifyContent: "space-between", cursor: "pointer" }} onClick={() => setShowAdvanced(!showAdvanced)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Settings2 size={16} /> הגדרות מתקדמות</div>
            <ChevronDown size={16} style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
          </div>
          {showAdvanced && (
            <div style={{ padding: 16 }}>
              <div style={{
                display: "inline-flex", gap: 5, fontSize: 11, color: "#b45309",
                background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 99,
                padding: "2px 10px", marginBottom: 12, alignItems: "center",
              }}>
                <AlertTriangle size={12} /> שנה רק אם יש סיבה
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>

                {/* Fetch Domains */}
                <div style={subCard}>
                  <div style={subCardHeader}><Download size={14} /> משיכה אוטומטית (Fetch) <SubCardTooltip text={"דומיינים שהמערכת תנסה להוריד מהם PDF אוטומטית מתוך הלינק שבמייל.\nאם ספק לא מופיע כאן — תקבל התראה ידנית במקום הורדה אוטומטית."} /></div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>דומיינים שהמערכת תנסה להוריד מהם PDF אוטומטית.</div>
                    <ListManager field="fetchDomains" placeholder="דומיין חדש (למשל grow.business)" />
                  </div>
                </div>

                {/* Invoice Platforms */}
                <div style={subCard}>
                  <div style={subCardHeader}><FileText size={14} /> פלטפורמות חשבוניות <SubCardTooltip text={"חברות שמנפיקות חשבוניות בשם הספק (כמו morning, iCount, חשבונית ירוקה).\nה-AI יודע שהן רק צינור — ולא ירשום אותן כספק."} /></div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>חברות שמנפיקות חשבוניות בשם הספק — ה-AI לא ירשום אותן כספק.</div>
                    <ListManager field="invoicePlatforms" placeholder="דומיין פלטפורמה (למשל morning.co)" />
                  </div>
                </div>

                {/* Known Domains */}
                <div style={subCard}>
                  <div style={subCardHeader}><Globe size={14} /> דומיינים לסריקת Gmail</div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>דומיינים שנכנסים לשאילתת הסריקה של Gmail.</div>
                    <ListManager field="knownDomains" placeholder="דומיין ידוע (למשל cellcom.co.il)" />
                  </div>
                </div>

                {/* AI Tuning */}
                <div style={subCard}>
                  <div style={subCardHeader}><Brain size={14} /> כוונון AI</div>
                  <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 11, color: "#64748b" }}>הקשר עסקי שמועבר ל-Gemini לפני כל ניתוח.</div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>אופי העסק</label>
                      <input style={inputBase} value={settings.businessNature}
                        onChange={e => setSettings(p => ({ ...p, businessNature: e.target.value }))}
                        placeholder='למשל: "חברת פיתוח תוכנה וייעוץ"' />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>טמפרטורת AI</label>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>0 = קפדני, 0.5 = יצירתי. ברירת מחדל: 0.1</div>
                      <input type="number" style={inputLtr} value={settings.aiTemperature}
                        min={0} max={0.5} step={0.05}
                        onChange={e => setSettings(p => ({ ...p, aiTemperature: +e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Owner Aliases */}
                <div style={subCard}>
                  <div style={subCardHeader}><UserCheck size={14} /> כינויי בעלים</div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>שמות נוספים שלך שעשויים להופיע בשדה "לכבוד".</div>
                    <ListManager field="ownerAliases" placeholder="שם נוסף (עברית או אנגלית)" />
                  </div>
                </div>

                {/* Custom Categories */}
                <div style={subCard}>
                  <div style={subCardHeader}><Tags size={14} /> קטגוריות מותאמות</div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>הוסף שם קטגוריה והסבר — ה-AI ישתמש בהסבר לסיווג.</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                      <input style={inputBase} placeholder="שם קטגוריה (למשל: ציוד צילום)"
                        value={catNameInput} onChange={e => setCatNameInput(e.target.value)} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <input style={{ ...inputBase, flex: 1 }} placeholder="תיאור (למשל: מצלמות, עדשות, תאורה)"
                          value={catDescInput} onChange={e => setCatDescInput(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && addCustomCategory()} />
                        <button style={{ ...btnPrimary, ...btnSm }} onClick={addCustomCategory}><Plus size={14} /></button>
                      </div>
                    </div>
                    <div style={scrollList}>
                      {settings.customCategories.length === 0 && <div style={{ padding: 10, fontSize: 12, color: "#64748b" }}>ריק</div>}
                      {settings.customCategories.map(c => (
                        <div key={c.name} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "7px 10px", borderBottom: "1px solid #f1f5f9" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</span>
                            <button style={btnGhost} onClick={() => removeCustomCategory(c.name)}><X size={12} /></button>
                          </div>
                          {c.description && <span style={{ fontSize: 11, color: "#64748b" }}>{c.description}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Allocation Threshold */}
                <div style={subCard}>
                  <div style={subCardHeader}><Scale size={14} /> סף מספר הקצאה</div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>סכום מינימום שמעליו נדרש מספר הקצאה בחשבונית מס.</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>לפני יוני 2026</label>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>ברירת מחדל: ₪10,000</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 12 }}>₪</span>
                          <input type="number" style={inputLtr} value={settings.allocThresholdBefore}
                            min={0} max={999999} step={1}
                            onChange={e => setSettings(p => ({ ...p, allocThresholdBefore: +e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>מיוני 2026 ואילך</label>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>ברירת מחדל: ₪5,000</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 12 }}>₪</span>
                          <input type="number" style={inputLtr} value={settings.allocThresholdAfter}
                            min={0} max={999999} step={1}
                            onChange={e => setSettings(p => ({ ...p, allocThresholdAfter: +e.target.value }))} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Advanced Tuning */}
                <div style={subCard}>
                  <div style={subCardHeader}><SlidersHorizontal size={14} /> כוונון מתקדם</div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>פרמטרים טכניים של הסריקה — שנה רק אם יש סיבה ספציפית.</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {[
                        { label: "ימי סריקה אחורה", key: "searchDays" as const, def: 60, min: 7, max: 365, step: 1 },
                        { label: "Threads לשאילתה", key: "threadLimit" as const, def: 10, min: 1, max: 50, step: 1 },
                        { label: "שורות בדיקת כפילות", key: "lookbackRows" as const, def: 1000, min: 50, max: 5000, step: 50 },
                        { label: "Levenshtein (שמות)", key: "maxDistance" as const, def: 2, min: 0, max: 5, step: 1 },
                      ].map(f => (
                        <div key={f.key}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>{f.label}</label>
                          <div style={{ fontSize: 10, color: "#94a3b8" }}>ברירת מחדל: {f.def}</div>
                          <input type="number" style={inputLtr}
                            value={settings[f.key]} min={f.min} max={f.max} step={f.step}
                            onChange={e => setSettings(p => ({ ...p, [f.key]: +e.target.value }))} />
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>גודל לוגו מסונן (bytes)</label>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>ברירת מחדל: 25,000</div>
                      <input type="number" style={inputLtr}
                        value={settings.maxLogoBytes} min={1000} max={200000} step={1000}
                        onChange={e => setSettings(p => ({ ...p, maxLogoBytes: +e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Save row */}
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12, marginTop: 12, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                {savedNote && <span style={{ fontSize: 12, color: "#16a34a" }}>✓ נשמר בהצלחה</span>}
                <button style={{ ...btnSecondary, ...btnSm }} onClick={loadData}><RotateCcw size={14} /> בטל שינויים</button>
                <button style={{ ...btnPrimary, opacity: isSaving ? 0.5 : 1 }} disabled={isSaving} onClick={saveAdvancedSettings}>
                  <Save size={16} /> שמור הגדרות
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── CARD 6: Maintenance ── */}
        <div style={card}>
          <div style={cardHeader}><Wrench size={16} /> פעולות תחזוקה</div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>ניקוי Processed IDs</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>מאפשר עיבוד מחדש של מיילים ישנים ע"י Gmail Scanner</div>
              </div>
              <button style={btnDanger} onClick={confirmClearProcessed}><Trash2 size={14} /> נקה</button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>רענן נתונים</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>טעינה מחדש של כל הנתונים</div>
              </div>
              <button style={{ ...btnSecondary, ...btnSm }} onClick={reloadAllData}><RefreshCw size={14} /> רענן</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
