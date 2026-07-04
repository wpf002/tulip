/**
 * Flint layer. THE LLM NEVER DOES ARITHMETIC.
 * @tulip/core computes every number; Flint only narrates and answers NL questions
 * over already-computed results. Every response is checked by the grounding
 * guardrail: a number absent from the engine context is rejected.
 */
import Anthropic from '@anthropic-ai/sdk';
import { verifyGrounded, type GroundingResult } from './guardrail.js';
import { toPlainProse } from './prose.js';

export * from './guardrail.js';
export * from './prose.js';

const SYSTEM_PROMPT = `You are Flint, the financial advisor voice of Tulip.

HARD RULES — never break these:
- You NEVER perform arithmetic. Do not add, subtract, multiply, divide, round,
  or estimate. Every number you state must appear verbatim in the CONTEXT JSON
  you are given (formatting into dollars is fine; computing is not).
- If a question would require a number that is not in the context, say the
  engines haven't computed it yet — do not derive it.
- Be plain-spoken and brief. Explain the "why" behind the engine's numbers.
- Write plain conversational prose. No markdown — no headings, asterisks,
  bullet lists, or bold. Short paragraphs only.
- Money in the context is integer cents unless the key says otherwise. Narrate
  cents values as dollars (123456 cents = $1,234.56).
- Never give generic financial advice detached from the user's data.`;

export interface FlintOptions {
  apiKey?: string;
  model?: string;
}

export interface FlintReply {
  text: string;
  grounding: GroundingResult;
}

export class Flint {
  private client: Anthropic;
  private model: string;

  constructor(options: FlintOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Flint requires ANTHROPIC_API_KEY');
    this.client = new Anthropic({ apiKey });
    this.model = options.model ?? process.env.FLINT_MODEL ?? 'claude-sonnet-4-6';
  }

  private async complete(userContent: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return toPlainProse(text);
  }

  private async guarded(userContent: string, context: unknown): Promise<FlintReply> {
    let text = await this.complete(userContent);
    let grounding = verifyGrounded(text, context);
    if (!grounding.grounded) {
      // One strict retry naming the offending numbers, then surface the result.
      text = await this.complete(
        `${userContent}\n\nIMPORTANT: your previous draft contained numbers not present in the context (${grounding.novelNumbers.join(', ')}). Rewrite using ONLY numbers from the context.`,
      );
      grounding = verifyGrounded(text, context);
    }
    return { text, grounding };
  }

  /** Narrate a structured engine output in plain language. Numbers come from it, only. */
  async explain(recommendation: unknown): Promise<FlintReply> {
    return this.guarded(
      `Explain this engine-computed recommendation to the user in plain language (2-5 sentences).\n\nCONTEXT JSON:\n${JSON.stringify(recommendation, null, 2)}`,
      recommendation,
    );
  }

  /** Answer a natural-language question grounded in already-computed context. */
  async ask(question: string, context: unknown): Promise<FlintReply> {
    return this.guarded(
      `Answer the user's question using ONLY the engine-computed context below.\n\nQUESTION: ${question}\n\nCONTEXT JSON:\n${JSON.stringify(context, null, 2)}`,
      context,
    );
  }
}
