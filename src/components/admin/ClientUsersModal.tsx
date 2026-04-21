import { useState } from "react";
import {
  useClientUsers,
  useAddClientUser,
  useUpdateInvoiceOverride,
} from "@/hooks/usePlans";
import { Users, Plus, X } from "lucide-react";

interface Props {
  client: any;
  onClose: () => void;
}

export function ClientUsersModal({ client, onClose }: Props) {
  const { data: users = [], isLoading } = useClientUsers(client.id);
  const addUser = useAddClientUser();
  const updateOverride = useUpdateInvoiceOverride();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", telegram_chat_id: "", email: "" });
  const [overrideCount, setOverrideCount] = useState<number>(client.invoice_limit_override ?? 0);
  const [overridePrice, setOverridePrice] = useState<number>(Number(client.extra_invoice_price ?? 0));

  const inputCls =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40";

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-card shadow-2xl font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Users className="text-accent" size={20} />
            <h2 className="text-base font-bold text-primary">
              משתמשים — {client.brand_name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Invoice override */}
        <div className="border-b border-border bg-secondary/30 px-6 py-4">
          <div className="mb-3 text-sm font-semibold text-primary">
            תוספת חשבוניות (מעל המגבלה)
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                כמות נוספת מאושרת
              </label>
              <input
                type="number"
                value={overrideCount}
                onChange={(e) => setOverrideCount(parseInt(e.target.value) || 0)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                מחיר לחשבונית נוספת (₪)
              </label>
              <input
                type="number"
                step="0.01"
                value={overridePrice}
                onChange={(e) => setOverridePrice(parseFloat(e.target.value) || 0)}
                className={inputCls}
              />
            </div>
          </div>
          <button
            onClick={() =>
              updateOverride.mutateAsync({
                clientId: client.id,
                override: overrideCount,
                price: overridePrice,
              })
            }
            disabled={updateOverride.isPending}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {updateOverride.isPending ? "שומר..." : "✓ אשר תוספת"}
          </button>
        </div>

        {/* Secondary users */}
        <div className="px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-primary">
              משתמשים משניים ({users.length})
            </div>
            <button
              onClick={() => setShowAddForm((f) => !f)}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={14} /> הוסף משתמש
            </button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <div className="mb-4 rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">שם *</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Telegram Chat ID
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={newUser.telegram_chat_id}
                    onChange={(e) =>
                      setNewUser({ ...newUser, telegram_chat_id: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">מייל</label>
                <input
                  type="email"
                  dir="ltr"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!newUser.name.trim()) return;
                    await addUser.mutateAsync({ client_id: client.id, ...newUser });
                    setNewUser({ name: "", telegram_chat_id: "", email: "" });
                    setShowAddForm(false);
                  }}
                  disabled={!newUser.name.trim() || addUser.isPending}
                  className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {addUser.isPending ? "מוסיף..." : "הוסף"}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="rounded-md bg-secondary px-4 py-1.5 text-sm text-muted-foreground hover:bg-secondary/80"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          {/* Users table */}
          {isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">טוען...</p>
          ) : users.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              אין משתמשים משניים
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary text-right text-xs font-semibold text-muted-foreground">
                    {["שם", "Telegram ID", "מייל", "סטטוס"].map((h) => (
                      <th key={h} className="p-2.5">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="p-2.5 font-medium">{u.name}</td>
                      <td className="p-2.5 text-xs" dir="ltr">
                        {u.telegram_chat_id || "—"}
                      </td>
                      <td className="p-2.5 text-xs" dir="ltr">
                        {u.email || "—"}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            u.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {u.is_active ? "פעיל" : "לא פעיל"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
