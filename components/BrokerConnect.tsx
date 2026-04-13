"use client";

/**
 * BrokerConnect — Card for connecting brokerage accounts to verify trades.
 *
 * Shows current verification level, broker connection status, and
 * buttons to initiate OAuth flows for supported brokers.
 *
 * Not financial advice. Verification is provided for transparency only.
 */

import { useState } from "react";

interface BrokerConnectProps {
  /** Current verification level from the trader profile. */
  verification: "self-reported" | "screenshot" | "broker-linked" | "exchange-api";
  /** Which broker is connected, if any (e.g. "alpaca"). */
  brokerSource?: string;
  /** ISO timestamp of the last successful sync, if any. */
  lastSyncAt?: string;
}

const VERIFICATION_LABELS: Record<string, { label: string; color: string }> = {
  "self-reported": { label: "Self-Reported", color: "var(--muted)" },
  screenshot: { label: "Screenshot", color: "var(--accent)" },
  "broker-linked": { label: "Broker Linked", color: "var(--up)" },
  "exchange-api": { label: "Exchange API", color: "var(--up)" },
};

const UPCOMING_BROKERS = [
  { name: "IBKR", id: "ibkr" },
  { name: "Coinbase", id: "coinbase" },
  { name: "Robinhood", id: "robinhood" },
];

export default function BrokerConnect({
  verification,
  brokerSource,
  lastSyncAt,
}: BrokerConnectProps) {
  const [syncing, setSyncing] = useState(false);

  const verInfo = VERIFICATION_LABELS[verification] ?? VERIFICATION_LABELS["self-reported"];
  const isConnected = verification === "broker-linked" || verification === "exchange-api";

  function handleConnect() {
    window.location.href = "/api/social/verify?broker=alpaca";
  }

  function handleResync() {
    setSyncing(true);
    window.location.href = "/api/social/verify?broker=alpaca";
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "24px",
        maxWidth: "480px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--text)",
            margin: 0,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          Verification
        </h3>
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "12px",
            fontWeight: 600,
            color: verInfo.color,
            background: `color-mix(in srgb, ${verInfo.color} 12%, transparent)`,
            padding: "4px 10px",
            borderRadius: "6px",
            letterSpacing: "0.02em",
          }}
        >
          {verInfo.label}
        </span>
      </div>

      {/* Connected state */}
      {isConnected && brokerSource && (
        <div
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text)",
                  textTransform: "capitalize",
                }}
              >
                {brokerSource}
              </div>
              {lastSyncAt && (
                <div
                  style={{
                    fontFamily: "var(--font-sans, sans-serif)",
                    fontSize: "12px",
                    color: "var(--muted)",
                    marginTop: "4px",
                  }}
                >
                  Last sync:{" "}
                  {new Date(lastSyncAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </div>
            <button
              onClick={handleResync}
              disabled={syncing}
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--accent)",
                background: "transparent",
                border: "1px solid var(--accent)",
                borderRadius: "6px",
                padding: "6px 12px",
                cursor: syncing ? "not-allowed" : "pointer",
                opacity: syncing ? 0.5 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {syncing ? "Syncing..." : "Re-sync"}
            </button>
          </div>
        </div>
      )}

      {/* Connect Alpaca CTA */}
      {!isConnected && (
        <button
          onClick={handleConnect}
          style={{
            width: "100%",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--bg)",
            background: "var(--accent)",
            border: "none",
            borderRadius: "8px",
            padding: "12px 16px",
            cursor: "pointer",
            marginBottom: "16px",
            letterSpacing: "0.02em",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Connect Alpaca
        </button>
      )}

      {/* Description */}
      <p
        style={{
          fontFamily: "var(--font-sans, sans-serif)",
          fontSize: "13px",
          color: "var(--muted)",
          lineHeight: 1.5,
          margin: "0 0 16px 0",
        }}
      >
        Link your brokerage account to automatically verify your trades.
        Verified traders rank higher on the leaderboard.
      </p>

      {/* Upcoming brokers */}
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--muted)",
            marginBottom: "8px",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          More brokers
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {UPCOMING_BROKERS.map((broker) => (
            <span
              key={broker.id}
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "11px",
                fontWeight: 500,
                color: "var(--muted)",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "4px 10px",
                opacity: 0.6,
              }}
            >
              {broker.name} &mdash; Coming soon
            </span>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <p
        style={{
          fontFamily: "var(--font-sans, sans-serif)",
          fontSize: "11px",
          color: "var(--muted)",
          lineHeight: 1.4,
          margin: "16px 0 0 0",
          opacity: 0.7,
        }}
      >
        Not financial advice. Trade verification is for transparency purposes
        only. BuyOrBeSold does not endorse any broker or trading strategy.
      </p>
    </div>
  );
}
