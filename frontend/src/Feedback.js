import React, { useState } from "react";

export default function Feedback() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const companyEmail = "info@bullionaireiq.com";

  const handleSubmit = (e) => {
    e.preventDefault();

    const subject = encodeURIComponent("Bullionaire User Feedback");
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nFeedback:\n${message}`
    );

    window.location.href = `mailto:${companyEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <div style={{ color: "white", maxWidth: "720px" }}>
      <h1 style={{ marginBottom: "8px" }}>Feedback</h1>
      <p style={{ color: "#9ca3af", marginBottom: "24px" }}>
        We really appreciate any and all feedback! Send a quick message, report a bug, or suggest a feature!
      </p>

      <div
        style={{
          background: "#111827",
          border: "1px solid #1f2937",
          borderRadius: "12px",
          padding: "24px",
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <div style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "6px" }}>
            Company Email
          </div>
          <div style={{ fontWeight: 700 }}>{companyEmail}</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "6px" }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #374151",
                background: "#0E1424",
                color: "white",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "6px" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #374151",
                background: "#0E1424",
                color: "white",
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "6px" }}>Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what you like, what is broken, or what you want added."
              rows={7}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #374151",
                background: "#0E1424",
                color: "white",
                resize: "vertical",
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              padding: "12px 18px",
              backgroundColor: "#19C37D",
              color: "#001f3f",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Send Feedback
          </button>
        </form>
      </div>
    </div>
  );
}