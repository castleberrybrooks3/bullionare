export function slugifyName(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;

  const cleaned = String(value).replace(/\s+/g, " ").trim();

  return cleaned || fallback;
}

const INVALID_LEADERSHIP_NAMES = [
  "additional information",
  "annual meeting",
  "annual meeting of stockholders",
  "business overview",
  "control number",
  "diversity equity and inclusion",
  "diversity, equity, and inclusion",
  "enterprise risk management",
  "equity award adjustments",
  "exchange act",
  "financial expert",
  "financial community",
  "fiscal year",
  "greenhouse gas emissions",
  "human capital management",
  "industry and technical",
  "industry & technical",
  "internal revenue code",
  "majority vote standard",
  "management proposals",
  "my psus",
  "non-gaap operating income",
  "other matters",
  "pay ratio",
  "pay versus performance",
  "performance metrics",
  "public policy engagement",
  "registered public accounting firm",
  "related persons",
  "risk oversight",
  "simple majority vote standard",
  "stockholder proposals",
  "stockholder special meeting right",
  "summary compensation table",
  "sy psus",
  "variable cash plan",
  "vote required for approval",
  "what we do",
  "what we don't",
  "what we don’t do",
];

const ORGANIZATION_NAME_PATTERNS = [
  /\binc\.?$/i,
  /\bcorp\.?$/i,
  /\bcorporation$/i,
  /\bcompany$/i,
  /\bllc$/i,
  /\bllp$/i,
  /\bl\.p\.?$/i,
  /\bplc$/i,
  /\bfoundation$/i,
  /\bholdings$/i,
  /\bmanagement$/i,
  /\bpartners$/i,
  /\bventures$/i,
];

export function isLikelyLeadershipPerson(
  member = {}
) {
  const name = cleanText(member.name);
  const lowered = name.toLowerCase();

  if (!name) return false;
  if (name.length < 5 || name.length > 70) {
    return false;
  }

  if (/\d/.test(name)) {
    return false;
  }

  if (
    INVALID_LEADERSHIP_NAMES.some((phrase) =>
      lowered.includes(phrase)
    )
  ) {
    return false;
  }

  if (
    ORGANIZATION_NAME_PATTERNS.some((pattern) =>
      pattern.test(name)
    )
  ) {
    return false;
  }

  const words = name
    .replace(/[(),;:|]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < 2 || words.length > 6) {
    return false;
  }

  const nameLikeWords = words.filter((word) => {
    const cleaned = word.replace(/[.'’\-]/g, "");

    return (
      /^[A-Z]$/.test(cleaned) ||
      /^[A-Z][A-Za-z]+$/.test(cleaned)
    );
  });

  return nameLikeWords.length >= 2;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(
    String(value).replace(/[^0-9.-]/g, "")
  );

  return Number.isFinite(parsed) ? parsed : null;
}

function integerOrNull(value) {
  const parsed = numberOrNull(value);

  if (parsed === null) return null;

  return Math.trunc(parsed);
}

function normalizeBoolean(value) {
  if (value === true || value === false) {
    return value;
  }

  if (value === 1 || value === "1") {
    return true;
  }

  if (value === 0 || value === "0") {
    return false;
  }

  const text = cleanText(value).toLowerCase();

  if (["yes", "true", "current"].includes(text)) {
    return true;
  }

  if (["no", "false", "former"].includes(text)) {
    return false;
  }

  return null;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function formatPercent(value, fallback = "Not disclosed") {
  const parsed = numberOrNull(value);

  if (parsed === null) return fallback;

  return `${parsed.toFixed(
    parsed >= 10 ? 1 : parsed >= 1 ? 2 : 3
  )}%`;
}

export function formatInteger(value, fallback = "Not disclosed") {
  const parsed = numberOrNull(value);

  if (parsed === null) return fallback;

  return Math.round(parsed).toLocaleString();
}

export function formatMoney(value, fallback = "Not disclosed") {
  const parsed = numberOrNull(value);

  if (parsed === null) return fallback;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: parsed >= 1000000 ? "compact" : "standard",
    maximumFractionDigits: parsed >= 1000000 ? 1 : 0,
  }).format(parsed);
}

export function getMemberId(member) {
  return (
    member?.id ||
    member?.memberId ||
    slugifyName(member?.name)
  );
}

function roleContains(role, values) {
  const text = cleanText(role).toLowerCase();

  return values.some((value) =>
    new RegExp(
      `(^|[^a-z0-9])${value}([^a-z0-9]|$)`,
      "i"
    ).test(text)
  );
}

function inferSeatType(role = "") {
  if (roleContains(role, ["chief", "ceo", "cfo", "coo", "cto"])) {
    return "Executive";
  }

  if (roleContains(role, ["chair", "chairman", "director", "board"])) {
    return "Board Director";
  }

  return "Leadership";
}

function normalizeCareerItem(item = {}, index = 0) {
  return {
    id:
      cleanText(item.id) ||
      `${slugifyName(item.company)}-${slugifyName(
        item.role
      )}-${index}`,

    company: cleanText(
      item.company ||
        item.employer ||
        item.organization,
      "Unknown organization"
    ),

    role: cleanText(
      item.role ||
        item.title ||
        item.position,
      "Position not disclosed"
    ),

    startYear: integerOrNull(
      item.startYear ??
        item.start_year ??
        item.fromYear ??
        item.from_year
    ),

    endYear: integerOrNull(
      item.endYear ??
        item.end_year ??
        item.toYear ??
        item.to_year
    ),

    current:
      normalizeBoolean(item.current) ??
      (item.endYear === null &&
        item.end_year === null
        ? null
        : false),

    description: cleanText(
      item.description ||
        item.summary ||
        item.details
    ),

    sourceUrl: cleanText(
      item.sourceUrl ||
        item.source_url
    ),
  };
}

function normalizeEducationItem(item = {}, index = 0) {
  return {
    id:
      cleanText(item.id) ||
      `${slugifyName(item.school)}-${index}`,

    school: cleanText(
      item.school ||
        item.institution ||
        item.university,
      "Institution not disclosed"
    ),

    degree: cleanText(
      item.degree ||
        item.credential
    ),

    field: cleanText(
      item.field ||
        item.fieldOfStudy ||
        item.field_of_study ||
        item.major
    ),

    graduationYear: integerOrNull(
      item.graduationYear ??
        item.graduation_year ??
        item.year
    ),

    sourceUrl: cleanText(
      item.sourceUrl ||
        item.source_url
    ),
  };
}

function normalizeBoardItem(item = {}, index = 0) {
  return {
    id:
      cleanText(item.id) ||
      `${slugifyName(item.company)}-${index}`,

    company: cleanText(
      item.company ||
        item.organization,
      "Organization not disclosed"
    ),

    role: cleanText(
      item.role ||
        item.title,
      "Board Member"
    ),

    current: normalizeBoolean(
      item.current ??
        item.isCurrent ??
        item.is_current
    ),

    startYear: integerOrNull(
      item.startYear ??
        item.start_year
    ),

    endYear: integerOrNull(
      item.endYear ??
        item.end_year
    ),

    sourceUrl: cleanText(
      item.sourceUrl ||
        item.source_url
    ),
  };
}

function normalizeOwnership(member = {}) {
  const ownership =
    member.ownership &&
    typeof member.ownership === "object"
      ? member.ownership
      : {};

  return {
    shares: numberOrNull(
      ownership.shares ??
        member.ownershipShares ??
        member.ownership_shares ??
        member.sharesOwned ??
        member.shares_owned
    ),

    percent: numberOrNull(
      ownership.percent ??
        member.ownershipPercent ??
        member.ownership_percent ??
        member.percentOwned ??
        member.percent_owned
    ),

    votingPercent: numberOrNull(
      ownership.votingPercent ??
        ownership.voting_percent ??
        member.votingPercent ??
        member.voting_percent ??
        member.votingPower ??
        member.voting_power
    ),

    asOfDate: cleanText(
      ownership.asOfDate ??
        ownership.as_of_date ??
        member.ownershipAsOfDate ??
        member.ownership_as_of_date
    ),
  };
}

function normalizeCompensation(member = {}) {
  const compensation =
    member.compensation &&
    typeof member.compensation === "object"
      ? member.compensation
      : {};

  return {
    year: integerOrNull(
      compensation.year ??
        member.compensationYear ??
        member.compensation_year
    ),

    salary: numberOrNull(
      compensation.salary
    ),

    bonus: numberOrNull(
      compensation.bonus ??
        compensation.cashBonus ??
        compensation.cash_bonus
    ),

    stockAwards: numberOrNull(
      compensation.stockAwards ??
        compensation.stock_awards
    ),

    optionAwards: numberOrNull(
      compensation.optionAwards ??
        compensation.option_awards
    ),

    otherCompensation: numberOrNull(
      compensation.otherCompensation ??
        compensation.other_compensation
    ),

    total: numberOrNull(
      compensation.total ??
        compensation.totalCompensation ??
        compensation.total_compensation
    ),
  };
}

function buildHistoryFromMember(member, role) {
  const history = [];

  if (member.age) {
    history.push(
      `Age listed in filing: ${member.age}.`
    );
  }

  if (member.directorSince) {
    history.push(
      `Director since ${member.directorSince}.`
    );
  }

  if (member.joinedCompanyYear) {
    history.push(
      `Joined the company in ${member.joinedCompanyYear}.`
    );
  }

  if (member.roleStartYear) {
    history.push(
      `Began the current role in ${member.roleStartYear}.`
    );
  }

  if (member.committees?.length) {
    history.push(
      `Committee memberships: ${member.committees.join(
        ", "
      )}.`
    );
  }

  history.push(
    `${role} identified from the latest available filing.`
  );

  return history;
}

export function normalizeLeadershipMember(
  member = {},
  index = 0
) {
  const name = cleanText(
    member.name,
    `Leadership Member ${index + 1}`
  );

  const companyRole = cleanText(
    member.companyRole ??
      member.company_role ??
      member.role ??
      member.title ??
      member.position,
    "Leadership"
  );

  const seatType = cleanText(
    member.seatType ??
      member.seat_type ??
      member.category,
    inferSeatType(companyRole)
  );

  const ownership = normalizeOwnership(member);
  const compensation = normalizeCompensation(member);

  const careerTimeline = normalizeArray(
    member.careerTimeline ??
      member.career_timeline ??
      member.previousPositions ??
      member.previous_positions
  ).map(normalizeCareerItem);

  const education = normalizeArray(
    member.education
  ).map(normalizeEducationItem);

  const currentBoards = normalizeArray(
    member.currentBoards ??
      member.current_boards
  ).map(normalizeBoardItem);

  const formerBoards = normalizeArray(
    member.formerBoards ??
      member.former_boards ??
      member.outsideBoards ??
      member.outside_boards
  ).map(normalizeBoardItem);

  const roleText = `${companyRole} ${seatType}`;

  const normalized = {
    ...member,

    id: getMemberId({
      ...member,
      name,
    }),

    name,
    role: companyRole,
    title: companyRole,
    companyRole,

    outsideRole: cleanText(
      member.outsideRole ??
        member.outside_role
    ),

    seatType,

    isCEO:
      normalizeBoolean(
        member.isCEO ??
          member.is_ceo
      ) ??
      roleContains(roleText, [
        "ceo",
        "chief executive officer",
      ]),

    isDirector:
      normalizeBoolean(
        member.isDirector ??
          member.is_director
      ) ??
      roleContains(roleText, [
        "director",
        "board",
      ]),

    isFounder:
      normalizeBoolean(
        member.isFounder ??
          member.is_founder
      ) ??
      roleContains(roleText, ["founder"]),

    isChairman:
      normalizeBoolean(
        member.isChairman ??
          member.is_chairman
      ) ??
      roleContains(roleText, [
        "chair",
        "chairman",
        "chairwoman",
      ]),

    independent:
      normalizeBoolean(
        member.independent ??
          member.isIndependent ??
          member.is_independent
      ),

    age: integerOrNull(member.age),

    directorSince: cleanText(
      member.directorSince ??
        member.director_since
    ),

    joinedCompanyYear: integerOrNull(
      member.joinedCompanyYear ??
        member.joined_company_year
    ),

    roleStartYear: integerOrNull(
      member.roleStartYear ??
        member.role_start_year ??
        member.currentRoleStartYear ??
        member.current_role_start_year
    ),

    ownership,

    ownershipPercent: ownership.percent,
    votingPercent: ownership.votingPercent,

    committees: normalizeArray(
      member.committees
    ).map((item) =>
      typeof item === "string"
        ? item
        : cleanText(
            item.name ||
              item.committee
          )
    ),

    careerTimeline,
    education,
    currentBoards,
    formerBoards,
    compensation,

    biography: cleanText(
      member.biography ??
        member.bio ??
        member.background
    ),

    leadershipSummary: normalizeArray(
      member.leadershipSummary ??
        member.leadership_summary ??
        member.summaryPoints ??
        member.summary_points
    ).map((item) => cleanText(item)),

    connections: normalizeArray(
      member.connections
    ),

    sourceUrl: cleanText(
      member.sourceUrl ??
        member.source_url
    ),

    parserConfidence: cleanText(
      member.parserConfidence ??
        member.parser_confidence
    ),
  };

  normalized.history = Array.isArray(
    member.history
  )
    ? member.history.filter(Boolean)
    : buildHistoryFromMember(
        normalized,
        companyRole
      );

  return normalized;
}

export function normalizeLeadershipCompany(company) {
  if (!company || typeof company !== "object") {
    throw new Error(
      "The leadership API returned an empty or invalid profile."
    );
  }

  const rawMembers = Array.isArray(
    company.members
  )
    ? company.members
    : [];

  const members = rawMembers
    .filter(isLikelyLeadershipPerson)
    .map(normalizeLeadershipMember);

  return {
    ...company,

    ticker: cleanText(
      company.ticker
    ).toUpperCase(),

    company: cleanText(
      company.company ?? company.name,
      "Unknown Company"
    ),

    governanceSummary: cleanText(
      company.governanceSummary ??
        company.governance_summary,
      "Leadership data pulled from the latest available SEC filing."
    ),

    dataStatus: cleanText(
      company.dataStatus ??
        company.data_status,
      "ready"
    ),

    dataQualityScore:
      numberOrNull(
        company.dataQualityScore ??
          company.data_quality_score
      ) ?? 0,

    sourceForm: cleanText(
      company.sourceForm ??
        company.source_form
    ),

    sourceFilingDate: cleanText(
      company.sourceFilingDate ??
        company.source_filing_date
    ),

    sourceUrl: cleanText(
      company.sourceUrl ??
        company.source_url
    ),

    secCompanyUrl: cleanText(
      company.secCompanyUrl ??
        company.sec_company_url
    ),

    boardMemberCount:
      numberOrNull(
        company.boardMemberCount ??
          company.board_member_count
      ) ?? 0,

    executiveCount:
      numberOrNull(
        company.executiveCount ??
          company.executive_count
      ) ?? 0,

    memberCount: members.length,

    boardMemberCount: members.filter(
      (member) =>
        member.isDirector === true ||
        member.seatType === "Board Director"
    ).length,

    executiveCount: members.filter(
      (member) =>
        member.seatType === "Executive"
    ).length,

    members,
  };
}

export function getInfluenceClass(member) {
  if (!member) return "low";

  if (member.isCEO || member.isFounder) {
    return "top";
  }

  if (member.isChairman) {
    return "high";
  }

  if (member.isDirector) {
    return "medium";
  }

  return "low";
}