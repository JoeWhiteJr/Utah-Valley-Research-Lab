// Registry of all research studies. To add a new study:
//   1. Create a new module here exporting { slug, title, experiments }.
//   2. Require it below and add it to STUDIES.
//   3. Insert a row into the `studies` table (status='draft' until ready).
// The DB tracks metadata + which study a participant is in; the code below
// owns experiment definitions because each one is unique psychology code.

const effortJustification = require('./effort-justification');

const STUDIES = Object.freeze({
  [effortJustification.slug]: effortJustification,
});

function getStudyConfig(slug) {
  return STUDIES[slug] || null;
}

function listStudySlugs() {
  return Object.keys(STUDIES);
}

module.exports = { STUDIES, getStudyConfig, listStudySlugs };
