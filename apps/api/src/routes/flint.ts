import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DebtType, prisma } from '@tulip/db';
import { cents, planPayoff, routeNextDollar, type Loan, type RouterProfile } from '@tulip/core';
import { Flint } from '@tulip/ai';
import { computeNetWorth } from './networth.js';

const bpsToDecimal = (bps: number) => bps / 10000;

/**
 * Assemble the user's ALREADY-COMPUTED financial context. Every number Flint
 * may utter comes from here — the engines compute, Flint narrates.
 */
async function buildContext(userId: string) {
  const [netWorth, debts] = await Promise.all([
    computeNetWorth(userId),
    prisma.debt.findMany({ where: { userId, balanceCents: { gt: 0n } } }),
  ]);

  const consumer = debts.filter((d) => d.type !== DebtType.MORTGAGE);
  const loans: Loan[] = consumer.map((d) => ({
    id: d.id,
    name: d.name,
    balance: cents(Number(d.balanceCents)),
    aprAnnual: bpsToDecimal(d.aprBps),
    minPayment: cents(Number(d.minPaymentCents)),
  }));

  let debtPlan = null;
  try {
    if (loans.length > 0) {
      const plan = planPayoff(loans, cents(20000), 'avalanche', new Date());
      debtPlan = {
        strategy: plan.strategy,
        assumedExtraMonthlyCents: 20000,
        debtFreeDate: plan.debtFreeDate,
        monthsToDebtFree: plan.monthsToDebtFree,
        totalInterestCents: Number(plan.totalInterest),
        payoffOrder: plan.payoffOrder.map((p) => ({
          name: p.name,
          payoffMonth: p.payoffMonth,
          interestPaidCents: Number(p.interestPaid),
        })),
      };
    }
  } catch {
    debtPlan = null; // non-amortizing minimums — leave it out rather than guess
  }

  const profile: RouterProfile = {
    marginalTaxRate: 0.24,
    expectedMarketReturn: 0.07,
    debts: consumer.map((d) => ({
      id: d.id,
      name: d.name,
      aprAnnual: bpsToDecimal(d.aprBps),
      balance: cents(Number(d.balanceCents)),
    })),
    taxableInvesting: true,
  };
  const routed = routeNextDollar(cents(50000), profile).map((r) => ({
    label: r.opportunity.label,
    amountCents: Number(r.amount),
    effectiveReturn: r.opportunity.effectiveReturn,
    rationale: r.rationale,
  }));

  return {
    netWorth: {
      netWorthCents: Number(netWorth.netWorthCents),
      assetsCents: Number(netWorth.assetsCents),
      liabilitiesCents: Number(netWorth.liabilitiesCents),
    },
    debts: debts.map((d) => ({
      name: d.name,
      type: d.type,
      balanceCents: Number(d.balanceCents),
      aprBps: d.aprBps,
      aprPercent: d.aprBps / 100,
      minPaymentCents: Number(d.minPaymentCents),
      isFederal: d.isFederal,
    })),
    debtPlan,
    nextFiveHundredDollarsRouted: routed,
  };
}

const askSchema = z.object({ question: z.string().min(1).max(2000) });
const explainSchema = z.object({ recommendation: z.record(z.unknown()) });

export async function flintRoutes(app: FastifyInstance) {
  const configured = () => Boolean(process.env.ANTHROPIC_API_KEY);

  app.post('/ask', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (!configured()) {
      return reply.status(503).send({ error: 'Flint is not configured (set ANTHROPIC_API_KEY)' });
    }
    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const context = await buildContext(req.user.sub);
    const flint = new Flint();
    const result = await flint.ask(parsed.data.question, context);
    return {
      answer: result.text,
      grounded: result.grounding.grounded,
      novelNumbers: result.grounding.novelNumbers,
      context, // every AI claim links back to the engine result that produced it
    };
  });

  app.post('/explain', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (!configured()) {
      return reply.status(503).send({ error: 'Flint is not configured (set ANTHROPIC_API_KEY)' });
    }
    const parsed = explainSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const flint = new Flint();
    const result = await flint.explain(parsed.data.recommendation);
    return {
      answer: result.text,
      grounded: result.grounding.grounded,
      novelNumbers: result.grounding.novelNumbers,
    };
  });
}
