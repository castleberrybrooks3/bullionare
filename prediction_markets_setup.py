from __future__ import annotations

from db import get_db_connection


SETUP_VERSION = "manual-snapshot-v1.2-rls-private"


# Retired database objects from older prediction-market architectures.
# The new design keeps only the current catalog snapshot in Supabase.
LEGACY_DDL_STATEMENTS = [
    """
    DROP TABLE IF EXISTS
        public.prediction_market_quotes_current
    CASCADE;
    """,
    """
    DROP TABLE IF EXISTS
        public.prediction_market_price_history_1m
    CASCADE;
    """,
    """
    DROP TABLE IF EXISTS
        public.prediction_market_matches
    CASCADE;
    """,
    """
    DROP TABLE IF EXISTS
        public.prediction_market_arbitrage_current
    CASCADE;
    """,
    """
    DROP TABLE IF EXISTS
        public.prediction_sports_contracts
    CASCADE;
    """,
    """
    DROP FUNCTION IF EXISTS
        public.cleanup_prediction_market_data()
    CASCADE;
    """,
    """
    DROP FUNCTION IF EXISTS
        public.touch_prediction_market_updated_at()
    CASCADE;
    """,
]


DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS public.prediction_market_events (
        id BIGSERIAL PRIMARY KEY,

        venue TEXT NOT NULL
            CHECK (venue IN ('polymarket', 'kalshi')),

        external_event_id TEXT NOT NULL,
        external_series_id TEXT,

        title TEXT NOT NULL,
        subtitle TEXT,
        category TEXT,
        event_type TEXT,

        -- The matching engine currently loads status = 'active'. Every
        -- row in this current-only snapshot is normalized to active; the
        -- venue's original status is preserved separately.
        status TEXT NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'unknown')),
        venue_status TEXT,

        start_time TIMESTAMPTZ,
        end_time TIMESTAMPTZ,
        close_time TIMESTAMPTZ,
        settlement_time TIMESTAMPTZ,

        native_game_id TEXT,
        milestone_id TEXT,

        source_id TEXT,
        source_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,

        discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        UNIQUE (venue, external_event_id)
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS prediction_market_events_current_idx
    ON public.prediction_market_events (
        venue,
        status,
        start_time
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS prediction_market_events_series_idx
    ON public.prediction_market_events (
        venue,
        external_series_id
    )
    WHERE external_series_id IS NOT NULL;
    """,
    """
    CREATE INDEX IF NOT EXISTS prediction_market_events_native_game_idx
    ON public.prediction_market_events (
        venue,
        native_game_id
    )
    WHERE native_game_id IS NOT NULL;
    """,
    """
    CREATE INDEX IF NOT EXISTS prediction_market_events_milestone_idx
    ON public.prediction_market_events (
        venue,
        milestone_id
    )
    WHERE milestone_id IS NOT NULL;
    """,
    """
    CREATE TABLE IF NOT EXISTS public.prediction_market_entities (
        id BIGSERIAL PRIMARY KEY,

        venue TEXT NOT NULL
            CHECK (venue IN ('polymarket', 'kalshi')),

        external_entity_id TEXT NOT NULL,

        name TEXT NOT NULL,
        entity_type TEXT,
        league TEXT,
        abbreviation TEXT,
        alias TEXT,

        source_id TEXT,
        source_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,

        discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        UNIQUE (venue, external_entity_id)
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS prediction_market_entities_lookup_idx
    ON public.prediction_market_entities (
        venue,
        entity_type,
        league,
        abbreviation
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS public.prediction_market_event_entities (
        event_id BIGINT NOT NULL
            REFERENCES public.prediction_market_events(id)
            ON DELETE CASCADE,

        entity_id BIGINT NOT NULL
            REFERENCES public.prediction_market_entities(id)
            ON DELETE CASCADE,

        role TEXT NOT NULL DEFAULT 'unknown'
            CHECK (
                role IN (
                    'home',
                    'away',
                    'participant',
                    'subject',
                    'unknown'
                )
            ),

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        PRIMARY KEY (
            event_id,
            entity_id,
            role
        )
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS prediction_market_event_entities_entity_idx
    ON public.prediction_market_event_entities (
        entity_id,
        event_id
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS public.prediction_market_entity_links (
        canonical_entity_key TEXT NOT NULL,

        entity_id BIGINT NOT NULL
            REFERENCES public.prediction_market_entities(id)
            ON DELETE CASCADE,

        match_method TEXT NOT NULL
            CHECK (
                match_method IN (
                    'shared_source_id',
                    'exact_verified_alias',
                    'manual'
                )
            ),

        manual_verified BOOLEAN NOT NULL DEFAULT FALSE,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        PRIMARY KEY (
            canonical_entity_key,
            entity_id
        ),

        UNIQUE (entity_id)
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS prediction_market_entity_links_key_idx
    ON public.prediction_market_entity_links (
        canonical_entity_key
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS public.prediction_market_catalog (
        id BIGSERIAL PRIMARY KEY,

        venue TEXT NOT NULL
            CHECK (venue IN ('polymarket', 'kalshi')),

        event_catalog_id BIGINT
            REFERENCES public.prediction_market_events(id)
            ON DELETE CASCADE,

        external_market_id TEXT NOT NULL,
        external_event_id TEXT,
        external_series_id TEXT,

        event_title TEXT,
        market_title TEXT NOT NULL,
        market_slug TEXT,

        category TEXT,
        market_type TEXT,
        sports_market_type TEXT,

        -- The matching engine currently loads status = 'active'. Every
        -- current contract is normalized to active; the venue's original
        -- status is preserved separately. Exact-match safety rules belong in
        -- the engine rather than in the downloader.
        status TEXT NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'unknown')),
        venue_status TEXT,

        resolution_time TIMESTAMPTZ,
        event_start_time TIMESTAMPTZ,
        close_time TIMESTAMPTZ,
        settlement_time TIMESTAMPTZ,

        accepting_orders BOOLEAN,

        rules_url TEXT,
        rules_primary TEXT,
        rules_secondary TEXT,

        native_condition_id TEXT,
        native_game_id TEXT,
        primary_participant_key TEXT,

        line_value TEXT,
        floor_strike TEXT,
        cap_strike TEXT,
        functional_strike TEXT,

        custom_strike JSONB NOT NULL DEFAULT '{}'::jsonb,
        contract_semantics JSONB NOT NULL DEFAULT '{}'::jsonb,

        -- Generic storage supports binary, multi-outcome, combination,
        -- multivariate, and future venue-specific contract structures.
        outcomes JSONB NOT NULL DEFAULT '[]'::jsonb,
        raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,

        liquidity NUMERIC(24, 8),
        volume_24h NUMERIC(24, 8),
        total_volume NUMERIC(24, 8),
        open_interest NUMERIC(24, 8),

        discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        UNIQUE (
            venue,
            external_market_id
        )
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS prediction_market_catalog_event_fk_idx
    ON public.prediction_market_catalog (
        event_catalog_id
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS prediction_market_catalog_current_idx
    ON public.prediction_market_catalog (
        venue,
        status,
        event_start_time
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS prediction_market_catalog_category_idx
    ON public.prediction_market_catalog (
        category,
        venue
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS prediction_market_catalog_external_event_idx
    ON public.prediction_market_catalog (
        venue,
        external_event_id
    )
    WHERE external_event_id IS NOT NULL;
    """,
    """
    CREATE INDEX IF NOT EXISTS prediction_market_catalog_native_game_idx
    ON public.prediction_market_catalog (
        venue,
        native_game_id
    )
    WHERE native_game_id IS NOT NULL;
    """,
    """
    CREATE INDEX IF NOT EXISTS prediction_market_catalog_participant_idx
    ON public.prediction_market_catalog (
        venue,
        primary_participant_key
    )
    WHERE primary_participant_key IS NOT NULL;
    """,
    """
    CREATE TABLE IF NOT EXISTS public.prediction_market_ingest_runs (
        id BIGSERIAL PRIMARY KEY,

        -- A successful manual refresh covers both venues. Venue-specific
        -- rows remain available for development diagnostics.
        venue TEXT NOT NULL
            CHECK (
                venue IN (
                    'polymarket',
                    'kalshi',
                    'combined'
                )
            ),

        run_type TEXT NOT NULL DEFAULT 'manual_snapshot',

        status TEXT NOT NULL DEFAULT 'running'
            CHECK (
                status IN (
                    'running',
                    'completed',
                    'failed'
                )
            ),

        events_seen INTEGER NOT NULL DEFAULT 0,
        entities_seen INTEGER NOT NULL DEFAULT 0,
        relationships_seen INTEGER NOT NULL DEFAULT 0,
        markets_seen INTEGER NOT NULL DEFAULT 0,

        error_message TEXT,

        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS prediction_market_ingest_runs_started_idx
    ON public.prediction_market_ingest_runs (
        started_at DESC
    );
    """,
]

# These tables are server-side reference/catalog infrastructure. The browser
# never needs direct Supabase Data API access to them. RLS + explicit revokes
# prevent anon/authenticated browser roles from reading or mutating the tables,
# while the backend DATABASE_URL role continues to use direct Postgres access.
SECURITY_DDL_STATEMENTS = [
    *(
        f"ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY;"
        for table_name in (
            "prediction_market_events",
            "prediction_market_entities",
            "prediction_market_event_entities",
            "prediction_market_entity_links",
            "prediction_market_catalog",
            "prediction_market_ingest_runs",
        )
    ),
    *(
        f"REVOKE ALL PRIVILEGES ON TABLE public.{table_name} FROM anon, authenticated;"
        for table_name in (
            "prediction_market_events",
            "prediction_market_entities",
            "prediction_market_event_entities",
            "prediction_market_entity_links",
            "prediction_market_catalog",
            "prediction_market_ingest_runs",
        )
    ),
]


EXPECTED_TABLES = (
    "prediction_market_events",
    "prediction_market_entities",
    "prediction_market_event_entities",
    "prediction_market_entity_links",
    "prediction_market_catalog",
    "prediction_market_ingest_runs",
)


def main() -> None:
    print(f"Setup version: {SETUP_VERSION}")
    print("Creating the manual current-snapshot prediction-market schema...")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for statement in LEGACY_DDL_STATEMENTS:
                cur.execute(statement)

            for statement in DDL_STATEMENTS:
                cur.execute(statement)

            for statement in SECURITY_DDL_STATEMENTS:
                cur.execute(statement)

            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = ANY(%s)
                ORDER BY table_name
                """,
                (list(EXPECTED_TABLES),),
            )

            created_tables = tuple(
                row[0]
                for row in cur.fetchall()
            )

            cur.execute(
                """
                SELECT c.relname
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relname = ANY(%s)
                  AND c.relrowsecurity IS TRUE
                ORDER BY c.relname
                """,
                (list(EXPECTED_TABLES),),
            )
            rls_enabled_tables = tuple(row[0] for row in cur.fetchall())

        conn.commit()

    missing_tables = sorted(
        set(EXPECTED_TABLES)
        - set(created_tables)
    )

    if missing_tables:
        raise RuntimeError(
            "Setup completed, but expected tables are missing: "
            + ", ".join(missing_tables)
        )

    missing_rls = sorted(set(EXPECTED_TABLES) - set(rls_enabled_tables))
    if missing_rls:
        raise RuntimeError(
            "Setup completed, but RLS is not enabled on: "
            + ", ".join(missing_rls)
        )

    print("Prediction-market snapshot schema is ready.")
    print("Current tables:")

    for table_name in created_tables:
        print(f"  - {table_name}")

    print("Browser security:")
    print("  - RLS enabled on all prediction-market snapshot tables")
    print("  - direct anon/authenticated table privileges revoked")

    print("Not created:")
    print("  - no quote snapshot table")
    print("  - no price-history table")
    print("  - no stored matches table")
    print("  - no stored arbitrage table")
    print("  - no recurring cleanup function")
    print("")
    print(
        "Important: this setup script creates schema only. "
        "The service refresh will download both venues first, then "
        "transactionally replace the current snapshot."
    )


if __name__ == "__main__":
    main()