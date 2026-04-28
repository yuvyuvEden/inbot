import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface Props {
  clientId: string;
  geminiKey: string | null;
  businessNature: string | null;
  telegramChatId: string | null;
  sheetId: string | null;
  setActiveTab: (tab: string) => void;
}

export default function OnboardingChecklist({
  clientId,
  geminiKey,
  businessNature,
  telegramChatId,
  sheetId,
  setActiveTab,
}: Props) {
  const storageKey = `onboarding_done_${clientId}`;
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(storageKey) === "true"
  );

  const steps = [
    { label: "נרשמת למערכת", done: true },
    { label: "הגדרת מפתח AI ואופי עסק", done: !!geminiKey && !!businessNature },
    { label: "חיבור Telegram", done: !!telegramChatId },
    { label: "הגדרת סריקת Gmail", done: !!sheetId },
  ];
  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  useEffect(() => {
    if (allDone) {
      localStorage.setItem(storageKey, "true");
      setDismissed(true);
    }
  }, [allDone, storageKey]);

  if (dismissed) return null;

  const actionBtnStyle: React.CSSProperties = {
    color: "#1e3a5f",
    fontSize: 12,
    fontWeight: 600,
    background: "#f0f4f8",
    border: "none",
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: 6,
    fontFamily: "Heebo, sans-serif",
  };

  return (
    <div
      dir="rtl"
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 24,
        fontFamily: "Heebo, sans-serif",
        background: "#fff",
      }}
    >
      <div
        style={{
          background: "#1e3a5f",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>
          🚀 כמה צעדים להתחלה
        </span>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
          {completedCount}/4 צעדים הושלמו
        </span>
      </div>

      <div style={{ height: 4, background: "#e2e8f0", width: "100%" }}>
        <div
          style={{
            height: 4,
            background: "#e8941a",
            width: `${(completedCount / 4) * 100}%`,
            transition: "width 400ms ease",
          }}
        />
      </div>

      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {steps.map((step, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 99,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background: step.done ? "#16a34a" : "transparent",
                  border: step.done ? "none" : "2px solid #cbd5e1",
                }}
              >
                {step.done ? (
                  <CheckCircle2 size={16} color="white" />
                ) : (
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{i + 1}</span>
                )}
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: step.done ? "#1e293b" : "#64748b",
                  fontWeight: step.done ? 600 : 400,
                  textDecoration: step.done ? "line-through" : "none",
                }}
              >
                {step.label}
              </span>
            </div>

            {!step.done && i === 1 && (
              <button style={actionBtnStyle} onClick={() => setActiveTab("settings")}>
                הגדר ←
              </button>
            )}
            {!step.done && i === 2 && (
              <button
                style={actionBtnStyle}
                onClick={() =>
                  window.open(`https://t.me/INBOTbot?start=${clientId}`, "_blank")
                }
              >
                חבר ←
              </button>
            )}
            {!step.done && i === 3 && (
              <button
                style={actionBtnStyle}
                onClick={() => window.open("https://docs.inbot.co.il", "_blank")}
              >
                הוראות ←
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
