import React from "react";

export default function News() {
  return (
    <div
  style={{
    height: "100%",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    textAlign: "center",
    color: "white",
    paddingTop: "15vh",
  }}
>
      <div
        style={{
          padding: "40px",
          borderRadius: "12px",
          background: "rgba(255, 255, 255, 0.03)",
          boxShadow: "0 0 40px rgba(0,0,0,0.4)",
          backdropFilter: "blur(6px)",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            marginBottom: "12px",
            letterSpacing: "0.5px",
          }}
        >
          AI-Filtered News 📈
        </h1>

        <p
          style={{
            color: "#9ca3af",
            fontSize: "16px",
            marginBottom: "20px",
          }}
        >
          Coming soon...
        </p>

        <div
          style={{
            height: "4px",
            width: "120px",
            margin: "0 auto",
            borderRadius: "2px",
            background: "linear-gradient(90deg, #19C37D, #3b82f6)",
            opacity: 0.8,
          }}
        />
      </div>
    </div>
  );
}