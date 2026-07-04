import { PrismaClient, AccountType, DebtType, GoalType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('demo-password-1234', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@tulip.app' },
    update: { passwordHash },
    create: {
      email: 'demo@tulip.app',
      passwordHash,
      accounts: {
        create: [
          { name: 'Everyday Checking', type: AccountType.CHECKING, balanceCents: 340000n },
          { name: 'High-Yield Savings', type: AccountType.SAVINGS, balanceCents: 1200000n },
        ],
      },
      debts: {
        create: [
          { name: 'Sallie Mae', type: DebtType.STUDENT_LOAN, balanceCents: 1800000n, aprBps: 780, minPaymentCents: 20000n, isFederal: true },
          { name: 'Visa', type: DebtType.CREDIT_CARD, balanceCents: 500000n, aprBps: 2299, minPaymentCents: 10000n },
        ],
      },
      goals: {
        create: [
          { name: 'Buy a rental property', type: GoalType.PROPERTY, targetCents: 4000000n, targetDate: new Date('2029-06-01'), priority: 1, colorTag: 'green' },
          { name: 'Pay off student loans', type: GoalType.DEBT_PAYOFF, targetCents: 1800000n, targetDate: new Date('2029-06-01'), priority: 1, colorTag: 'red' },
        ],
      },
    },
  });
  console.log('Seeded demo user:', user.email);

  // Demo transactions for the current month (skip if any already exist).
  const txnCount = await prisma.transaction.count({ where: { userId: user.id } });
  const checking = await prisma.account.findFirst({
    where: { userId: user.id, type: AccountType.CHECKING },
  });
  if (txnCount === 0 && checking) {
    const now = new Date();
    const day = (d: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), d));
    await prisma.transaction.createMany({
      data: [
        { userId: user.id, accountId: checking.id, amountCents: 520000n, description: 'Payroll — Acme Corp', category: 'Income', postedAt: day(1) },
        { userId: user.id, accountId: checking.id, amountCents: -184500n, description: 'Rent — Maple St Apartments', category: 'Housing', postedAt: day(1) },
        { userId: user.id, accountId: checking.id, amountCents: -14237n, description: 'Whole Foods Market', merchant: 'Whole Foods', category: 'Groceries', postedAt: day(2) },
        { userId: user.id, accountId: checking.id, amountCents: -4680n, description: 'Shell Gas Station', merchant: 'Shell', category: 'Gas', postedAt: day(2) },
        { userId: user.id, accountId: checking.id, amountCents: -8925n, description: "Trader Joe's", merchant: "Trader Joe's", category: 'Groceries', postedAt: day(3) },
        { userId: user.id, accountId: checking.id, amountCents: -6250n, description: 'Nonna Pizzeria', merchant: 'Nonna', category: 'Dining', postedAt: day(3) },
        { userId: user.id, accountId: checking.id, amountCents: -1599n, description: 'Netflix', merchant: 'Netflix', category: 'Subscriptions', postedAt: day(3) },
        { userId: user.id, accountId: checking.id, amountCents: -3410n, description: 'Corner Coffee', merchant: 'Corner Coffee', category: 'Dining', postedAt: day(4) },
      ],
    });
    console.log('Seeded demo transactions');
  }
}

main().finally(() => prisma.$disconnect());
