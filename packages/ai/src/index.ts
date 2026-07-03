/**
 * Flint layer. THE LLM NEVER DOES ARITHMETIC.
 * @tulip/core computes every number; Flint only narrates and answers NL questions
 * over already-computed results. This keeps the money math auditable and testable.
 *
 * ROADMAP (Phase 6): wire Anthropic SDK, feed engine outputs as structured context,
 * expose explain(recommendation) and ask(question, userFinancialContext).
 */
export interface ExplainInput {
  recommendation: unknown; // typed engine output from @tulip/core
}

export async function explain(_input: ExplainInput): Promise<string> {
  throw new Error('Flint explain() implemented in Phase 6 — see CLAUDE.md');
}
