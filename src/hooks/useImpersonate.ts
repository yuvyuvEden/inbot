import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function useImpersonate() {
  const navigate = useNavigate();

  const impersonate = (
    target_user_id: string | null,
    target_name: string,
    redirectPath: "/accountant" | "/dashboard",
    extra_id?: string  // client_id or accountant user_id
  ) => {
    if (!target_user_id && !extra_id) {
      toast.error("המשתמש עדיין לא השלים הרשמה");
      return;
    }
    const viewId = extra_id ?? target_user_id!;
    sessionStorage.setItem("admin_view_id", viewId);
    sessionStorage.setItem("admin_view_name", target_name);
    sessionStorage.setItem("admin_view_path", redirectPath);
    navigate(`${redirectPath}?admin_view=${viewId}`);
    toast.success(`צופה כ-${target_name} — מצב קריאה בלבד`);
  };

  const exitImpersonate = () => {
    sessionStorage.removeItem("admin_view_id");
    sessionStorage.removeItem("admin_view_name");
    sessionStorage.removeItem("admin_view_path");
  };

  return { impersonate, exitImpersonate, loading: null as string | null };
}
