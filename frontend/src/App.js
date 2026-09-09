import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import StockAnalysis from "./pages/StockAnalysis";
import About from "./pages/About";
import Footer from "./components/Footer";
import Signup from "./pages/Signup";
import Welcome from "./pages/Welcome";
import ProtectedRoute from "./components/ProtectedRoute";
import AccountType from "./pages/AccountType";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import SmartMoney from "./pages/SmartMoney";
import SmartMoneyInsiderTransactions from "./pages/SmartMoneyInsiderTransactions";
import SmartMoneyFounderLed from "./pages/SmartMoneyFounderLed";
import SmartMoneyLeadershipMember from "./pages/SmartMoneyLeadershipMember";
import SmartMoneyInstitutionalAccumulation from "./pages/SmartMoneyInstitutionalAccumulation";
import SmartMoneyPoliticalTrades from "./pages/SmartMoneyPoliticalTrades";
import SmartMoneyExecutiveTurnover from "./pages/SmartMoneyExecutiveTurnover";

const API_BASE = (
  process.env.REACT_APP_API_BASE ||
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "")
).replace(/\/+$/, "");

const DASHBOARD_PRELOAD_CACHE_MS = 2 * 60 * 1000;

function isFreshDashboardPreload() {
  try {
    const raw = localStorage.getItem("bullionaire_preloaded_dashboard_rows");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.data && Date.now() - Number(parsed?.time || 0) < DASHBOARD_PRELOAD_CACHE_MS);
  } catch {
    return false;
  }
}

function scheduleLowPriority(callback, { delay = 0, timeout = 2500 } = {}) {
  let delayId = null;
  let idleId = null;
  let cancelled = false;

  const start = () => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(
        () => {
          if (!cancelled) callback();
        },
        { timeout }
      );
    } else {
      callback();
    }
  };

  delayId = window.setTimeout(start, delay);

  return () => {
    cancelled = true;
    if (delayId) window.clearTimeout(delayId);
    if (idleId && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleId);
    }
  };
}

function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    if (window.gtag) {
      window.gtag("event", "page_view", {
        page_path: location.pathname + location.search,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }, [location.pathname, location.search]);

  return null;
}

function MobileDashboardBlock() {
  const desktopLink = "https://bullionaireiq.com";
  const [copied, setCopied] = useState(false);

  const handleSendToComputer = () => {
    const subject = encodeURIComponent("Open Bullionaire on your computer");
    const body = encodeURIComponent(`Open Bullionaire on your computer:\n\n${desktopLink}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(desktopLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
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

function DesktopProtected({ children }) {
  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  );
}

function AppContent() {
  const location = useLocation();
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

  useEffect(() => {
    const pathname = location.pathname;
    const onDashboard = pathname.startsWith("/dashboard");
    const onStock = pathname.startsWith("/stocks/");
    const onPredictionMarkets = pathname.startsWith("/prediction-markets");
    const onSmartMoney = pathname.startsWith("/smart-money");
    const inWorkspace = onDashboard || onStock || onPredictionMarkets || onSmartMoney;

    if (!inWorkspace) return undefined;

    if (!API_BASE) {
      console.warn("REACT_APP_API_BASE is not configured; skipping API preload.");
      return undefined;
    }

    const controller = new AbortController();
    const cancelScheduled = [];

    const dashboardRowsUrl =
      `${API_BASE}/stocks?page=1&page_size=50&sort_by=Market%20Cap&sort_order=desc`;
    const marketOutlookUrl = `${API_BASE}/market-outlook-snapshot`;
    const spyChartUrl = `${API_BASE}/stocks/SPY/chart?range=1Y`;
    const sectorsUrl = `${API_BASE}/sector-performance`;

    const preloadDashboardRows = async () => {
      if (isFreshDashboardPreload()) return;

      try {
        const res = await fetch(dashboardRowsUrl, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        localStorage.setItem(
          "bullionaire_preloaded_dashboard_rows",
          JSON.stringify({ time: Date.now(), data })
        );
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.warn("Dashboard-row preload failed:", err);
        }
      }
    };

    const warmDashboardSecondaryData = async () => {
      try {
        await Promise.allSettled([
          fetch(marketOutlookUrl, { signal: controller.signal }),
          fetch(spyChartUrl, { signal: controller.signal }),
          fetch(sectorsUrl, { signal: controller.signal }),
        ]);
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.warn("Secondary dashboard preload failed:", err);
        }
      }
    };

    if (onDashboard) {
      // The table is the first thing dashboard users need, so warm it immediately.
      preloadDashboardRows();

      // SPY / Market Outlook / sectors still preload, but only after the dashboard
      // has had time to paint and the main stock table request has priority.
      cancelScheduled.push(
        scheduleLowPriority(warmDashboardSecondaryData, {
          delay: 450,
          timeout: 2200,
        })
      );
    } else if (onStock) {
      // Do not compete with the individual-stock header, live quote, chart, or
      // StockAnalysis background financial warm-up. We still warm dashboard rows
      // later so Back to Dashboard can remain fast.
      cancelScheduled.push(
        scheduleLowPriority(preloadDashboardRows, {
          delay: 2600,
          timeout: 5000,
        })
      );
    } else {
      // Prediction Markets / Smart Money can quietly warm the stock table for a
      // future dashboard visit, but there is no reason to fetch SPY/outlook/sectors.
      cancelScheduled.push(
        scheduleLowPriority(preloadDashboardRows, {
          delay: 1500,
          timeout: 4000,
        })
      );
    }

    return () => {
      cancelScheduled.forEach((cancel) => cancel());
      controller.abort();
    };
  }, [location.pathname]);

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

            <Route path="/smart-money" element={<DesktopProtected isMobile={isMobile}><SmartMoney /></DesktopProtected>} />
            <Route path="/smart-money/insider-transactions" element={<DesktopProtected isMobile={isMobile}><SmartMoneyInsiderTransactions /></DesktopProtected>} />
            <Route path="/smart-money/founder-led" element={<DesktopProtected isMobile={isMobile}><SmartMoneyFounderLed /></DesktopProtected>} />
            <Route path="/smart-money/founder-led/:ticker/:memberId" element={<DesktopProtected isMobile={isMobile}><SmartMoneyLeadershipMember /></DesktopProtected>} />
            <Route path="/smart-money/institutional-accumulation" element={<DesktopProtected isMobile={isMobile}><SmartMoneyInstitutionalAccumulation /></DesktopProtected>} />
            <Route path="/smart-money/political-trades" element={<DesktopProtected isMobile={isMobile}><SmartMoneyPoliticalTrades /></DesktopProtected>} />
            <Route path="/smart-money/executive-turnover" element={<DesktopProtected isMobile={isMobile}><SmartMoneyExecutiveTurnover /></DesktopProtected>} />

            <Route path="/prediction-markets" element={<DesktopProtected isMobile={isMobile}><Dashboard /></DesktopProtected>} />
            <Route path="/prediction-markets/discrepancies" element={<DesktopProtected isMobile={isMobile}><Dashboard /></DesktopProtected>} />
            <Route path="/prediction-markets/value" element={<DesktopProtected isMobile={isMobile}><Dashboard /></DesktopProtected>} />
            <Route path="/dashboard/*" element={<DesktopProtected isMobile={isMobile}><Dashboard /></DesktopProtected>} />
            <Route path="/stocks/:ticker" element={<DesktopProtected isMobile={isMobile}><StockAnalysis /></DesktopProtected>} />
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