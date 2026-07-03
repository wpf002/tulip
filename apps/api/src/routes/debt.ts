import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { fromDollars, compareStrategies, type Loan } from '@tulip/core';

const loanSchema = z.object({
  id: z.string(),
  name: z.string(),
  balanceDollars: z.number().nonnegative(),
  aprAnnual: z.number().min(0).max(1),
  minPaymentDollars: z.number().nonnegative(),
});

const bodySchema = z.object({
  loans: z.array(loanSchema).min(1),
  extraMonthlyDollars: z.number().nonnegative(),
});

/**
 * POST /debt/compare
 * Deterministic avalanche vs snowball comparison. All math in @tulip/core.
 * Demonstrates the POC's proof: a real Debt-Free Date, not a progress bar.
 */
export async function debtRoutes(app: FastifyInstance) {
  app.post('/compare', async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const loans: Loan[] = parsed.data.loans.map((l) => ({
      id: l.id,
      name: l.name,
      balance: fromDollars(l.balanceDollars),
      aprAnnual: l.aprAnnual,
      minPayment: fromDollars(l.minPaymentDollars),
    }));

    const result = compareStrategies(loans, fromDollars(parsed.data.extraMonthlyDollars));
    return {
      avalanche: {
        debtFreeDate: result.avalanche.debtFreeDate,
        months: result.avalanche.monthsToDebtFree,
        totalInterestCents: Number(result.avalanche.totalInterest),
      },
      snowball: {
        debtFreeDate: result.snowball.debtFreeDate,
        months: result.snowball.monthsToDebtFree,
        totalInterestCents: Number(result.snowball.totalInterest),
      },
      snowballCostsExtraInterestCents: Number(result.interestDelta),
      snowballCostsExtraMonths: result.monthsDelta,
    };
  });
}
