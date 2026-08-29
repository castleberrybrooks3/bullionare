import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import "./SmartMoney.css";
import {
  formatInteger,
  formatMoney,
  formatPercent,
  normalizeLeadershipCompany,
} from "./SmartMoneyLeadershipData";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  "http://localhost:8000";

const LAST_SEARCH_KEY =
  "bullionaire_founder_led_last_search";

async function fetchLeadershipProfile(ticker) {
  const response = await fetch(
    `${API_BASE_URL}/api/smart-money/leadership/${encodeURIComponent(
      ticker
    )}`
  );

  const payload = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.detail ||
        `Leadership request failed with status ${response.status}.`
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new Error(
      "The leadership API returned an empty response."
    );
  }

  if (!Array.isArray(payload.members)) {
    payload.members = [];
  }

  return normalizeLeadershipCompany(payload);
}

function YesNoBadge({ value }) {
  return (
    <span
      className={`executive-boolean-badge ${
        value ? "yes" : "no"
      }`}
    >
      {value ? "✓" : "✕"}
    </span>
  );
}

function EmptyValue({
  children = "Not disclosed",
}) {
  return (
    <span className="executive-empty-value">
      {children}
    </span>
  );
}

function TimelineItem({
  item,
  isLast,
}) {
  const start =
    item.startYear || "Start not disclosed";

  const end =
    item.current === true
      ? "Present"
      : item.endYear ||
        "End not disclosed";

  return (
    <div className="executive-timeline-item">
      <div className="executive-timeline-marker">
        <span />
        {!isLast && <i />}
      </div>

      <div className="executive-timeline-content">
        <div className="executive-timeline-years">
          {start}–{end}
        </div>

        <h3>{item.company}</h3>

        <strong>{item.role}</strong>

        {item.description && (
          <p>{item.description}</p>
        )}
      </div>
    </div>
  );
}

function BoardList({
  title,
  items,
}) {
  return (
    <section className="executive-section-card">
      <div className="executive-section-heading">
        <div>
          <span>Board Experience</span>
          <h2>{title}</h2>
        </div>
      </div>

      {items?.length ? (
        <div className="executive-record-list">
          {items.map((item) => (
            <div
              className="executive-record-row"
              key={item.id}
            >
              <div>
                <strong>{item.company}</strong>
                <p>{item.role}</p>
              </div>

              <span>
                {item.current === true
                  ? "Current"
                  : item.current === false
                  ? "Former"
                  : "Status not disclosed"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyValue />
      )}
    </section>
  );
}

export default function SmartMoneyLeadershipMember() {
  const navigate = useNavigate();

  const {
    ticker,
    memberId,
  } = useParams();

  const cleanTicker =
    ticker?.toUpperCase();

  const [company, setCompany] =
    useState(null);

  const [error, setError] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(true);

  useEffect(() => {
    if (!cleanTicker) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    fetchLeadershipProfile(cleanTicker)
      .then((profile) => {
        setCompany(profile);

        sessionStorage.setItem(
          LAST_SEARCH_KEY,
          JSON.stringify({
            ticker: profile.ticker,
            search: profile.ticker,
            savedAt: Date.now(),
          })
        );
      })
      .catch((err) => {
        setCompany(null);
        setError(
          err.message ||
            "Leadership profile not found."
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [cleanTicker]);

  const member = useMemo(() => {
    return company?.members.find(
      (item) => item.id === memberId
    );
  }, [
    company,
    memberId,
  ]);

  const previousEmployers = useMemo(() => {
    if (!member) return [];

    const currentCompany =
      company?.company?.toLowerCase();

    const unique = new Map();

    (member.careerTimeline || []).forEach(
      (item) => {
        const companyName =
          item.company.toLowerCase();

        if (
          companyName === currentCompany ||
          companyName.includes(
            currentCompany?.split(" ")[0] || ""
          )
        ) {
          return;
        }

        if (!unique.has(companyName)) {
          unique.set(
            companyName,
            item.company
          );
        }
      }
    );

    return [...unique.values()];
  }, [
    member,
    company,
  ]);

  const yearsAtCompany = useMemo(() => {
    if (!member?.joinedCompanyYear) {
      return null;
    }

    return (
      new Date().getFullYear() -
      member.joinedCompanyYear
    );
  }, [member]);

  const yearsInCurrentRole =
    useMemo(() => {
      if (!member?.roleStartYear) {
        return null;
      }

      return (
        new Date().getFullYear() -
        member.roleStartYear
      );
    }, [member]);

  if (isLoading) {
    return (
      <div className="founder-terminal-page">
        <section className="founder-terminal-panel leadership-terminal-panel">
          <div className="leadership-loading-message">
            Loading executive intelligence...
          </div>
        </section>
      </div>
    );
  }

  if (!company || !member || error) {
    return (
      <div className="founder-terminal-page">
        <section className="founder-terminal-panel leadership-terminal-panel">
          <div className="founder-terminal-top">
            <div>
              <div className="smart-money-kicker">
                Executive Intelligence
              </div>

              <h1>
                Leadership profile not found
              </h1>

              <p>
                {error ||
                  "This person was not found in the latest saved leadership data."}
              </p>
            </div>

            <button
              className="smart-money-secondary-btn"
              type="button"
              onClick={() =>
                navigate(
                  "/smart-money/founder-led"
                )
              }
            >
              Back to Leadership Map
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="founder-terminal-page">
      <section className="founder-terminal-panel leadership-terminal-panel executive-intelligence-page">
        <div className="executive-profile-header">
          <div>
            <div className="smart-money-kicker">
              {company.ticker} Executive Intelligence
            </div>

            <h1>{member.name}</h1>

            <p>
              {member.companyRole}
              {" — "}
              {company.company}
            </p>
          </div>

          <button
            className="smart-money-secondary-btn"
            type="button"
            onClick={() =>
              navigate(
                "/smart-money/founder-led"
              )
            }
          >
            ← Back to Leadership Map
          </button>
        </div>

        <section className="executive-hero-card">
          <div className="executive-role-flags">
            <div>
              <span>CEO</span>
              <YesNoBadge
                value={member.isCEO}
              />
            </div>

            <div>
              <span>Director</span>
              <YesNoBadge
                value={member.isDirector}
              />
            </div>

            <div>
              <span>Founder</span>
              <YesNoBadge
                value={member.isFounder}
              />
            </div>

            <div>
              <span>Chairman</span>
              <YesNoBadge
                value={member.isChairman}
              />
            </div>
          </div>

          <div className="executive-snapshot-grid">
            <div>
              <span>Ownership</span>
              <strong>
                {formatPercent(
                  member.ownership.percent
                )}
              </strong>
            </div>

            <div>
              <span>Voting Rights</span>
              <strong>
                {formatPercent(
                  member.ownership.votingPercent
                )}
              </strong>
            </div>

            <div>
              <span>
                Joined {company.ticker}
              </span>
              <strong>
                {member.joinedCompanyYear ||
                  "Not disclosed"}
              </strong>
            </div>

            <div>
              <span>
                Current Role Since
              </span>
              <strong>
                {member.roleStartYear ||
                  "Not disclosed"}
              </strong>
            </div>

            <div>
              <span>
                Director Since
              </span>
              <strong>
                {member.directorSince ||
                  "Not disclosed"}
              </strong>
            </div>

            <div>
              <span>
                Independent
              </span>
              <strong>
                {member.independent === true
                  ? "Yes"
                  : member.independent === false
                  ? "No"
                  : "Not disclosed"}
              </strong>
            </div>
          </div>
        </section>

        <div className="executive-two-column-grid">
          <section className="executive-section-card">
            <div className="executive-section-heading">
              <div>
                <span>
                  Company Leadership
                </span>
                <h2>
                  Leadership Snapshot
                </h2>
              </div>
            </div>

            <div className="executive-fact-list">
              <div>
                <span>Current Role</span>
                <strong>
                  {member.companyRole}
                </strong>
              </div>

              <div>
                <span>Seat Type</span>
                <strong>
                  {member.seatType}
                </strong>
              </div>

              <div>
                <span>
                  Years at Company
                </span>
                <strong>
                  {yearsAtCompany ??
                    "Not disclosed"}
                </strong>
              </div>

              <div>
                <span>
                  Years in Current Role
                </span>
                <strong>
                  {yearsInCurrentRole ??
                    "Not disclosed"}
                </strong>
              </div>

              <div>
                <span>Age</span>
                <strong>
                  {member.age ||
                    "Not disclosed"}
                </strong>
              </div>
            </div>
          </section>

          <section className="executive-section-card">
            <div className="executive-section-heading">
              <div>
                <span>Governance</span>
                <h2>
                  Committee Memberships
                </h2>
              </div>
            </div>

            {member.committees?.length ? (
              <div className="executive-tag-list">
                {member.committees.map(
                  (committee) => (
                    <span key={committee}>
                      {committee}
                    </span>
                  )
                )}
              </div>
            ) : (
              <EmptyValue />
            )}
          </section>
        </div>

        <section className="executive-section-card">
          <div className="executive-section-heading">
            <div>
              <span>
                Professional History
              </span>

              <h2>
                Career Timeline
              </h2>
            </div>
          </div>

          {member.careerTimeline?.length ? (
            <div className="executive-timeline">
              {member.careerTimeline.map(
                (item, index) => (
                  <TimelineItem
                    key={item.id}
                    item={item}
                    isLast={
                      index ===
                      member.careerTimeline
                        .length -
                        1
                    }
                  />
                )
              )}
            </div>
          ) : (
            <EmptyValue>
              Career history has not yet been parsed.
            </EmptyValue>
          )}
        </section>

        <div className="executive-two-column-grid">
          <section className="executive-section-card">
            <div className="executive-section-heading">
              <div>
                <span>
                  Professional History
                </span>

                <h2>
                  Previous Employers
                </h2>
              </div>
            </div>

            {previousEmployers.length ? (
              <div className="executive-simple-list">
                {previousEmployers.map(
                  (employer) => (
                    <div key={employer}>
                      {employer}
                    </div>
                  )
                )}
              </div>
            ) : (
              <EmptyValue />
            )}
          </section>

          <section className="executive-section-card">
            <div className="executive-section-heading">
              <div>
                <span>Education</span>

                <h2>
                  Education
                </h2>
              </div>
            </div>

            {member.education?.length ? (
              <div className="executive-record-list">
                {member.education.map(
                  (item) => (
                    <div
                      className="executive-record-row"
                      key={item.id}
                    >
                      <div>
                        <strong>
                          {item.school}
                        </strong>

                        <p>
                          {[
                            item.degree,
                            item.field,
                          ]
                            .filter(Boolean)
                            .join(" — ") ||
                            "Degree not disclosed"}
                        </p>
                      </div>

                      {item.graduationYear && (
                        <span>
                          {
                            item.graduationYear
                          }
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>
            ) : (
              <EmptyValue />
            )}
          </section>
        </div>

        <div className="executive-two-column-grid">
          <BoardList
            title="Current Boards"
            items={member.currentBoards}
          />

          <BoardList
            title="Former Boards"
            items={member.formerBoards}
          />
        </div>

        <section className="executive-section-card">
          <div className="executive-section-heading">
            <div>
              <span>Ownership</span>

              <h2>
                Ownership & Voting
              </h2>
            </div>
          </div>

          <div className="executive-snapshot-grid">
            <div>
              <span>
                Beneficial Shares
              </span>

              <strong>
                {formatInteger(
                  member.ownership.shares
                )}
              </strong>
            </div>

            <div>
              <span>
                Ownership Percentage
              </span>

              <strong>
                {formatPercent(
                  member.ownership.percent
                )}
              </strong>
            </div>

            <div>
              <span>
                Voting Percentage
              </span>

              <strong>
                {formatPercent(
                  member.ownership.votingPercent
                )}
              </strong>
            </div>

            <div>
              <span>
                Ownership As Of
              </span>

              <strong>
                {member.ownership
                  .asOfDate ||
                  "Not disclosed"}
              </strong>
            </div>
          </div>
        </section>

        <section className="executive-section-card">
          <div className="executive-section-heading">
            <div>
              <span>
                Executive Pay
              </span>

              <h2>
                Compensation
              </h2>
            </div>
          </div>

          <div className="executive-compensation-grid">
            <div>
              <span>Year</span>
              <strong>
                {member.compensation.year ||
                  "Not disclosed"}
              </strong>
            </div>

            <div>
              <span>Salary</span>
              <strong>
                {formatMoney(
                  member.compensation.salary
                )}
              </strong>
            </div>

            <div>
              <span>Bonus</span>
              <strong>
                {formatMoney(
                  member.compensation.bonus
                )}
              </strong>
            </div>

            <div>
              <span>Stock Awards</span>
              <strong>
                {formatMoney(
                  member.compensation
                    .stockAwards
                )}
              </strong>
            </div>

            <div>
              <span>
                Option Awards
              </span>
              <strong>
                {formatMoney(
                  member.compensation
                    .optionAwards
                )}
              </strong>
            </div>

            <div>
              <span>
                Other Compensation
              </span>
              <strong>
                {formatMoney(
                  member.compensation
                    .otherCompensation
                )}
              </strong>
            </div>

            <div className="executive-compensation-total">
              <span>
                Total Compensation
              </span>
              <strong>
                {formatMoney(
                  member.compensation.total
                )}
              </strong>
            </div>
          </div>
        </section>

        <section className="executive-section-card">
          <div className="executive-section-heading">
            <div>
              <span>Background</span>

              <h2>Biography</h2>
            </div>
          </div>

          {member.biography ? (
            <p className="executive-biography">
              {member.biography}
            </p>
          ) : (
            <EmptyValue>
              Biography has not yet been parsed.
            </EmptyValue>
          )}
        </section>

        <section className="executive-section-card">
          <div className="executive-section-heading">
            <div>
              <span>
                Key Takeaways
              </span>

              <h2>
                Leadership Summary
              </h2>
            </div>
          </div>

          {member.leadershipSummary
            ?.length ? (
            <ul className="executive-summary-list">
              {member.leadershipSummary.map(
                (item, index) => (
                  <li
                    key={`${member.id}-summary-${index}`}
                  >
                    {item}
                  </li>
                )
              )}
            </ul>
          ) : (
            <EmptyValue>
              Leadership analysis has not yet been generated.
            </EmptyValue>
          )}
        </section>

        <div className="executive-source-row">
          {member.sourceUrl && (
            <a
              className="leadership-source-link"
              href={member.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open member source
            </a>
          )}

          {company.sourceUrl && (
            <a
              className="leadership-source-link"
              href={company.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open SEC source filing
            </a>
          )}

          {company.secCompanyUrl && (
            <a
              className="leadership-source-link"
              href={company.secCompanyUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open SEC company page
            </a>
          )}
        </div>
      </section>
    </div>
  );
}