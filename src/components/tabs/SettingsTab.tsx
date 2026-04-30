import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot, BookOpen, Percent, Scale, Settings2, Wrench,
  ChevronDown, Plus, X, Pencil, RotateCcw, Save, Trash2,
  Download, Globe, FileText, Brain, UserCheck, Tags, SlidersHorizontal, HelpCircle,
  AlertTriangle, RefreshCw, Users,
} from "lucide-react";
import { useVatRules } from "@/hooks/useVatRules";
import { useSystemSettings } from "@/hooks/useSystemSettings";

/* ── types ─────────────────────────────────────── */
interface AdvancedSettings {
  fetchDomains: string[];
  invoicePlatforms: string[];
  knownDomains: string[];
  ownerAliases: string[];
  customCategories: Array<{ name: string; description: string }>;
  businessNature: string;
  aiTemperature: number;
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

/* ── Tax rule defaults — נטענים מטבלת vat_rules הגלובלית ── */

/* ── Tooltip helper ── */
const SubCardTooltip = ({ text }: { text: string }) => (
  <span title={text} style={{ cursor: "help", opacity: 0.45, marginRight: 4, display: "inline-flex", alignItems: "center" }}>
    <HelpCircle size={13} />
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
export default function SettingsTab({ adminClientId }: { adminClientId?: string }) {
  const { user } = useAuth();
  const { data: vatRules = [] } = useVatRules();
  const getDefaultVat = (cat: string) => {
    const rule = vatRules.find(r => r.category === cat);
    return rule ? Math.round(rule.vat_rate * 100) : 100;
  };
  const getDefaultTax = (cat: string) => {
    const rule = vatRules.find(r => r.category === cat);
    return rule ? Math.round(rule.tax_rate * 100) : 100;
  };
  const [clientId, setClientId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AdvancedSettings>(DEFAULT_SETTINGS);
  const { data: systemSettings = [] } = useSystemSettings();
  const globalVatPct = Number(systemSettings.find(s => s.key === "vat_rate_percent")?.value ?? 18);
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
  const [natureInput, setNatureInput] = useState("");
  const [natureSaved, setNatureSaved] = useState(false);
  const [natureEditing, setNatureEditing] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [showCatAdd, setShowCatAdd] = useState(false);
  // Telegram connect state
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [connectCode, setConnectCode] = useState<string | null>(null);
  const [connectCodeExpiry, setConnectCodeExpiry] = useState<Date | null>(null);
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollIntervalRef, setPollIntervalRef] = useState<ReturnType<typeof setInterval> | null>(null);
  const [isDownloadingConnector, setIsDownloadingConnector] = useState(false);
  // Client users (multi-user account)
  const [clientUsers, setClientUsers] = useState<Array<{ id: string; user_id: string; role: string; created_at: string; profiles?: { full_name: string | null; email?: string | null } }>>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<Date | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [invitePollRef, setInvitePollRef] = useState<ReturnType<typeof setInterval> | null>(null);
  const [clientPhone, setClientPhone] = useState<string | null>(null);

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
      const baseQuery = supabase.from("clients").select("*");
      const { data: c } = await (adminClientId
        ? baseQuery.eq("id", adminClientId)
        : baseQuery.eq("user_id", user.id)
      ).maybeSingle();
      if (!c) { setIsLoading(false); return; }
      setClientId(c.id);

      // טען טלפון מ-profiles
      if (c.user_id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("phone")
          .eq("user_id", c.user_id)
          .maybeSingle();
        setClientPhone((profileData as any)?.phone ?? null);
      }

      // טען משתמשי החשבון
      const { data: cuData } = await supabase
        .from("client_users")
        .select("id, user_id, role, created_at")
        .eq("client_id", c.id)
        .order("created_at");
      if (cuData) {
        const userIds = cuData.map(cu => cu.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        const profileMap = new Map((profilesData ?? []).map(p => [p.user_id, p]));
        setClientUsers(cuData.map(cu => ({ ...cu, profiles: profileMap.get(cu.user_id) })));
      }
      setTelegramChatId((c as any).telegram_chat_id ?? null);
      setGeminiKey(c.gemini_api_key || "");
      setDialectWords(asArr((c as any).learned_words));
      setSettings({
        fetchDomains: asArr((c as any).fetch_domains),
        invoicePlatforms: asArr((c as any).invoice_platforms),
        knownDomains: asArr((c as any).known_domains),
        ownerAliases: asArr((c as any).owner_aliases),
        customCategories: asCatArr(c.custom_categories),
        businessNature: c.business_nature || "",
        aiTemperature: (c as any).ai_temperature ?? 0.1,
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
      const STANDARD_CATEGORIES = [
        "תקשורת","דלק","ציוד משרדי","מחשוב ותוכנה","שירותי ענן","מינויים (SaaS)",
        "שכירות","חשמל","מים","ניהול ואחזקה","ביטוח עסקי","ביטוח פנסיוני",
        "ביטוח לאומי","ביטוח רכב","תחזוקת רכב","מוניות","תחבורה ציבורית",
        "חניה","אגרות כביש","ארוחות ומסעדות","כיבוד למשרד","פרסום ושיווק",
        "שירותי תוכן","כנסים ואירועים","הכשרה והשתלמויות","ייעוץ משפטי",
        "שירותי הנהלת חשבונות","עמלות בנק","ריבית ומימון","עמלות סליקה",
        "מתנות ורווחה","תרומות","ארנונה ואגרות","מס הכנסה ומע\"מ","אחר"
      ];
      const { data: cats } = await supabase
        .from("invoices").select("category").eq("client_id", c.id);
      const invoiceCats = (cats || []).map(r => r.category).filter(Boolean) as string[];
      const uniqueCats = [...new Set([...STANDARD_CATEGORIES, ...invoiceCats])];
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
  }, [user?.id, vatRules]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    return () => { if (pollIntervalRef) clearInterval(pollIntervalRef); };
  }, [pollIntervalRef]);

  useEffect(() => {
    return () => { if (invitePollRef) clearInterval(invitePollRef); };
  }, [invitePollRef]);

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

  const generateConnectCode = async () => {
    setBotUrl(null);
    setIsGeneratingCode(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("לא מחובר"); return; }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-connect-code`,
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await res.json();
      if (!res.ok) { toast.error("שגיאה ביצירת קוד"); return; }
      setConnectCode(data.code);
      setConnectCodeExpiry(new Date(data.expires_at));
      if (data.bot_url) setBotUrl(data.bot_url);
      setIsPolling(true);
      const interval = setInterval(async () => {
        if (!clientId) return;
        const { data: row } = await supabase
          .from("clients")
          .select("telegram_chat_id")
          .eq("id", clientId)
          .maybeSingle();
        if ((row as any)?.telegram_chat_id) {
          setTelegramChatId((row as any).telegram_chat_id);
          setConnectCode(null);
          setConnectCodeExpiry(null);
          setIsPolling(false);
          clearInterval(interval);
          toast.success("✅ Telegram חובר בהצלחה!");
        }
      }, 3000);
      setPollIntervalRef(interval);
      setTimeout(() => {
        clearInterval(interval);
        setIsPolling(false);
        setConnectCode(null);
        setConnectCodeExpiry(null);
      }, 15 * 60 * 1000);
    } catch {
      toast.error("שגיאה בתקשורת עם השרת");
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const disconnectTelegram = async () => {
    if (!clientId) return;
    if (!window.confirm("האם לנתק את חיבור Telegram?")) return;
    const { error } = await supabase
      .from("clients")
      .update({ telegram_chat_id: null } as any)
      .eq("id", clientId);
    if (error) { toast.error("שגיאה בניתוק"); return; }
    setTelegramChatId(null);
    if (pollIntervalRef) clearInterval(pollIntervalRef);
    toast.success("Telegram נותק");
  };

  const downloadConnector = async () => {
    setIsDownloadingConnector(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("לא מחובר"); return; }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-connector`,
        { method: "GET", headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (!res.ok) { toast.error("שגיאה בהורדת ה-Connector"); return; }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "INBOT_Connector.gs";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("✅ Connector הורד בהצלחה");
    } catch {
      toast.error("שגיאה בהורדה");
    } finally {
      setIsDownloadingConnector(false);
    }
  };

  const isReadOnly = !!adminClientId;

  const generateInviteCode = async () => {
    if (!clientId) return;
    setIsGeneratingInvite(true);
    try {
      const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const { error } = await supabase
        .from("clients")
        .update({ invite_code: code, invite_code_expires_at: expiresAt.toISOString() })
        .eq("id", clientId);
      if (error) { toast.error("שגיאה ביצירת קוד"); return; }
      setInviteCode(code);
      setInviteExpiry(expiresAt);
    } catch {
      toast.error("שגיאה ביצירת קוד");
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const removeMember = async (clientUserId: string) => {
    if (!window.confirm("האם להסיר את המשתמש מהחשבון?")) return;
    const { error } = await supabase
      .from("client_users")
      .delete()
      .eq("id", clientUserId);
    if (error) { toast.error("שגיאה בהסרה"); return; }
    setClientUsers(prev => prev.filter(cu => cu.id !== clientUserId));
    toast.success("המשתמש הוסר");
  };

  return (
    <div dir="rtl" style={{ padding: 16, fontFamily: "Heebo, sans-serif" }}>
      {isReadOnly && (
        <div style={{
          background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8,
          padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#92400e",
          fontFamily: "Heebo, sans-serif"
        }}>
          👁 מצב צפייה בלבד — אתה צופה בהגדרות של לקוח. לא ניתן לבצע שינויים.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>

        {/* ── CARD: Telegram Connection ── */}
        <div style={card}>
          <div style={cardHeader}><Bot size={16} /> חיבור Telegram</div>
          <div style={{ padding: 16 }}>
            {telegramChatId ? (
              <div>
                <div style={statRow}>
                  <span style={{ color: "#64748b" }}>סטטוס</span>
                  <span style={{ color: "#16a34a", fontWeight: 600 }}>✅ מחובר</span>
                </div>
                <div style={{ ...statRow, borderBottom: "none" }}>
                  <span style={{ color: "#64748b" }}>Chat ID</span>
                  <span style={{ fontFamily: "monospace", direction: "ltr" }}>{telegramChatId}</span>
                </div>
                <button style={{ ...btnSecondary, ...btnSm, marginTop: 12 }} onClick={disconnectTelegram}>
                  נתק Telegram
                </button>
              </div>
            ) : connectCode ? (
              <div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                  פתח את הבוט ושלח את הפקודה הבאה:
                </div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "#475569", marginBottom: 10, lineHeight: 1.6 }}>
                    שלח את הקישור הזה לעובדים שרוצים לחבר את הטלגרם שלהם לחשבון:
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 13, direction: "ltr", color: "#1e3a5f", marginBottom: 10, wordBreak: "break-all", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 10px" }}>
                    {botUrl ?? `https://t.me/INBOTbot?start=${connectCode}`}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      style={{ ...btnPrimary, ...btnSm }}
                      onClick={() => {
                        const url = botUrl ?? `https://t.me/INBOTbot?start=${connectCode}`;
                        navigator.clipboard.writeText(url);
                        toast.success("הקישור הועתק!");
                      }}
                    >
                      📋 העתק קישור
                    </button>
                    <button
                      style={{ ...btnSecondary, ...btnSm }}
                      onClick={() => window.open(botUrl ?? `https://t.me/INBOTbot?start=${connectCode}`, "_blank")}
                    >
                      פתח בטלגרם ↗
                    </button>
                  </div>
                </div>
                {isPolling && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b", marginTop: 8 }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: "#e8941a", animation: "pulse 1.5s infinite" }} />
                    <span>ממתין לחיבור...</span>
                    {connectCodeExpiry && (
                      <span style={{ color: "#94a3b8" }}>
                        (תקף עד {connectCodeExpiry.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })})
                      </span>
                    )}
                  </div>
                )}
                <button style={{ ...btnGhost, marginTop: 8, fontSize: 12 }} onClick={generateConnectCode}>
                  🔄 צור קוד חדש
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                  חבר את חשבון Telegram שלך כדי לשלוח חשבוניות ישירות לעיבוד.
                </div>
                <button
                  style={{ ...btnPrimary, ...btnSm, opacity: isGeneratingCode ? 0.6 : 1 }}
                  disabled={isGeneratingCode}
                  onClick={generateConnectCode}
                >
                  {isGeneratingCode ? "יוצר קוד..." : "✨ צור קוד חיבור"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── CARD: Connector Download ── */}
        <div style={card}>
          <div style={cardHeader}><Download size={16} /> התקנת Connector Gmail</div>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
              ה-Connector סורק את ה-Gmail שלך ושולח חשבוניות לעיבוד אוטומטי.
            </div>
            <div style={{ fontSize: 11, color: "#dc2626", marginBottom: 12 }}>
              ⚠️ הקובץ מכיל את פרטי ההגדרה שלך — אל תשתף אותו.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button
                style={{ ...btnPrimary, ...btnSm, opacity: isDownloadingConnector ? 0.6 : 1 }}
                disabled={isDownloadingConnector}
                onClick={downloadConnector}
              >
                <Download size={14} />
                {isDownloadingConnector ? "מוריד..." : "הורד Connector (.gs)"}
              </button>
              <button
                style={{ ...btnSecondary, ...btnSm }}
                onClick={() => window.open("https://docs.inbot.co.il/connector", "_blank")}
              >
                הוראות התקנה ↗
              </button>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.8, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>שלבים קצרים:</div>
              <div>1. הורד את הקובץ</div>
              <div>2. פתח script.google.com</div>
              <div>3. צור פרויקט חדש → הדבק את הקוד</div>
              <div>4. הרץ את runSetupWizard()</div>
            </div>
          </div>
        </div>

        {/* ── CARD: משתמשי החשבון ── */}
        <div style={card}>
          <div style={cardHeader}>
            <Users size={16} /> משתמשי החשבון
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 14 }}>
              {clientUsers.map(cu => (
                <div key={cu.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: "1px solid #f1f5f9",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e3a5f" }}>
                      {cu.profiles?.full_name || "משתמש"}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {cu.role === "owner" ? "👑 בעלים" : "👤 חבר"}
                    </div>
                  </div>
                  {cu.role !== "owner" && (
                    <button
                      style={{ ...btnGhost, color: "#dc2626", fontSize: 11 }}
                      onClick={() => removeMember(cu.id)}
                    >
                      הסר
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!inviteCode ? (
              <div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, lineHeight: 1.6 }}>
                  הזמן עובד או שותף לגשת לחשבון. הקוד תקף ל-24 שעות.
                </div>
                <button
                  style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}
                  onClick={generateInviteCode}
                  disabled={isGeneratingInvite}
                >
                  {isGeneratingInvite ? "יוצר קוד..." : "✉️ צור קוד הזמנה"}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>
                  שלח את הקוד הזה למשתמש — הוא יכניס אותו לאחר ההרשמה:
                </div>
                <div style={{
                  background: "#f0f4f8", border: "1px solid #cbd5e1",
                  borderRadius: 10, padding: "12px 16px", textAlign: "center", marginBottom: 10,
                }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>קוד הזמנה:</div>
                  <div style={{
                    fontFamily: "monospace", fontSize: 24, fontWeight: 700,
                    color: "#1e3a5f", letterSpacing: 4, direction: "ltr",
                  }}>
                    {inviteCode}
                  </div>
                  <button
                    style={{ ...btnGhost, fontSize: 11, marginTop: 6, color: "#1e3a5f" }}
                    onClick={() => { navigator.clipboard.writeText(inviteCode); toast.success("הועתק!"); }}
                  >
                    📋 העתק קוד
                  </button>
                </div>
                {inviteExpiry && (
                  <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginBottom: 8 }}>
                    תקף עד {inviteExpiry.toLocaleString("he-IL", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                  </div>
                )}
                <button
                  style={{ ...btnSecondary, ...btnSm, width: "100%", justifyContent: "center" }}
                  onClick={generateInviteCode}
                >
                  🔄 צור קוד חדש
                </button>
              </div>
            )}
          </div>
        </div>

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
            {isReadOnly && (
              <div style={statRow}>
                <span style={{ color: "#64748b" }}>טלפון</span>
                <span style={{ direction: "ltr", fontFamily: "monospace" }}>
                  {clientPhone ?? "לא הוזן"}
                </span>
              </div>
            )}
            <div style={{ ...statRow, borderBottom: "none" }}>
              <span style={{ color: "#64748b" }}>מע"מ נוכחי</span><span>{globalVatPct}%</span>
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
                  style={{ ...btnPrimary, ...btnSm, opacity: geminiInput.length < 10 || isReadOnly ? 0.5 : 1 }}
                  disabled={geminiInput.length < 10 || isReadOnly}
                  onClick={saveGeminiKey}
                >שמור מפתח</button>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>אופי העסק</label>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
                תיאור קצר של העסק — משפר את דיוק ה-AI בסיווג קטגוריות
              </div>
              {settings.businessNature && !natureEditing && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={chip}>{settings.businessNature}</span>
                  <button
                    style={{ ...btnGhost, padding: 0, fontSize: 12, color: "#1e3a5f" }}
                    onClick={() => { setNatureInput(settings.businessNature); setNatureEditing(true); }}
                  >ערוך</button>
                </div>
              )}
              {(!settings.businessNature || natureEditing) && (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    style={{ ...inputBase, flex: 1 }}
                    value={natureInput}
                    onChange={e => setNatureInput(e.target.value)}
                    placeholder='למשל: "חברת פיתוח תוכנה וייעוץ"'
                  />
                  <button
                    style={{ ...btnPrimary, ...btnSm, opacity: !natureInput.trim() ? 0.5 : 1 }}
                    disabled={!natureInput.trim()}
                    onClick={async () => {
                      const val = natureInput.trim();
                      if (!val || !clientId) return;
                      const { error } = await supabase.from("clients").update({ business_nature: val } as any).eq("id", clientId);
                      if (error) { toast.error("שגיאה בשמירה"); return; }
                      setSettings(p => ({ ...p, businessNature: val }));
                      setNatureInput("");
                      setNatureEditing(false);
                      setNatureSaved(true);
                      setTimeout(() => setNatureSaved(false), 2000);
                    }}
                  >שמור</button>
                </div>
              )}
              {natureSaved && (
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 6 }}>✓ נשמר</div>
              )}
            </div>
          </div>
        </div>
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
                <button style={{ ...btnPrimary, ...btnSm }} onClick={addWord} disabled={isReadOnly}>הוסף</button>
                <button style={{ ...btnGhost, ...btnSm }} onClick={() => setShowAddWord(false)}>ביטול</button>
              </div>
            )}
          </div>
        </div>

        {/* ── CARD 2b: Custom Categories ── */}
        <div style={card}>
          <div style={{ ...cardHeader, justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Tags size={16} /> קטגוריות מותאמות
              {catSaving && <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>שומר...</span>}
            </div>
            <button style={{ ...btnSecondary, ...btnSm }} onClick={() => setShowCatAdd(!showCatAdd)}>
              <Plus size={14} /> הוסף
            </button>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
              קטגוריות הוצאה ספציפיות לעסק שלך — ה-AI ישתמש בהן לסיווג חשבוניות.
            </div>
            {showCatAdd && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                <input
                  style={inputBase}
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  placeholder="שם קטגוריה (למשל: ציוד צילום)"
                />
                <input
                  style={inputBase}
                  value={catDesc}
                  onChange={e => setCatDesc(e.target.value)}
                  placeholder="תיאור (אופציונלי) — למשל: מצלמות, עדשות, תאורה"
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={{ ...btnPrimary, ...btnSm }}
                    onClick={async () => {
                      const name = catName.trim();
                      if (!name || !clientId) return;
                      if (settings.customCategories.some(c => c.name === name)) {
                        toast.warning("קטגוריה כבר קיימת"); return;
                      }
                      const updated = [...settings.customCategories, { name, description: catDesc.trim() }];
                      setSettings(p => ({ ...p, customCategories: updated }));
                      setCatName(""); setCatDesc(""); setShowCatAdd(false);
                      setCatSaving(true);
                      const { error } = await supabase.from("clients")
                        .update({ custom_categories: updated } as any)
                        .eq("id", clientId);
                      setCatSaving(false);
                      if (error) { toast.error("שגיאה בשמירה"); return; }
                      toast.success(`"${name}" נוספה`);
                    }}
                  >הוסף קטגוריה</button>
                  <button
                    style={{ ...btnGhost, ...btnSm }}
                    onClick={() => { setShowCatAdd(false); setCatName(""); setCatDesc(""); }}
                  >ביטול</button>
                </div>
              </div>
            )}
            <div style={scrollList}>
              {settings.customCategories.length === 0 && (
                <div style={{ padding: 10, fontSize: 12, color: "#64748b" }}>אין קטגוריות מותאמות עדיין</div>
              )}
              {settings.customCategories.map(cat => (
                <div key={cat.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 10px", borderBottom: "1px solid #f1f5f9", gap: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{cat.name}</span>
                    {cat.description && (
                      <span style={{ fontSize: 11, color: "#64748b" }}>{cat.description}</span>
                    )}
                  </div>
                  <button
                    style={btnGhost}
                    onClick={async () => {
                      if (!clientId) return;
                      const updated = settings.customCategories.filter(c => c.name !== cat.name);
                      setSettings(p => ({ ...p, customCategories: updated }));
                      const { error } = await supabase.from("clients")
                        .update({ custom_categories: updated } as any)
                        .eq("id", clientId);
                      if (error) { toast.error("שגיאה בשמירה"); return; }
                      toast.success(`"${cat.name}" נמחקה`);
                    }}
                  ><X size={14} /></button>
                </div>
              ))}
            </div>
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
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
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
                          <button style={btnGhost} onClick={() => saveTaxRule(rule.category, rule.editVat, rule.editTax)} disabled={isReadOnly}><Save size={14} style={{ color: "#1e3a5f" }} /></button>
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
                  <div style={subCardHeader}><Globe size={14} /> דומיינים לסריקת Gmail <SubCardTooltip text={"דומיינים שנכנסים לשאילתת הסריקה של Gmail.\nספק שלא מופיע כאן — המייל שלו לא נסרק כלל."} /></div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>דומיינים שנכנסים לשאילתת הסריקה של Gmail.</div>
                    <ListManager field="knownDomains" placeholder="דומיין ידוע (למשל cellcom.co.il)" />
                  </div>
                </div>

                {/* AI Tuning */}
                <div style={subCard}>
                  <div style={subCardHeader}><Brain size={14} /> כוונון AI <SubCardTooltip text={"הקשר עסקי שמועבר ל-Gemini לפני כל ניתוח.\nאופי העסק משפיע ישירות על סיווג הקטגוריות."} /></div>
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
                  <div style={subCardHeader}><UserCheck size={14} /> כינויי בעלים <SubCardTooltip text={"שמות נוספים שלך שעשויים להופיע בשדה 'לכבוד' בחשבוניות —\nעברית, אנגלית, או וריאציות נפוצות.\nמונע דחיית חשבוניות בגלל איות שונה."} /></div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>שמות נוספים שלך שעשויים להופיע בשדה "לכבוד".</div>
                    <ListManager field="ownerAliases" placeholder="שם נוסף (עברית או אנגלית)" />
                  </div>
                </div>

                {/* Custom Categories */}
                <div style={subCard}>
                  <div style={subCardHeader}><Tags size={14} /> קטגוריות מותאמות <SubCardTooltip text={"קטגוריות הוצאה ספציפיות לעסק שלך, בנוסף לרשימה הסטנדרטית.\nה-AI ישתמש בהן לסיווג ויופיעו בגרפים ובדוחות."} /></div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>הוסף שם קטגוריה והסבר — ה-AI ישתמש בהסבר לסיווג.</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                      <input style={inputBase} placeholder="שם קטגוריה (למשל: ציוד צילום)"
                        value={catNameInput} onChange={e => setCatNameInput(e.target.value)} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <input style={{ ...inputBase, flex: 1 }} placeholder="תיאור (למשל: מצלמות, עדשות, תאורה)"
                          value={catDescInput} onChange={e => setCatDescInput(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && addCustomCategory()} />
                        <button style={{ ...btnPrimary, ...btnSm }} onClick={addCustomCategory} disabled={isReadOnly}><Plus size={14} /></button>
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



                {/* Advanced Tuning */}
                <div style={subCard}>
                  <div style={subCardHeader}><SlidersHorizontal size={14} /> כוונון מתקדם <SubCardTooltip text={"פרמטרים טכניים שמשפיעים על ביצועי הסריקה.\nשנה רק אם יש סיבה ספציפית — ברירות המחדל מותאמות לרוב המקרים."} /></div>
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
                <button style={{ ...btnPrimary, opacity: isSaving || isReadOnly ? 0.5 : 1 }} disabled={isSaving || isReadOnly} onClick={saveAdvancedSettings}>
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
              <button style={btnDanger} onClick={confirmClearProcessed} disabled={isReadOnly}><Trash2 size={14} /> נקה</button>
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
