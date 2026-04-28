import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import About from "./pages/About";
import Footer from "./components/Footer";
import Signup from "./pages/Signup";
import Welcome from "./pages/Welcome";
import ProtectedRoute from "./components/ProtectedRoute";
import AccountType from "./pages/AccountType";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

// 👇 This component handles page tracking
function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    if (window.gtag) {
      window.gtag("config", "G-L6BKRZE20E", {
        page_path: location.pathname,
      });
    }
  }, [location]);

  return null;
}

function MobileDashboardBlock() {
  const desktopLink = "https://bullionaireiq.com";
  const [copied, setCopied] = useState(false);

  const handleSendToComputer = () => {
    const subject = encodeURIComponent("Open Bullionaire on your computer");
    const body = encodeURIComponent(
      `Open Bullionaire on your computer:\n\n${desktopLink}`
    );

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(desktopLink);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      alert("Could not copy the link automatically. Please copy: " + desktopLink);
    }
  };

  return (
    <div className="mobile-block">
      <div className="mobile-block-card">
        <h1>Desktop Required</h1>
        <p>
          Bullionaire accounts can be created on mobile, but the dashboard is
          currently optimized for desktop use. Please open your account on a
          computer for the best experience.
        </p>

        <div className="mobile-block-actions">
          <button className="mobile-block-button" onClick={handleSendToComputer}>
            Send link to my computer
          </button>

          <button
            className="mobile-block-button mobile-block-button-secondary"
            onClick={handleCopyLink}
          >
            {copied ? "Link copied" : "Copy desktop link"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const ua = navigator.userAgent;
      const isPhone =
        /iPhone/i.test(ua) ||
        (/Android/i.test(ua) && /Mobile/i.test(ua)) ||
        /Windows Phone/i.test(ua);

      setIsMobile(isPhone);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <>
      <PageTracker />

      <div className="app-wrapper">
        <main className="page-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/account-type" element={<AccountType />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  {isMobile ? <MobileDashboardBlock /> : <Dashboard />}
                </ProtectedRoute>
              }
            />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;