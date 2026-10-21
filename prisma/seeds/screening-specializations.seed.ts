import { prisma } from "../../src/lib/prisma.js";

const specializations = [
  "Acne",
  "Actinic Keratosis",
  "Benign Tumors",
  "Bullous Disorders",
  "Candidiasis",
  "Drug Eruption",
  "Eczema",
  "Infestations and Bites",
  "Lichen Disorders",
  "Lupus",
  "Moles",
  "Psoriasis",
  "Rosacea",
  "Seborrheic Keratoses",
  "Skin Cancer",
  "Sun Damage",
  "Tinea",
  "Vascular Tumors",
  "Vasculitis",
  "Vitiligo",
  "Warts",
  "General Dermatology",
] as const;

const conditionMappings: Record<string, string[]> = {
  Acne: ["Acne"],
  "Actinic Keratosis": ["Actinic Keratosis"],
  "Benign Tumors": ["Benign Tumors"],
  Bullous: ["Bullous Disorders"],
  Candidiasis: ["Candidiasis"],
  "Drug Eruption": ["Drug Eruption"],
  Eczema: ["Eczema"],
  "Infestations Bites": ["Infestations and Bites"],
  Lichen: ["Lichen Disorders"],
  Lupus: ["Lupus"],
  Moles: ["Moles"],
  Psoriasis: ["Psoriasis"],
  Rosacea: ["Rosacea"],
  "Seborrh Keratoses": ["Seborrheic Keratoses"],
  "Skin Cancer": ["Skin Cancer"],
  "Sun Sunlight Damage": ["Sun Damage"],
  Tinea: ["Tinea"],
  "Vascular Tumors": ["Vascular Tumors"],
  Vasculitis: ["Vasculitis"],
  Vitiligo: ["Vitiligo"],
  Warts: ["Warts"],
};

async function main() {
  const specializationIds = new Map<string, string>();

  for (const name of specializations) {
    const specialization = await prisma.specialization.upsert({
      where: { name },
      update: {},
      create: {
        name,
        description: `Doctor expertise in ${name}`,
      },
    });

    specializationIds.set(name, specialization.id);
  }

  for (const [conditionName, names] of Object.entries(conditionMappings)) {
    const condition = await prisma.condition.findUnique({
      where: { name: conditionName },
      select: { id: true },
    });

    if (!condition) {
      console.warn(`Condition not found; seed it first: ${conditionName}`);
      continue;
    }

    for (const name of names) {
      const specializationId = specializationIds.get(name);

      if (!specializationId) {
        throw new Error(`Missing specialization: ${name}`);
      }

      await prisma.conditionSpecialization.upsert({
        where: {
          conditionId_specializationId: {
            conditionId: condition.id,
            specializationId,
          },
        },
        update: {},
        create: {
          conditionId: condition.id,
          specializationId,
        },
      });
    }
  }

  console.log("Screening specialization mapping seeded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });