import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SmartMoney.css";
import {
  formatPercent,
  getInfluenceClass,
  normalizeLeadershipCompany,
} from "./SmartMoneyLeadershipData";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";
const LAST_SEARCH_KEY = "bullionaire_founder_led_last_search";

async function fetchLeadershipProfile(query) {
  const cleanQuery = String(query || "").trim();

  if (!cleanQuery) {
    throw new Error("Enter a ticker or company name.");
  }

  const response = await fetch(
    `${API_BASE_URL}/api/smart-money/leadership/${encodeURIComponent(cleanQuery)}`
  );

  const payload = await response.json().catch(() => null);

if (!response.ok) {
  throw new Error(
    payload?.detail ||
      `Leadership request failed with status ${response.status}.`
  );
}

if (!payload || typeof payload !== "object") {
  throw new Error(
    "The leadership API returned an empty response. Check the backend route and deployment."
  );
}

if (!payload.ticker) {
  throw new Error(
    "The leadership API response is missing the ticker field."
  );
}

if (!Array.isArray(payload.members)) {
  payload.members = [];
}

return normalizeLeadershipCompany(payload);
}

export default function SmartMoneyFounderLed() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedSearch = sessionStorage.getItem(LAST_SEARCH_KEY);

    if (!savedSearch) return;

    try {
      const parsed = JSON.parse(savedSearch);
      const savedTicker = parsed?.ticker;

      if (!savedTicker) return;

      setSearch(savedTicker);
      setIsLoading(true);

      fetchLeadershipProfile(savedTicker)
        .then((profile) => {
          setSelectedCompany(profile);
          setSearchError("");
        })
        .catch(() => {
          setSelectedCompany(null);
        })
        .finally(() => setIsLoading(false));
    } catch (err) {
      sessionStorage.removeItem(LAST_SEARCH_KEY);
    }
  }, []);

   const sortedMembers = useMemo(() => {
    if (!selectedCompany) return [];

    const influenceValue = (member) => {
      const disclosedOwnership =
        Number(member?.ownership?.percent) || 0;

      const backendInfluence =
        Number(member?.influenceScore) || 0;

      let roleValue = 0;

      if (member.isFounder) {
        roleValue += 45;
      }

      if (member.isCEO) {
        roleValue += 35;
      }

      if (member.isChairman) {
        roleValue += 20;
      }

      if (member.isDirector) {
        roleValue += 8;
      }

      if (member.seatType === "Executive") {
        roleValue += 12;
      }

      return Math.max(
        disclosedOwnership,
        backendInfluence,
        roleValue
      );
    };

    return [...selectedCompany.members].sort(
      (a, b) => {
        const difference =
          influenceValue(b) -
          influenceValue(a);

        if (difference !== 0) {
          return difference;
        }

        return String(a.name).localeCompare(
          String(b.name)
        );
      }
    );
  }, [selectedCompany]);

  const topMember = sortedMembers[0];
  const remainingMembers = sortedMembers.slice(1);

    const boardCount = useMemo(() => {
    return sortedMembers.filter(
      (member) =>
        member.isDirector === true ||
        member.seatType === "Board Director"
    ).length;
  }, [sortedMembers]);

  const executiveCount = useMemo(() => {
    return sortedMembers.filter(
      (member) =>
        member.seatType === "Executive"
    ).length;
  }, [sortedMembers]);

  const handleSearch = async (event) => {
    event.preventDefault();

    const cleanSearch = search.trim().toUpperCase();

    if (!cleanSearch) {
      setSearchError("Enter a ticker or company name.");
      return;
    }

    setIsLoading(true);
    setSearchError("");

    try {
      const profile = await fetchLeadershipProfile(cleanSearch);

      setSelectedCompany(profile);

      sessionStorage.setItem(
        LAST_SEARCH_KEY,
        JSON.stringify({
          ticker: profile.ticker,
          search: cleanSearch,
          savedAt: Date.now(),
        })
      );
    } catch (err) {
      setSelectedCompany(null);
      setSearchError(
        err.message ||
          "No leadership tree found yet. Run the SEC board leadership script for this ticker first."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const openMemberPage = (member) => {
    if (!selectedCompany || !member?.id) return;

    sessionStorage.setItem(
      LAST_SEARCH_KEY,
      JSON.stringify({
        ticker: selectedCompany.ticker,
        search: selectedCompany.ticker,
        savedAt: Date.now(),
      })
    );

    navigate(`/smart-money/founder-led/${selectedCompany.ticker}/${member.id}`);
  };

  return (
    <div className="founder-terminal-page">
      <section className="founder-terminal-panel leadership-terminal-panel">
        <div className="founder-terminal-top">
          <div>
            <div className="smart-money-kicker">
              Board & Leadership Intelligence
            </div>
            <h1>Board & Leadership Intelligence</h1>
            <p>
              Search a company to map the board, executives, voting influence,
              governance structure, committee clues, and leadership track record.
            </p>
          </div>

          <button
            className="smart-money-secondary-btn"
            type="button"
            onClick={() => navigate("/smart-money")}
          >
            Back
          </button>
        </div>

        <form className="leadership-search-shell" onSubmit={handleSearch}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search a ticker or company... AAPL, MSFT, NVDA, META"
            className="leadership-main-search-input"
          />

          <button
            className="leadership-main-search-button"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Search"}
          </button>
        </form>

        {searchError && (
          <div className="leadership-search-error">{searchError}</div>
        )}

        {isLoading && (
          <div className="leadership-loading-message">
            Pulling saved SEC board and leadership data...
          </div>
        )}

        {!isLoading && !selectedCompany && !searchError && (
          <div className="leadership-empty-state">
            <h2>Search a company to build the leadership map.</h2>
            <p>
              This tab now reads real records from your Supabase
              board_leadership_profiles table instead of mock data.
            </p>
          </div>
        )}

        {selectedCompany && (
          <div className="leadership-results-shell">
            <div className="leadership-results-top">
              <div>
                <div className="smart-money-kicker">
                  {selectedCompany.ticker} Leadership Map
                </div>

                <h2>{selectedCompany.company}</h2>
                <p>{selectedCompany.governanceSummary}</p>

                <div className="leadership-meta-row">
                  <span>{sortedMembers.length} people found</span>
                  <span>{boardCount} board/director records</span>
                  <span>{executiveCount} executive records</span>
                  {selectedCompany.dataQualityScore !== undefined && (
                    <span>Data score: {selectedCompany.dataQualityScore}/100</span>
                  )}
                  {selectedCompany.sourceForm && (
                    <span>
                      Source: {selectedCompany.sourceForm}
                      {selectedCompany.sourceFilingDate
                        ? ` filed ${selectedCompany.sourceFilingDate}`
                        : ""}
                    </span>
                  )}
                </div>
              </div>

              <span>
                {selectedCompany.dataStatus === "needs_review"
                  ? "Needs Review"
                  : "Real SEC Data"}
              </span>
            </div>

            <div className="leadership-tree-stage">
              {topMember && (
                <button
                  type="button"
                  className={`leadership-node leadership-node-top ${getInfluenceClass(
                    topMember
                  )}`}
                  onClick={() => openMemberPage(topMember)}
                >
                  <span>
  {topMember.isCEO
    ? "Chief Executive Officer"
    : topMember.isChairman
    ? "Board Chair"
    : topMember.seatType}
</span>
                  <strong>{topMember.name}</strong>
                  <p>{topMember.role}</p>
                  <small>
  {topMember.ownership.percent !== null
    ? `${formatPercent(
        topMember.ownership.percent
      )} ownership`
    : "View executive intelligence"}
</small>
                </button>
              )}

              {remainingMembers.length > 0 && (
                <div className="leadership-tree-connector" />
              )}

              <div className="leadership-node-grid">
                {remainingMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className={`leadership-node ${getInfluenceClass(member)}`}
                    onClick={() => openMemberPage(member)}
                  >
                    <span>{member.seatType}</span>
                    <strong>{member.name}</strong>
                    <p>{member.role}</p>
                    <small>
  {member.ownership.percent !== null
    ? `${formatPercent(
        member.ownership.percent
      )} ownership`
    : "View executive intelligence"}
</small>
                  </button>
                ))}
              </div>
            </div>

            {selectedCompany.sourceUrl && (
              <a
                className="leadership-source-link"
                href={selectedCompany.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open SEC source filing
              </a>
            )}
          </div>
        )}
      </section>
    </div>
  );
}