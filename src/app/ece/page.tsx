
"use client";

import ReactMarkdown from "react-markdown";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function EcePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();

    if (!text || loading) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", content: text },
    ]);

    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/agents/ece/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: text,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message || "Ece yanıt veremedi."
        );
      }

      if (typeof result.data?.reply !== "string") {
        throw new Error("Geçersiz model yanıtı.");
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: result.data.reply,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Bağlantı hatası."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f3f5f1",
      padding: "24px 12px",
      color: "#24372c",
    }}>
      <div style={{
        maxWidth: 900,
        margin: "0 auto",
        background: "#ffffff",
        borderRadius: 20,
        border: "1px solid #e1e7df",
        overflow: "hidden",
        boxShadow: "0 12px 40px rgba(20,40,25,0.05)",
      }}>
        <header style={{
          padding: 24,
          borderBottom: "1px solid #e5ebe4",
        }}>
          <a href="/" style={{
            color: "#54765c",
            fontSize: 14,
            textDecoration: "none",
          }}>
            ← Ekibime dön
          </a>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 18,
          }}>
            <div style={{
              width: 58,
              height: 58,
              borderRadius: 18,
              background: "#dce8dd",
              display: "grid",
              placeItems: "center",
              fontSize: 25,
              fontWeight: 700,
              color: "#426b58",
            }}>
              E
            </div>

            <div>
              <h1 style={{
                margin: 0,
                fontSize: 25,
              }}>
                Ece
              </h1>
              <p style={{
                margin: "5px 0",
                fontSize: 14,
                color: "#697b6e",
              }}>
                AI Ekip ve Ürün Lideri
              </p>
              <small style={{ color: "#53745c" }}>
                ● Yerel model: qwen3.5:4b
              </small>
            </div>
          </div>
        </header>

        <section
          aria-label="Ece sohbet geçmişi"
          style={{
            height: "55vh",
            minHeight: 350,
            maxHeight: 650,
            overflowY: "auto",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {messages.length === 0 && (
            <div style={{
              textAlign: "center",
              margin: "auto",
              maxWidth: 420,
            }}>
              <div style={{ fontSize: 38 }}>✦</div>
              <h2>Merhaba, ben Ece.</h2>
              <p style={{
                color: "#77857b",
                lineHeight: 1.7,
              }}>
                ARKEMX AI Studio'nun ekip lideriyim.
                Projeleri planlamak ve işleri
                koordine etmek için buradayım.
              </p>
            </div>
          )}

          {messages.map((item, index) => (
            <div
              key={index}
              style={{
                alignSelf:
                  item.role === "user"
                    ? "flex-end"
                    : "flex-start",
                maxWidth: "85%",
                padding: "14px 18px",
                borderRadius: 16,
                background:
                  item.role === "user"
                    ? "#dcebdd"
                    : "#f3f5f2",
                whiteSpace: item.role === "user" ? "pre-wrap" : "normal",
                overflowWrap: "anywhere",
                lineHeight: 1.6,
              }}
            >
              <strong style={{ fontSize: 13 }}>
                {item.role === "user" ? "Sen" : "Ece"}
              </strong>

            <div style={{ marginTop: 6 }}>
              {item.role === "assistant" ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p style={{ margin: "6px 0" }}>{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul
                        style={{
                          paddingLeft: 22,
                          listStyleType: "disc",
                          margin: "8px 0",
                        }}
                      >
                        {children}
                      </ul>
                    ),
                  }}
                >
                  {item.content}
                </ReactMarkdown>
              ) : (
                item.content
              )}
            </div>

            </div>
          ))}

          {loading && (
            <div style={{
              alignSelf: "flex-start",
              padding: 14,
              borderRadius: 14,
              background: "#f3f5f2",
            }}>
              Ece yanıt hazırlıyor...
            </div>
          )}

          <div ref={bottomRef} />
        </section>

        {error && (
          <p role="alert" style={{
            color: "#b42318",
            padding: "0 24px",
          }}>
            {error}
          </p>
        )}

        <form
          onSubmit={sendMessage}
          style={{
            borderTop: "1px solid #e5ebe4",
            padding: 20,
          }}
        >
          <div style={{
            display: "flex",
            gap: 12,
          }}>
            <textarea
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              placeholder="Ece'ye bir mesaj yaz..."
              maxLength={2000}
              rows={3}
              style={{
                flex: 1,
                minWidth: 0,
                padding: 14,
                border: "1px solid #d5dfd5",
                borderRadius: 12,
                resize: "vertical",
                background: "#ffffff",
                color: "#24372c",
                font: "inherit",
              }}
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                alignSelf: "flex-end",
                padding: "13px 22px",
                background: "#426b58",
                color: "white",
                border: 0,
                borderRadius: 12,
                cursor: loading ? "wait" : "pointer",
                opacity:
                  loading || !input.trim() ? 0.55 : 1,
              }}
            >
              {loading ? "Bekle..." : "Gönder"}
            </button>
          </div>

          <p style={{
            marginBottom: 0,
            color: "#8a978c",
            fontSize: 12,
          }}>
            Yerel AI modeli kullanılıyor.
            Yanıt oluşturulması biraz sürebilir.
          </p>
        </form>
      </div>
    </main>
  );
}
