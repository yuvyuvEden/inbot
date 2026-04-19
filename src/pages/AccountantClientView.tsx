import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function AccountantClientView() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  return (
    <div dir="rtl" lang="he" style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "Heebo, sans-serif" }}>
      <nav
        style={{
          height: "60px",
          backgroundColor: "#1e3a5f",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
        }}
      >
        <button
          onClick={() => navigate("/accountant")}
          style={{
            background: "none",
            border: "none",
            color: "#ffffff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "14px",
            fontFamily: "Heebo, sans-serif",
          }}
        >
          <ArrowRight size={16} />
          חזרה ללקוחות שלי
        </button>
      </nav>
      <main style={{ padding: "48px 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: "20px", color: "#1e3a5f" }}>מסך לקוח {clientId} — בבנייה (P0-008)</h1>
      </main>
    </div>
  );
}
