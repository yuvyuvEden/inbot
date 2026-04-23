import { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/shared/Toggle";
import { useImpersonate } from "@/hooks/useImpersonate";
import { UserCheck } from "lucide-react";

interface AccountantRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  plan_type: string | null;
  plan_expires_at: string | null;
  price_per_client: number | null;
  monthly_fee: number | null;
  auto_renew: boolean | null;
  is_active: boolean | null;
  user_id: string | null;
  active_clients_count: number;
  base_client_count: number | null;
  billing_day: number | null;
  free_months: number | null;
}

const isExpiringSoon = (d: string | null) => {
  if (!d) return false;
  return new Date(d).getTime() - Date.now() < 7 * 86400000;
};

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL");
};

const getAccountantPlanBadge = (plan: string | null): { bg: string; color: string; text: string } => {
  switch (plan) {
    case "accountant_monthly":
      return { bg: "#1e3a5f", color: "#ffffff", text: "חודשי" };
    case "accountant_yearly":
    case "accountant_annual":
      return { bg: "#7c3aed", color: "#ffffff", text: "שנתי" };
    default:
      return { bg: "#f1f5f9", color: "#64748b", text: plan || "—" };
  }
};

const emptyAccountant: Omit<AccountantRow, "active_clients_count"> = {
  id: "",
  name: "",
  email: "",
  phone: null,
  plan_type: "accountant_monthly",
  plan_expires_at: null,
  price_per_client: 0,
  monthly_fee: 0,
  auto_renew: true,
  is_active: true,
  user_id: null,
  base_client_count: 10,
  billing_day: 1,
  free_months: 1,
};

function RowMenu({
  accountant,
  onEdit,
  onDelete,
  onToggleActive,
  onImpersonate,
  onGoToBilling,
  impersonateLoading,
}: {
  accountant: AccountantRow;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onImpersonate: () => void;
  onGoToBilling?: () => void;
  impersonateLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
    setOpen((p) => !p);
  };

  const menu = open
    ? ReactDOM.createPortal(
        <div
          ref={menuRef}
          style={{
            position: "absolute",
            top: menuPos.top,
            left: menuPos.left,
            zIndex: 9999,
            minWidth: "160px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => { if (accountant.user_id) { onImpersonate(); setOpen(false); } }}
            disabled={impersonateLoading || !accountant.user_id}
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              width: "100%", padding: "10px 16px",
              background: "none", border: "none",
              cursor: accountant.user_id ? "pointer" : "not-allowed",
              fontSize: "14px", color: "#1e3a5f",
              fontFamily: "Heebo, sans-serif", textAlign: "right",
              opacity: !accountant.user_id ? 0.4 : 1,
            }}
            onMouseEnter={(e) => { if (accountant.user_id) e.currentTarget.style.background = "#f0f4f8"; }}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <UserCheck size={16} />
            {impersonateLoading ? "מתחבר..." : "התחבר כרו\"ח"}
          </button>
          <div style={{ borderTop: "1px solid #e2e8f0", margin: "4px 0" }} />
          <button
            onClick={() => { onEdit(); setOpen(false); }}
            style={{
              display: "block", width: "100%", textAlign: "right",
              padding: "8px 14px", fontSize: "13px", background: "none",
              border: "none", cursor: "pointer", color: "#1a202c",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4f8")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            ✏️ ערוך פרטים
          </button>
          <button
            onClick={() => { onToggleActive(); setOpen(false); }}
            style={{
              display: "block", width: "100%", textAlign: "right",
              padding: "8px 14px", fontSize: "13px", background: "none",
              border: "none", cursor: "pointer", color: "#1a202c",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4f8")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            {accountant.is_active ? "⏸️ השעה" : "▶️ הפעל"}
          </button>
          <button
            onClick={() => { onGoToBilling?.(); setOpen(false); }}
            style={{
              display: "block", width: "100%", textAlign: "right",
              padding: "8px 14px", fontSize: "13px", background: "none",
              border: "none", cursor: "pointer", color: "#1a202c",
              fontFamily: "Heebo, sans-serif",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4f8")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            💳 צפה בחיובים
          </button>
          <div style={{ borderTop: "1px solid #e2e8f0", margin: "4px 0" }} />
          <button
            onClick={() => {
              setOpen(false);
              if (window.confirm(`למחוק את ${accountant.name}? פעולה זו אינה ניתנת לביטול.`)) {
                onDelete();
              }
            }}
            style={{
              display: "block", width: "100%", textAlign: "right",
              padding: "8px 14px", fontSize: "13px", background: "none",
              border: "none", cursor: "pointer", color: "#dc2626",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            🗑️ מחק רו"ח
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="rounded bg-secondary px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary/80"
      >
        פעולות ▾
      </button>
      {menu}
    </>
  );
}

interface AdminAccountantsTabProps {
  onGoToBilling?: (accountantId: string) => void;
}

export default function AdminAccountantsTab({ onGoToBilling }: AdminAccountantsTabProps = {}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editAcc, setEditAcc] = useState<AccountantRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const { impersonate, loading: impersonateLoading } = useImpersonate();

  const { data: accountants, isLoading } = useQuery({
    queryKey: ["admin-accountants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accountants")
        .select("id, name, email, phone, plan_type, plan_expires_at, price_per_client, monthly_fee, auto_renew, is_active, user_id, base_client_count, billing_day, free_months")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: acData } = await supabase.from("accountant_clients").select("accountant_id");
      const countMap = new Map<string, number>();
      (acData || []).forEach((ac) => countMap.set(ac.accountant_id, (countMap.get(ac.accountant_id) || 0) + 1));

      return (data || []).map((a) => ({
        ...a,
        active_clients_count: countMap.get(a.id) || 0,
      })) as AccountantRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (a: AccountantRow) => {
      const payload = {
        name: a.name,
        email: a.email,
        phone: a.phone,
        plan_type: a.plan_type,
        plan_expires_at: a.plan_expires_at,
        price_per_client: a.price_per_client,
        monthly_fee: a.monthly_fee,
        auto_renew: a.auto_renew,
        is_active: a.is_active,
        base_client_count: a.base_client_count,
        billing_day: a.billing_day,
        free_months: a.free_months,
      };
      if (isNew) {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-accountant`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              name: a.name,
              email: a.email,
              phone: a.phone,
              plan_type: a.plan_type,
              price_per_client: a.price_per_client,
              monthly_fee: a.monthly_fee,
            }),
          }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "שגיאה ביצירת רו\"ח");
      } else {
        const { error } = await supabase.from("accountants").update(payload).eq("id", a.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-accountants"] });
      toast.success(isNew ? "רו\"ח נוסף בהצלחה" : "רו\"ח עודכן בהצלחה");
      setEditAcc(null);
      setIsNew(false);
    },
    onError: (err: Error) => toast.error(err?.message || "שגיאה בשמירה"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-accountant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ accountant_id: id }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "שגיאה במחיקה");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-accountants"] });
      toast.success("רו\"ח נמחק בהצלחה");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה במחיקה"),
  });

  const filtered = (accountants || []).filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setIsNew(true);
    setEditAcc({ ...emptyAccountant, active_clients_count: 0 } as AccountantRow);
  };

  const thStyle: React.CSSProperties = {
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: 600,
    padding: "12px 16px",
    textAlign: "right",
  };

  return (
    <div className="space-y-4" style={{ fontFamily: "Heebo, sans-serif" }}>
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "12px 16px",
          marginBottom: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <Input
          placeholder="חיפוש לפי שם או מייל..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <button
          onClick={openNew}
          style={{
            background: "#e8941a",
            color: "#ffffff",
            borderRadius: "8px",
            padding: "8px 18px",
            fontSize: "14px",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            fontFamily: "Heebo, sans-serif",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#d97706")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#e8941a")}
        >
          + הוסף רו"ח
        </button>
      </div>

      <div
        style={{
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          background: "#ffffff",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          overflow: "hidden",
          width: "100%",
        }}
      >
        <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "linear-gradient(to left, #1e3a5f, #2d5a8e)" }}>
              <th style={thStyle}>שם</th>
              <th style={thStyle}>מייל</th>
              <th style={thStyle}>לקוחות פעילים</th>
              <th style={thStyle}>מנוי</th>
              <th style={thStyle}>מחיר/לקוח</th>
              <th style={thStyle}>הכנסה חודשית</th>
              <th style={thStyle}>תפוגה</th>
              <th style={thStyle}>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="p-3"><Skeleton className="h-4 w-16" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">לא נמצאו רואי חשבון</td></tr>
            ) : (
              filtered.map((a) => {
                const revenue = (a.price_per_client || 0) * a.active_clients_count;
                const stripeColor = !a.is_active
                  ? "#94a3b8"
                  : a.active_clients_count > 0
                  ? "#16a34a"
                  : "#e8941a";
                const planBadge = getAccountantPlanBadge(a.plan_type);
                return (
                  <tr
                    key={a.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      borderRight: `3px solid ${stripeColor}`,
                      background: "#ffffff",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                  >
                    <td className="p-3 font-medium" style={{ color: "#1a202c" }}>{a.name}</td>
                    <td className="p-3" dir="ltr" style={{ color: "#64748b", fontSize: "13px" }}>{a.email}</td>
                    <td className="p-3">
                      <span
                        style={{
                          background: a.active_clients_count > 0 ? "#e8f5e9" : "#f1f5f9",
                          color: a.active_clients_count > 0 ? "#16a34a" : "#94a3b8",
                          fontWeight: 700,
                          borderRadius: "20px",
                          padding: "2px 12px",
                          fontSize: "13px",
                          display: "inline-block",
                        }}
                      >
                        {a.active_clients_count}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        style={{
                          background: planBadge.bg,
                          color: planBadge.color,
                          borderRadius: "6px",
                          padding: "2px 10px",
                          fontSize: "11px",
                          fontWeight: 700,
                          display: "inline-block",
                        }}
                      >
                        {planBadge.text}
                      </span>
                    </td>
                    <td className="p-3" style={{ color: "#1a202c" }}>₪{a.price_per_client ?? 0}</td>
                    <td className="p-3">
                      {revenue > 0 ? (
                        <span style={{ color: "#16a34a", fontWeight: 700 }}>₪{revenue.toLocaleString("he-IL")}</span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {isExpiringSoon(a.plan_expires_at) ? (
                        <span
                          style={{
                            background: "#fef3c7",
                            color: "#b45309",
                            borderRadius: "6px",
                            padding: "2px 8px",
                            fontWeight: 600,
                            fontSize: "12px",
                          }}
                        >
                          ⚠️ {formatDate(a.plan_expires_at)}
                        </span>
                      ) : (
                        <span style={{ color: "#64748b", fontSize: "13px" }}>{formatDate(a.plan_expires_at)}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <RowMenu
                        accountant={a}
                        onEdit={() => { setIsNew(false); setEditAcc(a); }}
                        onDelete={() => deleteMutation.mutate(a.id)}
                        onToggleActive={() => {
                          const payload = { ...a, is_active: !a.is_active };
                          saveMutation.mutate(payload);
                        }}
                        onImpersonate={() => impersonate(a.user_id, a.name ?? a.email, "/accountant", a.user_id ?? undefined)}
                        onGoToBilling={() => onGoToBilling?.(a.id)}
                        impersonateLoading={false}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit/Create Drawer */}
      <Sheet open={!!editAcc} onOpenChange={(o) => { if (!o) { setEditAcc(null); setIsNew(false); } }}>
        <SheetContent side="left" className="w-[400px] overflow-y-auto" dir="rtl">
          <SheetHeader>
            <SheetTitle>{isNew ? "הוספת רו\"ח" : "עריכת רו\"ח"}</SheetTitle>
          </SheetHeader>
          {editAcc && (
            <div className="mt-6 space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-medium">
                  שם <span style={{ color: '#dc2626' }}>*</span>
                </span>
                <Input value={editAcc.name} onChange={(e) => setEditAcc({ ...editAcc, name: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">
                  מייל <span style={{ color: '#dc2626' }}>*</span>
                </span>
                <Input dir="ltr" type="email" value={editAcc.email} onChange={(e) => setEditAcc({ ...editAcc, email: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">טלפון <span style={{ color: '#94a3b8', fontSize: '11px' }}>(אופציונלי)</span></span>
                <Input dir="ltr" value={editAcc.phone || ""} onChange={(e) => setEditAcc({ ...editAcc, phone: e.target.value || null })} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">סוג מנוי <span style={{ color: '#94a3b8', fontSize: '11px' }}>(אופציונלי)</span></span>
                <Select value={editAcc.plan_type || "accountant_monthly"} onValueChange={(v) => setEditAcc({ ...editAcc, plan_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accountant_monthly">חודשי</SelectItem>
                    <SelectItem value="accountant_annual">שנתי</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">תפוגה <span style={{ color: '#94a3b8', fontSize: '11px' }}>(אופציונלי)</span></span>
                <Input type="date" value={editAcc.plan_expires_at?.slice(0, 10) || ""} onChange={(e) => setEditAcc({ ...editAcc, plan_expires_at: e.target.value || null })} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">מחיר ללקוח ₪ <span style={{ color: '#94a3b8', fontSize: '11px' }}>(אופציונלי)</span></span>
                <Input dir="ltr" type="number" value={editAcc.price_per_client ?? 0} onChange={(e) => setEditAcc({ ...editAcc, price_per_client: Number(e.target.value) })} />
              </label>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">חידוש אוטומטי</span>
                <Toggle
                  checked={!!editAcc.auto_renew}
                  onChange={(v) => setEditAcc({ ...editAcc, auto_renew: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">פעיל</span>
                <Toggle
                  checked={!!editAcc.is_active}
                  onChange={(v) => setEditAcc({ ...editAcc, is_active: v })}
                />
              </div>

              {/* חבילת בסיס */}
              <label className="block space-y-1">
                <span className="text-sm font-medium">לקוחות בחבילת הבסיס</span>
                <Input
                  dir="ltr"
                  type="number"
                  min={0}
                  value={editAcc.base_client_count ?? 10}
                  onChange={(e) => setEditAcc({ ...editAcc, base_client_count: parseInt(e.target.value) || 0 })}
                />
              </label>

              {/* יום חיוב */}
              <label className="block space-y-1">
                <span className="text-sm font-medium">יום חיוב בחודש (1–28)</span>
                <Input
                  dir="ltr"
                  type="number"
                  min={1}
                  max={28}
                  value={editAcc.billing_day ?? 1}
                  onChange={(e) => setEditAcc({ ...editAcc, billing_day: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) })}
                />
              </label>

              {/* חודשי חינם */}
              <label className="block space-y-1">
                <span className="text-sm font-medium">חודשי חינם שנותרו</span>
                <Input
                  dir="ltr"
                  type="number"
                  min={0}
                  value={editAcc.free_months ?? 0}
                  onChange={(e) => setEditAcc({ ...editAcc, free_months: parseInt(e.target.value) || 0 })}
                />
                <span style={{ color: '#94a3b8', fontSize: '11px' }}>0 = מחויב מהחודש הנוכחי</span>
              </label>

              <button
                onClick={() => {
                  if (!editAcc.name.trim()) {
                    toast.error("שם הוא שדה חובה");
                    return;
                  }
                  if (!editAcc.email.trim()) {
                    toast.error("מייל הוא שדה חובה");
                    return;
                  }
                  saveMutation.mutate(editAcc);
                }}
                disabled={saveMutation.isPending}
                className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saveMutation.isPending ? "שומר..." : "שמור"}
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
