import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DebtType, FederalPlan, prisma, type Debt } from '@tulip/db';
import {
  cents,
  compareStrategies,
  planPayoff,
  compareMortgageMoves,
  idrMonthlyPayment,
  projectPslf,
  projectForgivenessTaxBomb,
  analyzeStudentRefi,
  standardTenYearPayment,
  type Cents,
  type Loan,
  type StudentLoan,
  type PovertyTable,
} from '@tulip/core';

/** APR is stored as basis points; engines take decimals. Convert ONLY here. */
const bpsToDecimal = (bps: number) => bps / 10000;

/**
 * Default HHS poverty guideline table (2024 contiguous US). Injected into the
 * engine — override per-request when a new year's table is published.
 */
const DEFAULT_POVERTY_TABLE: PovertyTable = {
  baseAnnual: cents(1506000),
  perAdditionalPersonAnnual: cents(538000),
};

function toLoan(d: Debt): Loan {
  return {
    id: d.id,
    name: d.name,
    balance: cents(Number(d.balanceCents)),
    aprAnnual: bpsToDecimal(d.aprBps),
    minPayment: cents(Number(d.minPaymentCents)),
  };
}

function serializeDebt(d: Debt) {
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    balanceCents: Number(d.balanceCents),
    aprBps: d.aprBps,
    minPaymentCents: Number(d.minPaymentCents),
    isFederal: d.isFederal,
    subsidized: d.subsidized,
    servicer: d.servicer,
    federalPlan: d.federalPlan,
    pslfPaymentsMade: d.pslfPaymentsMade,
    originalTermMonths: d.originalTermMonths,
    updatedAt: d.updatedAt,
  };
}

const debtBodySchema = z.object({
  name: z.string().min(1).max(120),
  type: z.nativeEnum(DebtType),
  balanceCents: z.number().int().nonnegative(),
  aprBps: z.number().int().min(0).max(30000),
  minPaymentCents: z.number().int().nonnegative(),
  isFederal: z.boolean().optional(),
  subsidized: z.boolean().optional(),
  servicer: z.string().max(120).optional(),
  federalPlan: z.nativeEnum(FederalPlan).optional(),
  pslfPaymentsMade: z.number().int().min(0).max(120).optional(),
  originalTermMonths: z.number().int().positive().max(600).optional(),
});

const planQuerySchema = z.object({
  extraCents: z.coerce.number().int().nonnegative().default(0),
  strategy: z.enum(['avalanche', 'snowball']).default('avalanche'),
  /** Mortgages are excluded from the consumer debt-free date by default —
   * they have their own simulator (/debt/mortgage/simulate). */
  includeMortgage: z.coerce.boolean().default(false),
});

const mortgageSimSchema = z.object({
  debtId: z.string(),
  remainingTermMonths: z.number().int().positive().max(600).optional(),
  extraMonthlyCents: z.number().int().nonnegative().optional(),
  lumpSumCents: z.number().int().positive().optional(),
  refi: z
    .object({
      newAprBps: z.number().int().min(0).max(30000),
      newTermMonths: z.number().int().positive().max(600),
      closingCostsCents: z.number().int().nonnegative(),
    })
    .optional(),
});

const studentAnalyzeSchema = z.object({
  agiCents: z.number().int().nonnegative(),
  familySize: z.number().int().min(1).max(20),
  plan: z.enum(['SAVE', 'PAYE', 'IBR']).optional(),
  gradShare: z.number().min(0).max(1).optional(),
  newBorrower: z.boolean().optional(),
  marginalTaxRate: z.number().min(0).max(1).default(0.22),
  /** Months until non-PSLF IDR forgiveness (240 = 20y, 300 = 25y). */
  monthsUntilForgiveness: z.number().int().positive().max(360).default(240),
  refi: z
    .object({
      newAprBps: z.number().int().min(0).max(30000),
      newTermMonths: z.number().int().positive().max(360),
      feesCents: z.number().int().nonnegative(),
    })
    .optional(),
  povertyTable: z
    .object({
      baseAnnualCents: z.number().int().positive(),
      perAdditionalPersonAnnualCents: z.number().int().positive(),
    })
    .optional(),
});

async function userDebts(userId: string) {
  return prisma.debt.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

export async function debtRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (req) => {
    const debts = await userDebts(req.user.sub);
    return { debts: debts.map(serializeDebt) };
  });

  app.post('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = debtBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    const debt = await prisma.debt.create({
      data: {
        userId: req.user.sub,
        name: d.name,
        type: d.type,
        balanceCents: BigInt(d.balanceCents),
        aprBps: d.aprBps,
        minPaymentCents: BigInt(d.minPaymentCents),
        isFederal: d.isFederal ?? false,
        subsidized: d.subsidized ?? null,
        servicer: d.servicer ?? null,
        federalPlan: d.federalPlan ?? FederalPlan.NONE,
        pslfPaymentsMade: d.pslfPaymentsMade ?? 0,
        originalTermMonths: d.originalTermMonths ?? null,
      },
    });
    return reply.status(201).send({ debt: serializeDebt(debt) });
  });

  app.patch('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = debtBodySchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const existing = await prisma.debt.findFirst({ where: { id, userId: req.user.sub } });
    if (!existing) return reply.status(404).send({ error: 'Debt not found' });

    const d = parsed.data;
    const debt = await prisma.debt.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.type !== undefined ? { type: d.type } : {}),
        ...(d.balanceCents !== undefined ? { balanceCents: BigInt(d.balanceCents) } : {}),
        ...(d.aprBps !== undefined ? { aprBps: d.aprBps } : {}),
        ...(d.minPaymentCents !== undefined ? { minPaymentCents: BigInt(d.minPaymentCents) } : {}),
        ...(d.isFederal !== undefined ? { isFederal: d.isFederal } : {}),
        ...(d.subsidized !== undefined ? { subsidized: d.subsidized } : {}),
        ...(d.servicer !== undefined ? { servicer: d.servicer } : {}),
        ...(d.federalPlan !== undefined ? { federalPlan: d.federalPlan } : {}),
        ...(d.pslfPaymentsMade !== undefined ? { pslfPaymentsMade: d.pslfPaymentsMade } : {}),
        ...(d.originalTermMonths !== undefined ? { originalTermMonths: d.originalTermMonths } : {}),
      },
    });
    return { debt: serializeDebt(debt) };
  });

  app.delete('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.debt.findFirst({ where: { id, userId: req.user.sub } });
    if (!existing) return reply.status(404).send({ error: 'Debt not found' });
    await prisma.debt.delete({ where: { id } });
    return reply.status(204).send();
  });

  /** Full payoff plan over the user's real debts. */
  app.get('/plan', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = planQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const debts = await userDebts(req.user.sub);
    const open = debts.filter(
      (d) => d.balanceCents > 0n && (parsed.data.includeMortgage || d.type !== DebtType.MORTGAGE),
    );
    if (open.length === 0) return reply.status(400).send({ error: 'No debts with a balance' });

    let plan;
    try {
      plan = planPayoff(open.map(toLoan), cents(parsed.data.extraCents), parsed.data.strategy, new Date());
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Plan failed' });
    }
    return {
      strategy: plan.strategy,
      monthsToDebtFree: plan.monthsToDebtFree,
      debtFreeDate: plan.debtFreeDate,
      totalInterestCents: Number(plan.totalInterest),
      totalPaidCents: Number(plan.totalPaid),
      payoffOrder: plan.payoffOrder.map((p) => ({
        loanId: p.loanId,
        name: p.name,
        payoffMonth: p.payoffMonth,
        interestPaidCents: Number(p.interestPaid),
      })),
      monthlySchedule: plan.monthlySchedule.map((m) => ({
        month: m.month,
        remainingBalanceCents: Number(m.remainingBalance),
        interestAccruedCents: Number(m.interestAccrued),
      })),
    };
  });

  /** Avalanche vs snowball over the user's real debts — the honest tradeoff. */
  app.get('/compare', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = planQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const debts = await userDebts(req.user.sub);
    const open = debts.filter(
      (d) => d.balanceCents > 0n && (parsed.data.includeMortgage || d.type !== DebtType.MORTGAGE),
    );
    if (open.length === 0) return reply.status(400).send({ error: 'No debts with a balance' });

    let result;
    try {
      result = compareStrategies(open.map(toLoan), cents(parsed.data.extraCents), new Date());
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Comparison failed' });
    }
    const shape = (p: typeof result.avalanche) => ({
      debtFreeDate: p.debtFreeDate,
      months: p.monthsToDebtFree,
      totalInterestCents: Number(p.totalInterest),
      payoffOrder: p.payoffOrder.map((o) => ({
        loanId: o.loanId,
        name: o.name,
        payoffMonth: o.payoffMonth,
        interestPaidCents: Number(o.interestPaid),
      })),
    });
    return {
      avalanche: shape(result.avalanche),
      snowball: shape(result.snowball),
      snowballCostsExtraInterestCents: Number(result.interestDelta),
      snowballCostsExtraMonths: result.monthsDelta,
    };
  });

  /** Extra-payment / biweekly / recast / refinance outcomes for a mortgage debt. */
  app.post('/mortgage/simulate', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = mortgageSimSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const body = parsed.data;

    const debt = await prisma.debt.findFirst({ where: { id: body.debtId, userId: req.user.sub } });
    if (!debt) return reply.status(404).send({ error: 'Debt not found' });
    if (debt.type !== DebtType.MORTGAGE) return reply.status(400).send({ error: 'Debt is not a mortgage' });

    const term = body.remainingTermMonths ?? debt.originalTermMonths;
    if (!term) {
      return reply.status(400).send({ error: 'Provide remainingTermMonths (no term stored on this debt)' });
    }

    const comparison = compareMortgageMoves(
      {
        balance: cents(Number(debt.balanceCents)),
        aprAnnual: bpsToDecimal(debt.aprBps),
        remainingTermMonths: term,
        ...(debt.minPaymentCents > 0n ? { monthlyPayment: cents(Number(debt.minPaymentCents)) } : {}),
      },
      {
        ...(body.extraMonthlyCents ? { extraMonthly: cents(body.extraMonthlyCents) } : {}),
        ...(body.lumpSumCents ? { lumpSum: cents(body.lumpSumCents) } : {}),
        ...(body.refi
          ? {
              refi: {
                newAprAnnual: bpsToDecimal(body.refi.newAprBps),
                newTermMonths: body.refi.newTermMonths,
                closingCosts: cents(body.refi.closingCostsCents),
              },
            }
          : {}),
      },
      new Date(),
    );

    const num = (c: Cents) => Number(c);
    const outcome = (o: { months: number; payoffDate: string; totalInterest: Cents; totalPaid: Cents }) => ({
      months: o.months,
      payoffDate: o.payoffDate,
      totalInterestCents: num(o.totalInterest),
      totalPaidCents: num(o.totalPaid),
    });
    return {
      baseline: outcome(comparison.baseline),
      extraPayment: comparison.extraPayment
        ? {
            outcome: outcome(comparison.extraPayment.alternative),
            interestSavedCents: num(comparison.extraPayment.interestSaved),
            monthsSaved: comparison.extraPayment.monthsSaved,
          }
        : null,
      biweekly: {
        outcome: outcome(comparison.biweekly.alternative),
        interestSavedCents: num(comparison.biweekly.interestSaved),
        monthsSaved: comparison.biweekly.monthsSaved,
      },
      recast: comparison.recast
        ? {
            newPaymentCents: num(comparison.recast.newPayment),
            monthlyReliefCents: num(comparison.recast.monthlyRelief),
            interestSavedCents: num(comparison.recast.interestSaved),
            outcome: outcome(comparison.recast.outcome),
          }
        : null,
      refinance: comparison.refinance
        ? {
            newPaymentCents: num(comparison.refinance.newPayment),
            monthlySavingsCents: num(comparison.refinance.monthlySavings),
            breakEvenMonths: comparison.refinance.breakEvenMonths,
            netSavingsCents: num(comparison.refinance.netSavings),
            outcome: outcome(comparison.refinance.outcome),
          }
        : null,
    };
  });

  /** IDR / PSLF / tax-bomb / refi analysis for a student-loan debt. */
  app.post('/:id/student-loan/analyze', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = studentAnalyzeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const body = parsed.data;

    const { id } = req.params as { id: string };
    const debt = await prisma.debt.findFirst({ where: { id, userId: req.user.sub } });
    if (!debt) return reply.status(404).send({ error: 'Debt not found' });
    if (debt.type !== DebtType.STUDENT_LOAN) {
      return reply.status(400).send({ error: 'Debt is not a student loan' });
    }

    const povertyTable: PovertyTable = body.povertyTable
      ? {
          baseAnnual: cents(body.povertyTable.baseAnnualCents),
          perAdditionalPersonAnnual: cents(body.povertyTable.perAdditionalPersonAnnualCents),
        }
      : DEFAULT_POVERTY_TABLE;

    const aprAnnual = bpsToDecimal(debt.aprBps);
    const balance = cents(Number(debt.balanceCents));
    const loan: StudentLoan = {
      id: debt.id,
      name: debt.name,
      balance,
      aprAnnual,
      minPayment: cents(Number(debt.minPaymentCents)),
      loanType: debt.isFederal ? 'FEDERAL' : 'PRIVATE',
      pslfPaymentsMade: debt.pslfPaymentsMade ?? 0,
    };

    const idrFor = (plan: 'SAVE' | 'PAYE' | 'IBR') =>
      Number(
        idrMonthlyPayment({
          plan,
          agiAnnual: cents(body.agiCents),
          familySize: body.familySize,
          povertyTable,
          balance,
          aprAnnual,
          ...(body.gradShare !== undefined ? { gradShare: body.gradShare } : {}),
          ...(body.newBorrower !== undefined ? { newBorrower: body.newBorrower } : {}),
        }),
      );

    const idrPayments = debt.isFederal
      ? { SAVE: idrFor('SAVE'), PAYE: idrFor('PAYE'), IBR: idrFor('IBR') }
      : null;
    const selectedPlan = body.plan ?? 'SAVE';
    const idrPaymentCents = idrPayments ? idrPayments[selectedPlan] : null;

    const now = new Date();
    const pslf =
      debt.isFederal && idrPaymentCents !== null
        ? projectPslf({ balance, aprAnnual }, cents(idrPaymentCents), debt.pslfPaymentsMade ?? 0, now)
        : null;

    const taxBomb =
      debt.isFederal && idrPaymentCents !== null
        ? projectForgivenessTaxBomb(
            { balance, aprAnnual },
            cents(idrPaymentCents),
            body.monthsUntilForgiveness,
            body.marginalTaxRate,
            now,
          )
        : null;

    const refi = body.refi
      ? analyzeStudentRefi(loan, cents(Number(debt.minPaymentCents)), {
          newAprAnnual: bpsToDecimal(body.refi.newAprBps),
          newTermMonths: body.refi.newTermMonths,
          fees: cents(body.refi.feesCents),
        })
      : null;

    return {
      debt: serializeDebt(debt),
      standardTenYearPaymentCents: Number(standardTenYearPayment(balance, aprAnnual)),
      idr: idrPayments ? { selectedPlan, paymentCents: idrPaymentCents, byPlan: idrPayments } : null,
      pslf: pslf
        ? {
            paymentsMade: pslf.paymentsMade,
            paymentsRemaining: pslf.paymentsRemaining,
            forgivenessDate: pslf.forgivenessDate,
            projectedForgivenCents: Number(pslf.projectedForgiven),
            paidUntilForgivenessCents: Number(pslf.paidUntilForgiveness),
            alreadyEligible: pslf.alreadyEligible,
          }
        : null,
      forgivenessTaxBomb: taxBomb
        ? {
            forgivenessDate: taxBomb.forgivenessDate,
            projectedForgivenCents: Number(taxBomb.projectedForgiven),
            taxBombCents: Number(taxBomb.taxBomb),
          }
        : null,
      refi: refi
        ? {
            refiForfeitsFederalBenefits: refi.refiForfeitsFederalBenefits,
            lostBenefits: refi.lostBenefits,
            newPaymentCents: Number(refi.newPayment),
            monthlySavingsCents: Number(refi.monthlySavings),
            breakEvenMonths: refi.breakEvenMonths,
            netSavingsCents: Number(refi.netSavings),
          }
        : null,
    };
  });
}
