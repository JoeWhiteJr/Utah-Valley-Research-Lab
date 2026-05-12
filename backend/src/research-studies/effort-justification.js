// Effort-justification study (Festinger vs Capaldi).
// Each new study adds a sibling file and registers it in `index.js`.

module.exports = {
  slug: 'effort-justification',
  title: 'Effort Justification & Behavioral Persistence',
  // Maps experiment_name → { prefix, conditions, htmlPath, exportColumns }.
  experiments: {
    treasure_hunt: {
      prefix: 'TH',
      conditions: ['BASELINE', 'HIGH_EFFORT', 'NR_PATTERN', 'RN_PATTERN'],
      htmlPath: '/study-games/experiment1/index.html',
      title: 'Digital Treasure Hunt',
      exportColumns: [
        ['participant_code', d => d.participant_code],
        ['condition', d => d.condition],
        ['assigned_at', d => d.assigned_at],
        ['completed_at', d => d.completed_at],
        ['total_coins', d => d.payload?.total_coins],
        ['extinction_chests_opened', d => d.payload?.extinction_chests_opened ?? 0],
        ['extinction_quit_pressed', d => d.payload?.extinction_quit_pressed ?? false],
        ['start_time', d => d.payload?.start_time],
        ['end_time', d => d.payload?.end_time],
      ],
    },
    career_choice: {
      prefix: 'CC',
      conditions: ['WITHIN_SUBJECTS'],
      htmlPath: '/study-games/experiment2/index.html',
      title: 'Career Choice Study',
      exportColumns: [
        ['participant_code', d => d.participant_code],
        ['condition', d => d.condition],
        ['assigned_at', d => d.assigned_at],
        ['completed_at', d => d.completed_at],
        ['tenure_A', d => d.payload?.scenario_responses?.A?.tenure],
        ['tenure_B', d => d.payload?.scenario_responses?.B?.tenure],
        ['tenure_C', d => d.payload?.scenario_responses?.C?.tenure],
        ['value_A', d => d.payload?.scenario_responses?.A?.value],
        ['value_B', d => d.payload?.scenario_responses?.B?.value],
        ['value_C', d => d.payload?.scenario_responses?.C?.value],
      ],
    },
    pattern_memory: {
      prefix: 'PM',
      conditions: ['NR_PATTERN', 'RANDOM'],
      htmlPath: '/study-games/experiment3/index.html',
      title: 'Pattern Memory Challenge',
      exportColumns: [
        ['participant_code', d => d.participant_code],
        ['condition', d => d.condition],
        ['assigned_at', d => d.assigned_at],
        ['completed_at', d => d.completed_at],
        ['expectation_rating', d => d.payload?.expectation?.rating],
        ['pct_bet_ace', d => d.payload?.betting?.summary?.pct_bet_ace_after_blank],
        ['pattern_detected', d => d.payload?.memory_test?.pattern_detected],
      ],
    },
  },
};
