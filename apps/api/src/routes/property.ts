import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AccountType, prisma, type Property } from '@tulip/db';
import {
  cents,
  analyzeDeal,
  analyzeSellVsHold,
  propertyEquity,
  simulatePurchaseImpact,
  type Goal,
} from '@tulip/core';

function serializeProperty(p: Property) {
  return {
    id: p.id,
    label: p.label,
    address: p.address,
    estimatedValueCents: Number(p.estimatedValueCents),
    mortgageBalanceCents: Number(p.mortgageBalanceCents),
    equityCents: Number(p.estimatedValueCents - p.mortgageBalanceCents),
    isRental: p.isRental,
    monthlyRentCents: p.monthlyRentCents === null ? null : Number(p.monthlyRentCents),
    monthlyExpensesCents: p.monthlyExpensesCents === null ? null : Number(p.monthlyExpensesCents),
  };
}

const propertyBodySchema = z.object({
  label: z.string().min(1).max(120),
  address: z.string().max(200).optional(),
  estimatedValueCents: z.number().int().nonnegative(),
  mortgageBalanceCents: z.number().int().nonnegative().optional(),
  isRental: z.boolean().optional(),
  monthlyRentCents: z.number().int().nonnegative().optional(),
  monthlyExpensesCents: z.number().int().nonnegative().optional(),
});

const dealSchema = z.object({
  purchasePriceCents: z.number().int().positive(),
  downPaymentCents: z.number().int().nonnegative(),
  aprBps: z.number().int().min(0).max(30000),
  termMonths: z.number().int().positive().max(600),
  monthlyRentCents: z.number().int().nonnegative(),
  monthlyExpensesCents: z.number().int().nonnegative(),
  closingCostsCents: z.number().int().nonnegative().optional(),
});

const sellVsHoldSchema = z.object({
  propertyId: z.string(),
  aprBps: z.number().int().min(0).max(30000).default(600),
  remainingTermMonths: z.number().int().positive().max(600).default(360),
  horizonMonths: z.number().int().positive().max(600).default(60),
  sellingCostRate: z.number().min(0).max(0.2).default(0.07),
  appreciationRate: z.number().min(-0.2).max(0.2).default(0.03),
  marketReturn: z.number().min(0).max(0.2).default(0.07),
  cashOutRefi: z
    .object({
      ltv: z.number().min(0.1).max(0.9),
      newAprBps: z.number().int().min(0).max(30000),
      newTermMonths: z.number().int().positive().max(600),
      closingCostsCents: z.number().int().nonnegative(),
    })
    .optional(),
});

export async function propertyRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (req) => {
    const properties = await prisma.property.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'asc' },
    });
    return { properties: properties.map(serializeProperty) };
  });

  app.post('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = propertyBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const b = parsed.data;
    const property = await prisma.property.create({
      data: {
        userId: req.user.sub,
        label: b.label,
        address: b.address ?? null,
        estimatedValueCents: BigInt(b.estimatedValueCents),
        mortgageBalanceCents: BigInt(b.mortgageBalanceCents ?? 0),
        isRental: b.isRental ?? false,
        monthlyRentCents: b.monthlyRentCents !== undefined ? BigInt(b.monthlyRentCents) : null,
        monthlyExpensesCents: b.monthlyExpensesCents !== undefined ? BigInt(b.monthlyExpensesCents) : null,
      },
    });
    return reply.status(201).send({ property: serializeProperty(property) });
  });

  app.patch('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = propertyBodySchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const existing = await prisma.property.findFirst({ where: { id, userId: req.user.sub } });
    if (!existing) return reply.status(404).send({ error: 'Property not found' });
    const b = parsed.data;
    const property = await prisma.property.update({
      where: { id },
      data: {
        ...(b.label !== undefined ? { label: b.label } : {}),
        ...(b.address !== undefined ? { address: b.address } : {}),
        ...(b.estimatedValueCents !== undefined ? { estimatedValueCents: BigInt(b.estimatedValueCents) } : {}),
        ...(b.mortgageBalanceCents !== undefined ? { mortgageBalanceCents: BigInt(b.mortgageBalanceCents) } : {}),
        ...(b.isRental !== undefined ? { isRental: b.isRental } : {}),
        ...(b.monthlyRentCents !== undefined ? { monthlyRentCents: BigInt(b.monthlyRentCents) } : {}),
        ...(b.monthlyExpensesCents !== undefined ? { monthlyExpensesCents: BigInt(b.monthlyExpensesCents) } : {}),
      },
    });
    return { property: serializeProperty(property) };
  });

  app.delete('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.property.findFirst({ where: { id, userId: req.user.sub } });
    if (!existing) return reply.status(404).send({ error: 'Property not found' });
    await prisma.property.delete({ where: { id } });
    return reply.status(204).send();
  });

  /** Prospective rental deal analyzer. */
  app.post('/analyze', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = dealSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const b = parsed.data;
    try {
      const deal = analyzeDeal({
        purchasePrice: cents(b.purchasePriceCents),
        downPayment: cents(b.downPaymentCents),
        aprAnnual: b.aprBps / 10000,
        termMonths: b.termMonths,
        monthlyRent: cents(b.monthlyRentCents),
        monthlyExpenses: cents(b.monthlyExpensesCents),
        ...(b.closingCostsCents !== undefined ? { closingCosts: cents(b.closingCostsCents) } : {}),
      });
      return {
        loanAmountCents: Number(deal.loanAmount),
        monthlyDebtServiceCents: Number(deal.monthlyDebtService),
        monthlyNOICents: Number(deal.monthlyNOI),
        capRate: deal.capRate,
        cashOnCash: deal.cashOnCash,
        dscr: Number.isFinite(deal.dscr) ? deal.dscr : null,
        monthlyCashflowCents: Number(deal.monthlyCashflow),
      };
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Invalid deal' });
    }
  });

  /** How a prospective purchase reshapes net worth and shifts other goal dates. */
  app.post('/purchase-impact', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = dealSchema
      .extend({ monthlySurplusCents: z.number().int().nonnegative().default(100000) })
      .safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const b = parsed.data;

    const [liquidAgg, goals] = await prisma.$transaction([
      prisma.account.aggregate({
        where: {
          userId: req.user.sub,
          type: { in: [AccountType.CHECKING, AccountType.SAVINGS, AccountType.CASH] },
        },
        _sum: { balanceCents: true },
      }),
      prisma.goal.findMany({ where: { userId: req.user.sub } }),
    ]);

    const engineGoals: Goal[] = goals.map((g) => ({
      id: g.id,
      name: g.name,
      target: cents(Number(g.targetCents)),
      saved: cents(Number(g.savedCents)),
      targetDate: g.targetDate.toISOString().slice(0, 10),
      priority: g.priority,
    }));

    try {
      const impact = simulatePurchaseImpact({
        deal: {
          purchasePrice: cents(b.purchasePriceCents),
          downPayment: cents(b.downPaymentCents),
          aprAnnual: b.aprBps / 10000,
          termMonths: b.termMonths,
          monthlyRent: cents(b.monthlyRentCents),
          monthlyExpenses: cents(b.monthlyExpensesCents),
          ...(b.closingCostsCents !== undefined ? { closingCosts: cents(b.closingCostsCents) } : {}),
        },
        liquidCash: cents(Number(liquidAgg._sum.balanceCents ?? 0n)),
        goals: engineGoals,
        monthlySurplus: cents(b.monthlySurplusCents),
        startDate: new Date(),
      });
      return {
        cashRequiredCents: Number(impact.cashRequired),
        cashAfterCents: Number(impact.cashAfter),
        affordable: impact.affordable,
        netWorthDeltaCents: Number(impact.netWorthDelta),
        monthlyCashflowCents: Number(impact.monthlyCashflow),
        surplusAfterCents: Number(impact.surplusAfter),
        goalShifts: impact.goalShifts.map((s) => ({
          goalId: s.goalId,
          name: s.name,
          monthlyBeforeCents: Number(s.monthlyBefore),
          monthlyAfterCents: Number(s.monthlyAfter),
          dateBefore: s.dateBefore,
          dateAfter: s.dateAfter,
          monthsDelta: s.monthsDelta,
        })),
      };
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Invalid deal' });
    }
  });

  /** Sell vs hold vs cash-out-refi for an owned property. */
  app.post('/sell-vs-hold', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = sellVsHoldSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const b = parsed.data;
    const property = await prisma.property.findFirst({ where: { id: b.propertyId, userId: req.user.sub } });
    if (!property) return reply.status(404).send({ error: 'Property not found' });

    const result = analyzeSellVsHold({
      property: {
        estimatedValue: cents(Number(property.estimatedValueCents)),
        mortgageBalance: cents(Number(property.mortgageBalanceCents)),
        aprAnnual: b.aprBps / 10000,
        remainingTermMonths: b.remainingTermMonths,
        monthlyRent: cents(Number(property.monthlyRentCents ?? 0n)),
        monthlyExpenses: cents(Number(property.monthlyExpensesCents ?? 0n)),
      },
      horizonMonths: b.horizonMonths,
      sellingCostRate: b.sellingCostRate,
      appreciationRate: b.appreciationRate,
      marketReturn: b.marketReturn,
      ...(b.cashOutRefi
        ? {
            cashOutRefi: {
              ltv: b.cashOutRefi.ltv,
              newAprAnnual: b.cashOutRefi.newAprBps / 10000,
              newTermMonths: b.cashOutRefi.newTermMonths,
              closingCosts: cents(b.cashOutRefi.closingCostsCents),
            },
          }
        : {}),
    });

    return {
      equityCents: Number(propertyEquity({
        estimatedValue: cents(Number(property.estimatedValueCents)),
        mortgageBalance: cents(Number(property.mortgageBalanceCents)),
      })),
      sell: { netProceedsCents: Number(result.sell.netProceeds), projectedValueCents: Number(result.sell.projectedValue) },
      hold: {
        projectedEquityCents: Number(result.hold.projectedEquity),
        cumulativeCashflowCents: Number(result.hold.cumulativeCashflow),
        projectedValueCents: Number(result.hold.projectedValue),
      },
      refi: result.refi
        ? {
            cashOutCents: Number(result.refi.cashOut),
            newPaymentCents: Number(result.refi.newPayment),
            monthlyCashflowAfterCents: Number(result.refi.monthlyCashflowAfter),
            projectedValueCents: Number(result.refi.projectedValue),
          }
        : null,
      bestOption: result.bestOption,
    };
  });
}
