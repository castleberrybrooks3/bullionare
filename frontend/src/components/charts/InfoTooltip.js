import React, { useState } from "react";

export default function InfoTooltip({
  title,
  description,
  good,
  bad,
  note,
  tipsEnabled = true,
  onHideAllTips,
}) {
  const [open, setOpen] = useState(false);

  if (!tipsEnabled) return null;

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        marginLeft: "6px",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(event) => event.stopPropagation()}
    >
      <span
        style={{
          width: "15px",
          height: "15px",
          borderRadius: "50%",
          border: "1px solid #64748b",
          color: "#cbd5e1",
          fontSize: "10px",
          fontWeight: 900,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "help",
          background: "rgba(15,23,42,0.95)",
          lineHeight: 1,
        }}
      >
        ?
      </span>

      {open && (
  <div
    style={{
      position: "absolute",
      top: "14px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "320px",
      height: "18px",
      zIndex: 9998,
      background: "transparent",
    }}
  />
)}

      {open && (
        <div
          style={{
            position: "absolute",
            top: "26px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "300px",
            padding: "13px",
            paddingTop: "30px",
            borderRadius: "12px",
            background: "rgba(15,23,42,0.98)",
            border: "1px solid #334155",
            color: "white",
            zIndex: 9999,
            boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
            fontSize: "12px",
            lineHeight: 1.45,
            pointerEvents: "auto",
          }}
        >
          {onHideAllTips && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onHideAllTips();
                setOpen(false);
              }}
              style={{
                position: "absolute",
                top: "7px",
                right: "8px",
                border: "1px solid #475569",
                background: "rgba(30,41,59,0.92)",
                color: "#cbd5e1",
                borderRadius: "999px",
                padding: "3px 7px",
                fontSize: "10px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Hide all tips
            </button>
          )}

          <div
            style={{
              fontWeight: 900,
              color: "#e5e7eb",
              marginBottom: "6px",
            }}
          >
            {title}
          </div>

          <div
            style={{
              color: "#cbd5e1",
              marginBottom: good || bad || note ? "8px" : 0,
            }}
          >
            {description}
          </div>

          {good && (
            <div style={{ color: "#86efac", marginBottom: "5px" }}>
              <strong>Generally good:</strong> {good}
            </div>
          )}

          {bad && (
            <div style={{ color: "#fca5a5", marginBottom: "5px" }}>
              <strong>Warning sign:</strong> {bad}
            </div>
          )}

          {note && (
            <div style={{ color: "#94a3b8" }}>
              <strong>Note:</strong> {note}
            </div>
          )}
        </div>
      )}
    </span>
  );
}