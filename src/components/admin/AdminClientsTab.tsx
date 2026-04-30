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
import { UserCheck, Users } from "lucide-react";
import { ClientUsersModal } from "@/components/admin/ClientUsersModal";
import { ChangePlanModal } from "@/components/admin/ChangePlanModal";


interface ClientRow {
  id: string;
  brand_name: string;
  legal_name: string | null;
  vat_number: string | null;
  plan_type: string;
  plan_expires_at: string | null;
  is_active: boolean;
  telegram_chat_id: string | null;
  has_accountant: boolean;
  accountant_id: string | null;
  user_id: string | null;
  gemini_api_key: string | null;
  created_at: string;
  settings_refresh_requested: boolean | null;
  settings_refreshed_at: string | null;
  phone?: string | null;
  invoice_limit_override?: number | null;
}

const isExpiringSoon = (d: string | null) => {
  if (!d) return false;
  const diff = new Date(d).getTime() - Date.now();
  return diff < 7 * 86400000;
};

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL");
};

const getPlanBadge = (plan: string): { bg: string; color: string; text: string } => {
  switch (plan) {
    case "pro":
      return { bg: "#7c3aed", color: "#ffffff", text: "Pro" };
    case "basic":
      return { bg: "#1e3a5f", color: "#ffffff", text: "Basic" };
    case "trial":
      return { bg: "#f59e0b", color: "#ffffff", text: "ניסיון" };
    case "free":
      return { bg: "#f1f5f9", color: "#64748b", text: "חינם" };
    default:
      return { bg: "#f1f5f9", color: "#64748b", text: plan || "—" };
  }
};

export default function AdminClientsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [innerTab, setInnerTab] = useState<"active" | "pending">("active");
  const [editClient, setEditClient] = useState<ClientRow | null>(null);
  const [drawerAccountant, setDrawerAccountant] = useState<string>("");
  const [drawerAccountantName, setDrawerAccountantName] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingAccountantId, setEditingAccountantId] = useState<string | null>(null);
  const [usersModal, setUsersModal] = useState<any>(null);
  const [planModal, setPlanModal] = useState<any>(null);
  const { impersonate, loading: impersonateLoading } = useImpersonate();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPlan, setBulkPlan] = useState<string>("");
  const [historyClient, setHistoryClient] = useState<ClientRow | null>(null);

  const { data: accountantHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["accountant-history", historyClient?.id],
    enabled: !!historyClient,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accountant_clients")
        .select("accountant_id, assigned_at, unassigned_at, accountants(name, email)")
        .eq("client_id", historyClient!.id)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    setSelectedIds(new Set());
  }, [innerTab]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data: clientsData, error } = await supabase
        .from("clients")
        .select("id, brand_name, legal_name, vat_number, plan_type, plan_expires_at, is_active, telegram_chat_id, user_id, gemini_api_key, created_at, plan_id, invoice_limit_override, extra_invoice_price, locked_monthly_price, locked_yearly_price, settings_refresh_requested, settings_refreshed_at, plans(id, name, invoice_limit, user_limit, monthly_price, yearly_price)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: acData, error: acError } = await supabase
        .from("accountant_clients")
        .select("client_id, accountant_id")
        .is("unassigned_at", null);
      
      if (acError) {
        console.error("accountant_clients error:", acError.message);
      }

      const acMap = new Map<string, string>();
      (acData || []).forEach((ac) => acMap.set(ac.client_id, ac.accountant_id));

      const userIds = (clientsData || []).map(c => c.user_id).filter(Boolean) as string[];
      const { data: profilesData } = userIds.length
        ? await supabase.from("profiles").select("user_id, phone").in("user_id", userIds)
        : { data: [] };
      const phoneMap = new Map((profilesData ?? []).map((p: any) => [p.user_id, p.phone]));

      return (clientsData || []).map((c) => ({
        ...c,
        has_accountant: acMap.has(c.id),
        accountant_id: acMap.get(c.id) || null,
        phone: phoneMap.get(c.user_id ?? "") ?? null,
      })) as ClientRow[];
    },
  });

  const { data: accountants } = useQuery({
    queryKey: ["admin-accountants-list"],
    queryFn: async () => {
      const { data } = await supabase.from("accountants").select("id, name");
      return data || [];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("clients").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-clients"] }); toast.success("עודכן בהצלחה"); },
    onError: () => toast.error("שגיאה בעדכון"),
  });

  const saveClient = useMutation({
    mutationFn: async (c: ClientRow) => {
      const { error } = await supabase
        .from("clients")
        .update({
          brand_name: c.brand_name,
          plan_type: c.plan_type,
          plan_expires_at: c.plan_expires_at,
          is_active: c.is_active,
          telegram_chat_id: c.telegram_chat_id,
          gemini_api_key: c.gemini_api_key || null,
          invoice_limit_override: (c as any).invoice_limit_override ?? null,
        })
        .eq("id", c.id);
      if (error) throw error;

      // Handle accountant assignment
      if (drawerAccountant !== undefined && drawerAccountant !== null) {
        // קריאת השיוך הפעיל הנוכחי
        const { data: currentLink } = await supabase
          .from("accountant_clients")
          .select("accountant_id")
          .eq("client_id", c.id)
          .is("unassigned_at", null)
          .maybeSingle();

        const currentAccountantId = currentLink?.accountant_id ?? null;
        const newAccountantId = drawerAccountant === "__none__" ? null : drawerAccountant;

        // אם הרו"ח לא השתנה — לא עושים כלום
        if (currentAccountantId === newAccountantId) return;

        // סימון שיוך קיים כלא פעיל
        await supabase
          .from("accountant_clients")
          .update({ unassigned_at: new Date().toISOString() })
          .eq("client_id", c.id)
          .is("unassigned_at", null);

        // הוספת שיוך חדש רק אם נבחר רו"ח
        if (newAccountantId) {
          const { error: acErr } = await supabase
            .from("accountant_clients")
            .insert({ client_id: c.id, accountant_id: newAccountantId });
          if (acErr) throw acErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("הלקוח עודכן בהצלחה");
      setEditClient(null);
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-client`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ client_id: id }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "שגיאה במחיקה");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("לקוח נמחק בהצלחה");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה במחיקה"),
  });

  const updatePlan = useMutation({
    mutationFn: async ({ id, plan_type }: { id: string; plan_type: string }) => {
      const { error } = await supabase.from("clients").update({ plan_type }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("מנוי עודכן");
      setEditingPlanId(null);
    },
    onError: () => toast.error("שגיאה בעדכון מנוי"),
  });

  const updateAccountant = useMutation({
    mutationFn: async ({ clientId, accountantId }: { clientId: string; accountantId: string }) => {
      // סימון שיוך קיים כלא פעיל
      await supabase
        .from("accountant_clients")
        .update({ unassigned_at: new Date().toISOString() })
        .eq("client_id", clientId)
        .is("unassigned_at", null);

      // שיוך חדש
      if (accountantId !== "__none__") {
        const { error } = await supabase
          .from("accountant_clients")
          .insert({ client_id: clientId, accountant_id: accountantId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("רו\"ח עודכן");
      setEditingAccountantId(null);
    },
    onError: () => toast.error("שגיאה בעדכון רו\"ח"),
  });

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkPlan("");
  };

  const bulkToggleActive = async (is_active: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const { error } = await supabase.from("clients").update({ is_active }).in("id", ids);
    if (error) {
      toast.error("שגיאה בעדכון");
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-clients"] });
    toast.success(is_active ? "הלקוחות הופעלו" : "הלקוחות הושעו");
    clearSelection();
  };

  const bulkChangePlan = async (plan_type: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !plan_type) return;
    const { error } = await supabase.from("clients").update({ plan_type }).in("id", ids);
    if (error) {
      toast.error("שגיאה בעדכון מנוי");
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-clients"] });
    toast.success("המנוי עודכן");
    clearSelection();
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`האם למחוק ${ids.length} לקוחות?`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-client`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ client_id: id }),
          }).then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
        )
      );
      const failed = results.filter((r) => !r.ok).length;
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      if (failed > 0) {
        toast.error(`${failed} לקוחות נכשלו במחיקה`);
      } else {
        toast.success("הלקוחות נמחקו בהצלחה");
      }
      clearSelection();
    } catch (err: any) {
      toast.error(err?.message || "שגיאה במחיקה");
    }
  };

  const allFiltered = (clients || []).filter((c) =>
    c.brand_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.legal_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.vat_number?.toLowerCase().includes(search.toLowerCase())
  );
  const activeClients = allFiltered.filter((c) => !isPending(c));
  const pendingClients = allFiltered.filter((c) => isPending(c));

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
          placeholder="חיפוש לפי שם עסק, שם חברה, ח.פ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={() => setInnerTab("active")}
            style={{
              background: innerTab === "active" ? "#1e3a5f" : "transparent",
              color: innerTab === "active" ? "#ffffff" : "#64748b",
              borderRadius: "8px",
              padding: "6px 16px",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              fontFamily: "Heebo, sans-serif",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (innerTab !== "active") e.currentTarget.style.background = "#f0f4f8";
            }}
            onMouseLeave={(e) => {
              if (innerTab !== "active") e.currentTarget.style.background = "transparent";
            }}
          >
            פעילים ({activeClients.length})
          </button>
          <button
            onClick={() => setInnerTab("pending")}
            style={{
              background: innerTab === "pending" ? "#1e3a5f" : "transparent",
              color: innerTab === "pending" ? "#ffffff" : "#64748b",
              borderRadius: "8px",
              padding: "6px 16px",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              fontFamily: "Heebo, sans-serif",
              transition: "all 0.15s",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
            onMouseEnter={(e) => {
              if (innerTab !== "pending") e.currentTarget.style.background = "#f0f4f8";
            }}
            onMouseLeave={(e) => {
              if (innerTab !== "pending") e.currentTarget.style.background = "transparent";
            }}
          >
            בהמתנה
            {pendingClients.length > 0 && (
              <span
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  borderRadius: "9999px",
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "1px 6px",
                }}
              >
                {pendingClients.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px" }}>
          {(innerTab === "active" ? activeClients : pendingClients).length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
              לא נמצאו לקוחות
            </div>
          ) : (
            (innerTab === "active" ? activeClients : pendingClients).map((c) => {
              const stripeColor = !c.is_active ? "#94a3b8" : c.has_accountant ? "#16a34a" : "#e8941a";
              return (
                <div
                  key={c.id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    padding: "16px",
                    border: "1px solid #e2e8f0",
                    borderRight: `4px solid ${stripeColor}`,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px" }}>
                    <span style={{ fontWeight: 700, fontSize: "15px", color: "#1e3a5f" }}>{c.brand_name}</span>
                    {(() => {
                      const b = getPlanBadge(c.plan_type);
                      return (
                        <span style={{ background: b.bg, color: b.color, borderRadius: "6px", padding: "2px 10px", fontSize: "11px", fontWeight: 700 }}>
                          {b.text}
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>
                    רו"ח: {c.has_accountant ? (accountants || []).find((a: any) => a.id === c.accountant_id)?.name || "✓" : "—"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "12px" }}>
                    תפוגה: {formatDate(c.plan_expires_at)}
                  </div>
                  <RowMenu
                    client={c}
                    onEdit={() => { setEditClient(c); setDrawerAccountant(c.accountant_id || ""); }}
                    onDelete={() => deleteMutation.mutate(c.id)}
                    onToggleActive={() => toggleActive.mutate({ id: c.id, is_active: !c.is_active })}
                    onImpersonate={() => impersonate(c.user_id, c.brand_name ?? c.legal_name ?? "לקוח", "/dashboard")}
                    impersonateLoading={impersonateLoading === c.user_id}
                    onOpenUsers={() => setUsersModal(c)}
                  />
                </div>
              );
            })
          )}
        </div>
      ) : (
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
              {innerTab === "active" ? (
                <>
                  <th style={{ ...thStyle, width: 40, textAlign: "center", padding: "12px 8px" }}>
                    <input
                      type="checkbox"
                      ref={(el) => {
                        if (!el) return;
                        const total = activeClients.length;
                        const sel = activeClients.filter((c) => selectedIds.has(c.id)).length;
                        el.indeterminate = sel > 0 && sel < total;
                      }}
                      checked={activeClients.length > 0 && activeClients.every((c) => selectedIds.has(c.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(activeClients.map((c) => c.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      style={{ cursor: "pointer", width: 16, height: 16 }}
                    />
                  </th>
                  <th style={thStyle}>שם עסק</th>
                  <th style={thStyle}>מנוי</th>
                  <th style={thStyle}>חבילה</th>
                  <th style={thStyle}>תפוגה</th>
                  <th style={thStyle}>רו"ח משויך</th>
                  <th style={thStyle}>סטטוס הגדרות</th>
                  <th style={thStyle}>פעולות</th>
                </>
              ) : (
                <>
                  <th style={thStyle}>שם עסק</th>
                  <th style={thStyle}>Telegram Chat ID</th>
                  <th style={thStyle}>שדות חסרים</th>
                  <th style={thStyle}>נרשם</th>
                  <th style={thStyle}>פעולות</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="p-3"><Skeleton className="h-4 w-20" /></td>
                  ))}
                </tr>
              ))
            ) : innerTab === "active" ? (
              activeClients.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">לא נמצאו לקוחות</td></tr>
              ) : (
                activeClients.map((c) => {
                  const stripeColor = !c.is_active
                    ? "#94a3b8"
                    : c.has_accountant
                    ? "#16a34a"
                    : "#e8941a";
                  return (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      borderRight: `3px solid ${stripeColor}`,
                      background: "#ffffff",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                  >
                    <td
                      style={{ width: 40, textAlign: "center", padding: "8px" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.id)) next.delete(c.id);
                            else next.add(c.id);
                            return next;
                          });
                        }}
                        style={{ cursor: "pointer", width: 16, height: 16 }}
                      />
                    </td>
                    <td className="p-3 font-medium" style={{ color: "#1a202c" }}>{c.brand_name}</td>
                    <td className="p-3" onClick={() => setEditingPlanId(c.id)} style={{ cursor: "pointer" }}>
                      {editingPlanId === c.id ? (
                        <select
                          autoFocus
                          defaultValue={c.plan_type}
                          onBlur={(e) => {
                            if (e.target.value !== c.plan_type) {
                              updatePlan.mutate({ id: c.id, plan_type: e.target.value });
                            } else {
                              setEditingPlanId(null);
                            }
                          }}
                          onChange={(e) => {
                            updatePlan.mutate({ id: c.id, plan_type: e.target.value });
                          }}
                          style={{
                            fontFamily: "Heebo, sans-serif",
                            fontSize: "13px",
                            border: "1px solid #1e3a5f",
                            borderRadius: "6px",
                            padding: "3px 6px",
                            background: "#fff",
                            outline: "none",
                          }}
                        >
                          <option value="free">free</option>
                          <option value="trial">trial</option>
                          <option value="basic">basic</option>
                          <option value="pro">pro</option>
                        </select>
                      ) : (
                        (() => {
                          const b = getPlanBadge(c.plan_type);
                          const override = (c as any).invoice_limit_override;
                          const hasOverride = override !== null && override !== undefined;
                          const overrideLabel = override === 0 ? "∞" : String(override);
                          return (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <span
                                style={{
                                  background: b.bg,
                                  color: b.color,
                                  borderRadius: "6px",
                                  padding: "2px 10px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  display: "inline-block",
                                }}
                              >
                                {b.text}
                              </span>
                              {hasOverride && (
                                <span
                                  title={`מגבלת חשבוניות מותאמת: ${overrideLabel}`}
                                  style={{
                                    background: "#fff7ed",
                                    color: "#c2410c",
                                    border: "1px solid #fed7aa",
                                    borderRadius: "6px",
                                    padding: "1px 6px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    display: "inline-block",
                                    cursor: "default",
                                  }}
                                >
                                  ⚡{overrideLabel}
                                </span>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </td>
                    <td className="p-3" style={{ color: "#1a202c" }}>
                      {(c as any).plans?.name ?? c.plan_type ?? "—"}
                    </td>
                    <td className="p-3">
                      {isExpiringSoon(c.plan_expires_at) ? (
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
                          ⚠️ {formatDate(c.plan_expires_at)}
                        </span>
                      ) : (
                        <span style={{ color: "#64748b", fontSize: "13px" }}>
                          {formatDate(c.plan_expires_at)}
                        </span>
                      )}
                    </td>
                    <td className="p-3" onClick={() => setEditingAccountantId(c.id)} style={{ cursor: "pointer" }}>
                      {editingAccountantId === c.id ? (
                        <div style={{ position: "relative" }}>
                          <input
                            autoFocus
                            list="inline-accountants-list"
                            placeholder="חפש רו״ח..."
                            defaultValue={
                              c.accountant_id
                                ? (accountants || []).find(a => a.id === c.accountant_id)?.name || ""
                                : ""
                            }
                            onBlur={(e) => {
                              const match = (accountants || []).find(a => a.name === e.target.value);
                              if (match) {
                                updateAccountant.mutate({ clientId: c.id, accountantId: match.id });
                              } else if (e.target.value === "" || e.target.value === "ללא") {
                                updateAccountant.mutate({ clientId: c.id, accountantId: "__none__" });
                              } else {
                                setEditingAccountantId(null);
                              }
                            }}
                            style={{
                              fontFamily: "Heebo, sans-serif",
                              fontSize: "13px",
                              border: "1px solid #1e3a5f",
                              borderRadius: "6px",
                              padding: "3px 6px",
                              background: "#fff",
                              outline: "none",
                              width: "130px",
                            }}
                          />
                          <datalist id="inline-accountants-list">
                            <option value="ללא" />
                            {(accountants || []).map((a) => (
                              <option key={a.id} value={a.name} />
                            ))}
                          </datalist>
                        </div>
                      ) : c.has_accountant ? (
                        <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1a202c", fontSize: "13px" }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
                          {(accountants || []).find(a => a.id === c.accountant_id)?.name || "✓"}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {(c as any).settings_refresh_requested ? (
                        <span style={{
                          background: "#fef3c7", color: "#b45309",
                          padding: "2px 8px", borderRadius: "10px",
                          fontSize: "11px", fontWeight: 600,
                          display: "inline-flex", alignItems: "center", gap: "4px"
                        }}>
                          ⏳ ממתין לסנכרון
                        </span>
                      ) : (c as any).settings_refreshed_at ? (
                        <span style={{
                          background: "#f0fdf4", color: "#16a34a",
                          padding: "2px 8px", borderRadius: "10px",
                          fontSize: "11px", fontWeight: 600,
                          display: "inline-flex", alignItems: "center", gap: "4px"
                        }} title={`עודכן: ${new Date((c as any).settings_refreshed_at).toLocaleString("he-IL")}`}>
                          ✅ מסונכרן
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "11px" }}>—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div title={c.is_active ? "פעיל" : "לא פעיל"} style={{ display: "inline-block" }}>
                        <RowMenu
                          client={c}
                          onEdit={() => {
                            setEditClient(c);
                            setDrawerAccountant(c.accountant_id || "");
                            const found = (accountants || []).find(a => a.id === c.accountant_id);
                            setDrawerAccountantName(found?.name || "");
                          }}
                          onDelete={() => deleteMutation.mutate(c.id)}
                          onToggleActive={() => toggleActive.mutate({ id: c.id, is_active: !c.is_active })}
                          onImpersonate={() => impersonate(c.user_id, c.brand_name ?? c.legal_name ?? "לקוח", "/dashboard", c.id)}
                          impersonateLoading={false}
                          onOpenUsers={() => setUsersModal(c)}
                        />
                      </div>
                    </td>
                  </tr>
                  );
                })
              )
            ) : (
              pendingClients.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">אין לקוחות בהמתנה</td></tr>
              ) : (
                pendingClients.map((c) => {
                  const age = getPendingAge(c.created_at);
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border transition-colors"
                      style={{
                        background: age === "danger" ? "#fef2f2" : age === "warning" ? "#fffbeb" : undefined,
                      }}
                    >
                      <td className="p-3 font-medium">{c.brand_name || "—"}</td>
                      <td className="p-3 text-xs" dir="ltr">{c.telegram_chat_id || "—"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {getMissingFields(c).map((f) => (
                            <span
                              key={f}
                              style={{
                                background: "#fef2f2",
                                color: "#dc2626",
                                borderRadius: "4px",
                                fontSize: "11px",
                                padding: "1px 6px",
                                border: "1px solid #fecaca",
                              }}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("he-IL")}
                      </td>
                      <td className="p-3">
                        <RowMenu
                          client={c}
                          onEdit={() => {
                            setEditClient(c);
                            setDrawerAccountant(c.accountant_id || "");
                            const found = (accountants || []).find(a => a.id === c.accountant_id);
                            setDrawerAccountantName(found?.name || "");
                          }}
                          onDelete={() => deleteMutation.mutate(c.id)}
                          onToggleActive={() => toggleActive.mutate({ id: c.id, is_active: !c.is_active })}
                          onImpersonate={() => impersonate(c.user_id, c.brand_name ?? c.legal_name ?? "לקוח", "/dashboard")}
                          impersonateLoading={impersonateLoading === c.user_id}
                          onOpenUsers={() => setUsersModal(c)}
                        />
                      </td>
                    </tr>
                  );
                })
              )
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Edit Drawer */}
      <Sheet open={!!editClient} onOpenChange={(o) => !o && setEditClient(null)}>
        <SheetContent side="left" className="w-[400px] overflow-y-auto" dir="rtl">
          <SheetHeader>
            <SheetTitle>עריכת לקוח</SheetTitle>
          </SheetHeader>
          {editClient && (
            <div className="mt-6 space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-medium">שם עסק</span>
                <Input value={editClient.brand_name} onChange={(e) => setEditClient({ ...editClient, brand_name: e.target.value })} />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium">סוג מנוי</span>
                <Select value={editClient.plan_type} onValueChange={(v) => setEditClient({ ...editClient, plan_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">free</SelectItem>
                    <SelectItem value="trial">trial</SelectItem>
                    <SelectItem value="basic">basic</SelectItem>
                    <SelectItem value="pro">pro</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium">תפוגה</span>
                <Input
                  type="date"
                  value={editClient.plan_expires_at?.slice(0, 10) || ""}
                  onChange={(e) => setEditClient({ ...editClient, plan_expires_at: e.target.value || null })}
                />
              </label>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">פעיל</span>
                <Toggle
                  checked={editClient.is_active}
                  onChange={(v) => setEditClient({ ...editClient, is_active: v })}
                />
              </div>

              {/* שדרוג חבילה */}
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e3a5f", marginBottom: "8px", fontFamily: "Heebo, sans-serif" }}>
                  חבילה נוכחית
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <div style={{ fontSize: "13px", color: "#1a202c", fontFamily: "Heebo, sans-serif" }}>
                    {(editClient as any)?.plans?.name ?? editClient?.plan_type ?? "—"}
                  </div>
                  <button
                    onClick={() => setPlanModal(editClient)}
                    style={{
                      padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
                      backgroundColor: "#e8941a", color: "#ffffff",
                      border: "none", cursor: "pointer", fontFamily: "Heebo, sans-serif"
                    }}
                  >
                    שנה חבילה
                  </button>
                </div>
                {(editClient as any)?.locked_monthly_price != null && (
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "6px", fontFamily: "Heebo, sans-serif" }}>
                    מחיר נעול: ₪{(editClient as any).locked_monthly_price}/חודש
                    {" "}(החבילה עולה ₪{(editClient as any).plans?.monthly_price ?? 0})
                  </div>
                )}
              </div>

              {editClient.phone && (
                <div style={{ padding: "8px 0", borderTop: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px", fontFamily: "Heebo, sans-serif" }}>
                    טלפון (מהפרופיל)
                  </div>
                  <div style={{ fontSize: "13px", fontFamily: "monospace", direction: "ltr", color: "#1e3a5f" }}>
                    {editClient.phone}
                  </div>
                </div>
              )}

              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e3a5f", marginBottom: "4px", fontFamily: "Heebo, sans-serif" }}>
                  מגבלת חשבוניות חודשית (דריסה)
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "8px", fontFamily: "Heebo, sans-serif" }}>
                  ריק = לפי חבילה. 0 = ללא הגבלה. מספר = מגבלה ספציפית ללקוח זה.
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <Input
                    dir="ltr"
                    type="number"
                    min={0}
                    placeholder="לפי חבילה"
                    value={(editClient as any).invoice_limit_override ?? ""}
                    onChange={(e) => setEditClient({ ...editClient, invoice_limit_override: e.target.value === "" ? null : Number(e.target.value) } as any)}
                  />
                  <span style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap" }}>
                    חבילה: {(editClient as any).plans?.invoice_limit ?? "—"}
                  </span>
                </div>
              </div>

              <label className="block space-y-1">
                <span className="text-sm font-medium">Telegram Chat ID</span>
                <Input
                  dir="ltr"
                  value={editClient.telegram_chat_id || ""}
                  onChange={(e) => setEditClient({ ...editClient, telegram_chat_id: e.target.value || null })}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium">
                  Gemini API Key
                  <span style={{ color: '#94a3b8', fontSize: '11px', marginRight: '6px' }}>(נדרש לעיבוד חשבוניות)</span>
                </span>
                <Input
                  dir="ltr"
                  placeholder="AIza..."
                  value={editClient.gemini_api_key || ""}
                  onChange={(e) => setEditClient({ ...editClient, gemini_api_key: e.target.value || null })}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium">רו"ח משויך</span>
                <input
                  type="text"
                  placeholder='ללא — התחל להקליד לחיפוש'
                  list="accountants-list"
                  value={drawerAccountantName}
                  onChange={(e) => {
                    setDrawerAccountantName(e.target.value);
                    const found = (accountants || []).find(a => a.name === e.target.value);
                    if (found) setDrawerAccountant(found.id);
                    else if (e.target.value === "" || e.target.value === "ללא") setDrawerAccountant("__none__");
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <datalist id="accountants-list">
                  <option value="ללא" />
                  {(accountants || []).map((a) => (
                    <option key={a.id} value={a.name} />
                  ))}
                </datalist>
              </label>

              <button
                onClick={() => saveClient.mutate(editClient)}
                disabled={saveClient.isPending}
                className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saveClient.isPending ? "שומר..." : "שמור"}
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {usersModal && (
        <ClientUsersModal client={usersModal} onClose={() => setUsersModal(null)} />
      )}

      {planModal && (
        <ChangePlanModal
          client={planModal}
          onClose={() => setPlanModal(null)}
          onSaved={() => {
            setPlanModal(null);
            qc.invalidateQueries({ queryKey: ["admin-clients"] });
          }}
        />
      )}

      {selectedIds.size > 0 && ReactDOM.createPortal(
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            padding: "12px 20px",
            display: "flex",
            gap: 12,
            alignItems: "center",
            zIndex: 1000,
            fontFamily: "Heebo, sans-serif",
          }}
          dir="rtl"
        >
          <span style={{ color: "#64748b", fontSize: 13 }}>
            {selectedIds.size} לקוחות נבחרו
          </span>
          <span style={{ width: 1, height: 24, background: "#e2e8f0" }} />
          <button
            onClick={() => bulkToggleActive(true)}
            style={{
              background: "#16a34a", color: "#ffffff", border: "none",
              borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "Heebo, sans-serif",
            }}
          >
            הפעל
          </button>
          <button
            onClick={() => bulkToggleActive(false)}
            style={{
              background: "#64748b", color: "#ffffff", border: "none",
              borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "Heebo, sans-serif",
            }}
          >
            השעה
          </button>
          <span style={{ width: 1, height: 24, background: "#e2e8f0" }} />
          <select
            value={bulkPlan}
            onChange={(e) => {
              const v = e.target.value;
              setBulkPlan(v);
              if (v) bulkChangePlan(v);
            }}
            style={{
              fontFamily: "Heebo, sans-serif",
              fontSize: 13,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "6px 10px",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            <option value="">שנה חבילה...</option>
            <option value="free">free</option>
            <option value="trial">trial</option>
            <option value="basic">basic</option>
            <option value="pro">pro</option>
          </select>
          <span style={{ width: 1, height: 24, background: "#e2e8f0" }} />
          <button
            onClick={bulkDelete}
            style={{
              background: "#dc2626", color: "#ffffff", border: "none",
              borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "Heebo, sans-serif",
            }}
          >
            🗑️ מחק
          </button>
          <button
            onClick={clearSelection}
            style={{
              background: "transparent", color: "#64748b", border: "none",
              borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "Heebo, sans-serif",
            }}
          >
            ✕ בטל
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

const isPending = (c: ClientRow) =>
  !c.user_id || !c.brand_name || !c.vat_number || !c.gemini_api_key;

const getMissingFields = (c: ClientRow): string[] => {
  const missing: string[] = [];
  if (!c.user_id) missing.push("משתמש");
  if (!c.brand_name) missing.push("שם עסק");
  if (!c.vat_number) missing.push("ח.פ");
  if (!c.gemini_api_key) missing.push("Gemini Key");
  return missing;
};

const getPendingAge = (created_at: string): "normal" | "warning" | "danger" => {
  const days = (Date.now() - new Date(created_at).getTime()) / 86400000;
  if (days > 14) return "danger";
  if (days > 5) return "warning";
  return "normal";
};

function RowMenu({
  client,
  onEdit,
  onDelete,
  onToggleActive,
  onImpersonate,
  impersonateLoading,
  onOpenUsers,
}: {
  client: ClientRow;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onImpersonate: () => void;
  impersonateLoading: boolean;
  onOpenUsers: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [open]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuWidth = 180;
      setMenuPos({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
      });
    }
    setOpen((p) => !p);
  };

  const menu = open
    ? ReactDOM.createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
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
            onClick={() => { if (client.user_id) { onImpersonate(); setOpen(false); } }}
            disabled={impersonateLoading || !client.user_id}
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              width: "100%", padding: "10px 16px",
              background: "none", border: "none",
              cursor: client.user_id ? "pointer" : "not-allowed",
              fontSize: "14px", color: "#1e3a5f",
              fontFamily: "Heebo, sans-serif", textAlign: "right",
              opacity: !client.user_id ? 0.4 : 1,
            }}
            onMouseEnter={(e) => { if (client.user_id) e.currentTarget.style.background = "#f0f4f8"; }}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <UserCheck size={16} />
            {impersonateLoading ? "מתחבר..." : "התחבר כלקוח"}
          </button>
          <button
            onClick={() => { onOpenUsers(); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              width: "100%", padding: "10px 16px",
              background: "none", border: "none", cursor: "pointer",
              fontSize: "14px", color: "#1e3a5f",
              fontFamily: "Heebo, sans-serif", textAlign: "right",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4f8")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <Users size={15} style={{ color: "#e8941a", flexShrink: 0 }} />
            משתמשים ותוספות
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
            {client.is_active ? "⏸️ השעה" : "▶️ הפעל"}
          </button>
          <div style={{ borderTop: "1px solid #e2e8f0", margin: "4px 0" }} />
          <button
            onClick={() => {
              setOpen(false);
              if (window.confirm(`למחוק את ${client.brand_name}? פעולה זו אינה ניתנת לביטול.`)) {
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
            🗑️ מחק לקוח
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

