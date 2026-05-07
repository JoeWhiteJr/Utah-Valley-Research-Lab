-- Make /api/study/save idempotent: at most one final response per assignment.
-- Snapshot rows (is_snapshot = true) are still allowed to accumulate.
-- Combined with INSERT ... ON CONFLICT DO UPDATE in the route, retries and
-- accidental double-submits update the existing row instead of inflating the
-- export.

CREATE UNIQUE INDEX IF NOT EXISTS study_responses_one_final
    ON study_responses(assignment_id)
    WHERE is_snapshot = false;
