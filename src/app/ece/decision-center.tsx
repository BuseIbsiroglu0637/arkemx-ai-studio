
"use client";

import { useEffect, useState } from "react";

type Decision = {
  id: string;
  project: string;
  decision: string;
  status: "proposed" | "confirmed" | "rejected";
  isRevoked: boolean;
  createdAt: string;
};

export default function DecisionCenter() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadDecisions() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/agents/ece/decisions", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !Array.isArray(result.data?.decisions)) {
        throw new Error(
          result.error?.message || "Kararlar getirilemedi."
        );
      }

      setDecisions(result.data.decisions);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Kararlar yüklenemedi."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDecisions();
  }, []);

  async function resolveDecision(
    id: string,
    status: "confirmed" | "rejected"
  ) {
    const action = status === "confirmed" ? "onaylamak" : "reddetmek";

    if (!window.confirm(`Bu kararı ${action} istiyor musun?`)) {
      return;
    }

    setWorkingId(id);
    setError("");

    try {
      const response = await fetch(
        `/api/agents/ece/decisions/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message || "Karar güncellenemedi."
        );
      }

      await loadDecisions();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Karar güncellenemedi."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function revokeDecision(id: string) {
    const reason = window.prompt(
      "Bu kararı neden iptal ediyorsun?",
      "Test amacıyla onaylandı; gerçek proje kararı değildir."
    );

    if (reason === null) return;

    const cleanReason = reason.trim();

    if (cleanReason.length < 3 || cleanReason.length > 500) {
      setError("İptal gerekçesi 3-500 karakter olmalı.");
      return;
    }

    if (!window.confirm("Bu kararın geçerliliğini iptal etmek istiyor musun?")) {
      return;
    }

    setWorkingId(id);
    setError("");

    try {
      const response = await fetch(
        `/api/agents/ece/decisions/${encodeURIComponent(id)}/revoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: cleanReason }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.data?.revoked !== true) {
        throw new Error(
          result.error?.message || "Karar iptal edilemedi."
        );
      }

      await loadDecisions();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Karar iptal edilemedi."
      );
    } finally {
      setWorkingId(null);
    }
  }

  function getStatusLabel(item: Decision) {
    if (item.isRevoked) return "İptal edildi";
    if (item.status === "confirmed") return "Onaylandı";
    if (item.status === "rejected") return "Reddedildi";
    return "Onay bekliyor";
  }

  const pendingCount = decisions.filter(
    (item) => item.status === "proposed" && !item.isRevoked
  ).length;

  return (
    <details
      style={{
        padding: 20,
        borderBottom: "1px solid #e5ebe4",
        background: "#fafcf9",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 700,
          color: "#315b42",
        }}
      >
        Karar Merkezi · {pendingCount} onay bekleyen
      </summary>

      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          disabled={loading || workingId !== null}
          onClick={() => void loadDecisions()}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #b8cdbb",
            background: "white",
            cursor: "pointer",
          }}
        >
          Listeyi yenile
        </button>

        {loading && <p>Kararlar yükleniyor...</p>}

        {error && (
          <p role="alert" style={{ color: "#b42318" }}>
            {error}
          </p>
        )}

        {!loading && decisions.length === 0 && (
          <p>Henüz kayıtlı karar bulunmuyor.</p>
        )}

        <div
          style={{
            display: "grid",
            gap: 12,
            marginTop: 14,
          }}
        >
          {decisions.map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid #dce8dd",
                borderRadius: 12,
                padding: 16,
                background: "#fff",
              }}
            >
              <strong>{item.project}</strong>

              <p style={{ lineHeight: 1.6 }}>
                {item.decision}
              </p>

              <small
                style={{
                  color: item.isRevoked
                    ? "#9b302c"
                    : item.status === "confirmed"
                      ? "#315b42"
                      : "#617464",
                  fontWeight: 600,
                }}
              >
                {getStatusLabel(item)}
              </small>

              {item.status === "proposed" && !item.isRevoked && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 14,
                  }}
                >
                  <button
                    type="button"
                    disabled={workingId !== null || loading}
                    onClick={() =>
                      void resolveDecision(item.id, "confirmed")
                    }
                    style={{
                      background: "#426b58",
                      color: "white",
                      border: 0,
                      borderRadius: 8,
                      padding: "10px 16px",
                      cursor: "pointer",
                    }}
                  >
                    Onayla
                  </button>

                  <button
                    type="button"
                    disabled={workingId !== null || loading}
                    onClick={() =>
                      void resolveDecision(item.id, "rejected")
                    }
                    style={{
                      background: "white",
                      color: "#9b302c",
                      border: "1px solid #dbb8b5",
                      borderRadius: 8,
                      padding: "10px 16px",
                      cursor: "pointer",
                    }}
                  >
                    Reddet
                  </button>
                </div>
              )}

              {item.status === "confirmed" && !item.isRevoked && (
                <div style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    disabled={workingId !== null || loading}
                    onClick={() => void revokeDecision(item.id)}
                    style={{
                      background: "white",
                      color: "#9b302c",
                      border: "1px solid #dbb8b5",
                      borderRadius: 8,
                      padding: "10px 16px",
                      cursor: "pointer",
                    }}
                  >
                    İptal Et
                  </button>
                </div>
              )}

              {item.isRevoked && (
                <p
                  style={{
                    marginTop: 10,
                    fontSize: 13,
                    color: "#617464",
                  }}
                >
                  Bu kararın geçmişi korunuyor ancak artık geçerli değil.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
