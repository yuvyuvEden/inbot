const LOGO_URL = "https://jkqpkbcdtbelgpuwncam.supabase.co/storage/v1/object/public/assets//LOGO.jpeg";

const AuthCard = ({ children }: { children: React.ReactNode }) => (
  <div
    className="flex min-h-screen flex-col items-center justify-center px-4"
    style={{ background: "linear-gradient(135deg, #f0f4f8 0%, #e8eef4 100%)" }}
  >
    <div
      className="w-full max-w-[420px] rounded-2xl bg-card p-10"
      style={{
        boxShadow: "0 4px 12px rgba(0,0,0,.08)",
        borderLeft: "3px solid hsl(var(--accent))",
      }}
    >
      <div className="mb-8">
        <img
          src={LOGO_URL}
          alt="INBOT"
          className="mx-auto block h-auto"
          style={{ maxWidth: 220 }}
        />
      </div>
      {children}
    </div>
    <p className="mt-6 text-center text-[12px]" style={{ color: "#94a3b8" }}>
      © 2026 INBOT · כל הזכויות שמורות
    </p>
  </div>
);

export default AuthCard;
