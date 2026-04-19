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
  active_clients_count: number;
}

const isExpiringSoon = (d: string | null) => {
  if (!d) return false;
  return new Date(d).getTime() - Date.now() < 7 * 86400000;
};

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL");
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
};

function RowMenu({
  accountant,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  accountant: AccountantRow;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
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

export default function AdminAccountantsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editAcc, setEditAcc] = useState<AccountantRow | null>(null);
  const [isNew, setIsNew] = useState(false);

  const { data: accountants, isLoading } = useQuery({
    queryKey: ["admin-accountants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accountants")
        .select("id, name, email, phone, plan_type, plan_expires_at, price_per_client, monthly_fee, auto_renew, is_active")
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
        auto_renew: a.auto_renew,
        is_active: a.is_active,
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
    onError: () => toast.error("שגיאה בשמירה"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accountants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-accountants"] });
      toast.success("רו\"ח נמחק בהצלחה");
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });

  const filtered = (accountants || []).filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setIsNew(true);
    setEditAcc({ ...emptyAccountant, active_clients_count: 0 } as AccountantRow);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="חיפוש לפי שם או מייל..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <button
          onClick={openNew}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-foreground hover:bg-accent/90"
        >
          + הוסף רו"ח
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-right text-xs font-semibold text-muted-foreground">
              <th className="p-3">שם</th>
              <th className="p-3">מייל</th>
              <th className="p-3">לקוחות פעילים</th>
              <th className="p-3">מנוי</th>
              <th className="p-3">מחיר/לקוח</th>
              <th className="p-3">הכנסה חודשית</th>
              <th className="p-3">תפוגה</th>
              <th className="p-3">פעולות</th>
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
                return (
                  <tr key={a.id} className="border-b border-border transition-colors hover:bg-secondary/50">
                    <td className="p-3 font-medium">{a.name}</td>
                    <td className="p-3" dir="ltr">{a.email}</td>
                    <td className="p-3">{a.active_clients_count}</td>
                    <td className="p-3">{a.plan_type || "—"}</td>
                    <td className="p-3">₪{a.price_per_client ?? 0}</td>
                    <td className="p-3">₪{revenue}</td>
                    <td className="p-3">
                      <span className={isExpiringSoon(a.plan_expires_at) ? "rounded bg-accent/20 px-2 py-0.5 text-accent" : ""}>
                        {formatDate(a.plan_expires_at)}
                      </span>
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
