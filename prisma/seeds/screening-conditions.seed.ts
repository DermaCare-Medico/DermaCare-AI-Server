import { prisma } from "../../src/lib/prisma.js";
import { MODEL_CONDITION_LABELS } from "../../src/shared/constants/screening.constants.js";

const conditions = MODEL_CONDITION_LABELS;

async function main() {
  for (const name of conditions) {
    await prisma.condition.upsert({
      where: { name },
      update: {},
      create: {
        name,
        overview: `AI screening category: ${name}. This is not a confirmed diagnosis.`,
        riskCategory: "MEDIUM",
        safeForHomeCare: false,
      },
    });
  }

  console.log(`Seeded ${conditions.length} screening conditions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
