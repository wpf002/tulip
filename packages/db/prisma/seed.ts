import { PrismaClient, AccountType, DebtType, GoalType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@tulip.app' },
    update: {},
    create: {
      email: 'demo@tulip.app',
      passwordHash: 'REPLACE_WITH_BCRYPT_HASH', // seed only; real hashing in API auth
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
}

main().finally(() => prisma.$disconnect());
