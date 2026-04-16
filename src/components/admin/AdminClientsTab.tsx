import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

export default function AdminClientsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editClient, setEditClient] = useState<ClientRow | null>(null);
  const [drawerAccountant, setDrawerAccountant] = useState<string>("");

  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data: clientsData, error } = await supabase
        .from("clients")
        .select("id, brand_name, legal_name, vat_number, plan_type, plan_expires_at, is_active, telegram_chat_id")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: acData } = await supabase
        .from("accountant_clients")
        .select("client_id, accountant_id");

      const acMap = new Map<string, string>();
      (acData || []).forEach((ac) => acMap.set(ac.client_id, ac.accountant_id));

      return (clientsData || []).map((c) => ({
        ...c,
        has_accountant: acMap.has(c.id),
        accountant_id: acMap.get(c.id) || null,
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
        })
        .eq("id", c.id);
      if (error) throw error;

      // Handle accountant assignment
      if (drawerAccountant) {
        // Remove existing
        await supabase.from("accountant_clients").delete().eq("client_id", c.id);
        if (drawerAccountant !== "__none__") {
          const { error: acErr } = await supabase
            .from("accountant_clients")
            .insert({ client_id: c.id, accountant_id: drawerAccountant });
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

  const filtered = (clients || []).filter((c) =>
    c.brand_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.legal_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.vat_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="חיפוש לפי שם עסק, שם חברה, ח.פ..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-right text-xs font-semibold text-muted-foreground">
              <th className="p-3">שם עסק</th>
              <th className="p-3">מנוי</th>
              <th className="p-3">תפוגה</th>
              <th className="p-3">רו"ח משויך</th>
              <th className="p-3">פעיל</th>
              <th className="p-3">פעולות</th>
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
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">לא נמצאו לקוחות</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-b border-border transition-colors hover:bg-secondary/50">
                  <td className="p-3 font-medium">{c.brand_name}</td>
                  <td className="p-3">{c.plan_type}</td>
                  <td className="p-3">
                    <span className={isExpiringSoon(c.plan_expires_at) ? "rounded bg-accent/20 px-2 py-0.5 text-accent" : ""}>
                      {formatDate(c.plan_expires_at)}
                    </span>
                  </td>
                  <td className="p-3">{c.has_accountant ? "✓" : "—"}</td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleActive.mutate({ id: c.id, is_active: !c.is_active })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        c.is_active ? 'bg-[#e8941a]' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        c.is_active ? 'translate-x-1' : 'translate-x-6'
                      }`} />
                    </button>
                  </td>
                  <td className="p-3 space-x-2 space-x-reverse">
                    <button
                      onClick={() => { setEditClient(c); setDrawerAccountant(c.accountant_id || ""); }}
                      className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                    >
                      ערוך
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
                <Switch checked={editClient.is_active} onCheckedChange={(v) => setEditClient({ ...editClient, is_active: v })} />
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
                <span className="text-sm font-medium">רו"ח משויך</span>
                <Select value={drawerAccountant || "__none__"} onValueChange={setDrawerAccountant}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא</SelectItem>
                    {(accountants || []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
    </div>
  );
}
