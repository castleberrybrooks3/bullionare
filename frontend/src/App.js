import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";

import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import About from "./pages/About";
import Footer from "./components/Footer";

// 👇 This component handles page tracking
function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    window.gtag('config', 'G-7L8VKTG3WK', {
      page_path: location.pathname,
    });
  }, [location]);

  return null;
}

function App() {
  return (
    <Router>
      {/* 👇 Add this here */}
      <PageTracker />

      <div className="app-wrapper">
        <main className="page-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}

export default App;