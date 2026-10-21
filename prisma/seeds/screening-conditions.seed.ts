import { prisma } from "../../src/lib/prisma.js";

const conditions = [
  "Acne",
  "Actinic Keratosis",
  "Benign Tumors",
  "Bullous",
  "Candidiasis",
  "Drug Eruption",
  "Eczema",
  "Infestations Bites",
  "Lichen",
  "Lupus",
  "Moles",
  "Psoriasis",
  "Rosacea",
  "Seborrh Keratoses",
  "Skin Cancer",
  "Sun Sunlight Damage",
  "Tinea",
  "Unknown Normal",
  "Vascular Tumors",
  "Vasculitis",
  "Vitiligo",
  "Warts",
] as const;

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