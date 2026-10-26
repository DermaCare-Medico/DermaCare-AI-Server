import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma, closeDatabaseConnections } from "../../src/lib/prisma.js";
import {
  AccountStatus,
  AppointmentStatus,
  AuthProvider,
  DoctorApprovalStatus,
  Gender,
  ImageQualityStatus,
  ImageType,
  MeetingProvisioningStatus,
  NotificationType,
  OrderStatus,
  PayoutStatus,
  Prisma,
  RiskCategory,
  Role,
  ScreeningStatus,
  SlotStatus,
} from "../../src/generated/prisma/client.js";

// Ensure seed only executes in development or test environments
if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
  console.error("ERROR: Seeding development demo data is strictly prohibited in production without ALLOW_PROD_SEED=true.");
  process.exit(1);
}

const stats = {
  inserted: 0,
  updated: 0,
  skipped: 0,
};

async function main() {
  console.log("=== DermaCare AI Development Demo Seed ===");

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin.demo@dermacare.internal";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "DemoAdmin123!";
  const demoUserPassword = process.env.SEED_USER_PASSWORD || "DemoUser123!";

  const [adminPasswordHash, userPasswordHash] = await Promise.all([
    bcrypt.hash(adminPassword, 10),
    bcrypt.hash(demoUserPassword, 10),
  ]);

  // --------------------------------------------------------------------------
  // 1. ADMIN USER
  // --------------------------------------------------------------------------
  console.log("\n1. Seeding Demo Admin...");
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      id: "10000000-0000-4000-8000-000000000001",
      name: "Dr. Farhana Rahman (Chief Admin)",
      email: adminEmail,
      phone: "+8801700000000",
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerified: true,
      consentVersion: "v1.0",
      termsAcceptedAt: new Date("2026-01-01T00:00:00Z"),
      privacyAcceptedAt: new Date("2026-01-01T00:00:00Z"),
    },
  });

  await prisma.authIdentity.upsert({
    where: {
      userId_provider: {
        userId: adminUser.id,
        provider: AuthProvider.PASSWORD,
      },
    },
    update: {},
    create: {
      id: "10000000-0000-4000-8000-000000000003",
      userId: adminUser.id,
      provider: AuthProvider.PASSWORD,
      providerId: adminUser.id,
      passwordHash: adminPasswordHash,
    },
  });

  await prisma.admin.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      id: "10000000-0000-4000-8000-000000000002",
      userId: adminUser.id,
    },
  });

  // --------------------------------------------------------------------------
  // 2. PATIENTS (8 Patients)
  // --------------------------------------------------------------------------
  console.log("2. Seeding 8 Demo Patients...");
  const patientData = [
    {
      userId: "20000000-0000-4000-8000-000000000001",
      profileId: "21000000-0000-4000-8000-000000000001",
      name: "Tanvir Ahmed",
      email: "tanvir.ahmed.demo@dermacare.internal",
      phone: "+8801711000001",
      gender: Gender.MALE,
      dob: new Date("1994-04-12"),
      address: "House 24, Road 7, Dhanmondi, Dhaka",
      allergies: ["Penicillin", "Sulfa drugs"],
      existingConditions: ["Atopic Dermatitis"],
    },
    {
      userId: "20000000-0000-4000-8000-000000000002",
      profileId: "21000000-0000-4000-8000-000000000002",
      name: "Nusrat Jahan",
      email: "nusrat.jahan.demo@dermacare.internal",
      phone: "+8801711000002",
      gender: Gender.FEMALE,
      dob: new Date("1998-09-21"),
      address: "Flat 4B, Green View Tower, Uttara, Dhaka",
      allergies: ["Fragrance", "Nickel"],
      existingConditions: ["Acne Vulgaris"],
    },
    {
      userId: "20000000-0000-4000-8000-000000000003",
      profileId: "21000000-0000-4000-8000-000000000003",
      name: "Kazi Rafiqul Islam",
      email: "kazi.rafiqul.demo@dermacare.internal",
      phone: "+8801711000003",
      gender: Gender.MALE,
      dob: new Date("1982-11-15"),
      address: "Lane 3, O.R. Nizam Road, GEC, Chattogram",
      allergies: ["Aspirin"],
      existingConditions: ["Plaque Psoriasis", "Hypertension"],
    },
    {
      userId: "20000000-0000-4000-8000-000000000004",
      profileId: "21000000-0000-4000-8000-000000000004",
      name: "Sadia Chowdhury",
      email: "sadia.chowdhury.demo@dermacare.internal",
      phone: "+8801711000004",
      gender: Gender.FEMALE,
      dob: new Date("1991-03-08"),
      address: "House 12, Road 4, Banani DOHS, Dhaka",
      allergies: [],
      existingConditions: ["Rosacea"],
    },
    {
      userId: "20000000-0000-4000-8000-000000000005",
      profileId: "21000000-0000-4000-8000-000000000005",
      name: "Mahmud Hasan",
      email: "mahmud.hasan.demo@dermacare.internal",
      phone: "+8801711000005",
      gender: Gender.MALE,
      dob: new Date("1989-07-30"),
      address: "Plot 88, Block C, Bashundhara R/A, Dhaka",
      allergies: ["Latex"],
      existingConditions: ["Seborrheic Dermatitis"],
    },
    {
      userId: "20000000-0000-4000-8000-000000000006",
      profileId: "21000000-0000-4000-8000-000000000006",
      name: "Farzana Yasmin",
      email: "farzana.yasmin.demo@dermacare.internal",
      phone: "+8801711000006",
      gender: Gender.FEMALE,
      dob: new Date("1996-01-19"),
      address: "Holding 15, Station Road, Sylhet",
      allergies: ["Ciprofloxacin"],
      existingConditions: ["Contact Dermatitis"],
    },
    {
      userId: "20000000-0000-4000-8000-000000000007",
      profileId: "21000000-0000-4000-8000-000000000007",
      name: "Tariqul Anam",
      email: "tariqul.anam.demo@dermacare.internal",
      phone: "+8801711000007",
      gender: Gender.MALE,
      dob: new Date("1975-06-25"),
      address: "52 South Central Road, Khulna",
      allergies: [],
      existingConditions: ["Actinic Keratosis"],
    },
    {
      userId: "20000000-0000-4000-8000-000000000008",
      profileId: "21000000-0000-4000-8000-000000000008",
      name: "Ayesha Siddiqua",
      email: "ayesha.siddiqua.demo@dermacare.internal",
      phone: "+8801711000008",
      gender: Gender.FEMALE,
      dob: new Date("2001-12-05"),
      address: "House 31, Sector 7, Uttara, Dhaka",
      allergies: ["Dust mites"],
      existingConditions: ["Vitiligo"],
    },
  ];

  for (const p of patientData) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        id: p.userId,
        name: p.name,
        email: p.email,
        phone: p.phone,
        role: Role.PATIENT,
        status: AccountStatus.ACTIVE,
        emailVerified: true,
        consentVersion: "v1.0",
        termsAcceptedAt: new Date("2026-01-01T00:00:00Z"),
        privacyAcceptedAt: new Date("2026-01-01T00:00:00Z"),
        healthConsentAcceptedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    await prisma.authIdentity.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: AuthProvider.PASSWORD,
        },
      },
      update: {},
      create: {
        userId: user.id,
        provider: AuthProvider.PASSWORD,
        providerId: user.id,
        passwordHash: userPasswordHash,
      },
    });

    await prisma.patientProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        id: p.profileId,
        userId: user.id,
        gender: p.gender,
        dateOfBirth: p.dob,
        address: p.address,
        allergies: p.allergies,
        existingConditions: p.existingConditions,
      },
    });
  }

  // --------------------------------------------------------------------------
  // 3. DOCTORS (5 Approved Doctors & Specialties)
  // --------------------------------------------------------------------------
  console.log("3. Seeding 5 Approved Doctors and Specialties...");

  // Load known specializations from DB
  const specs = await prisma.specialization.findMany();
  const specMap = new Map<string, string>();
  for (const s of specs) {
    specMap.set(s.name, s.id);
  }

  const doctorData = [
    {
      userId: "30000000-0000-4000-8000-000000000001",
      profileId: "31000000-0000-4000-8000-000000000001",
      name: "Prof. Dr. Syed Moniruzzaman",
      email: "dr.syed.moniruzzaman.demo@dermacare.internal",
      phone: "+8801811000001",
      licenseNumber: "BMDC-DOC-00101",
      experienceYears: 18,
      consultationFee: new Prisma.Decimal("1500.00"),
      rating: new Prisma.Decimal("4.92"),
      ratingCount: 38,
      qualifications: ["MBBS (DMC)", "DDV (DU)", "FCPS (Dermatology)", "FRCP (Glasgow)"],
      bio: "Senior Consultant Dermatologist with over 18 years of clinical and academic expertise in chronic inflammatory dermatoses, psoriasis, and immuno-bullous skin conditions.",
      specialtyNames: ["General Dermatology", "Psoriasis", "Eczema"],
    },
    {
      userId: "30000000-0000-4000-8000-000000000002",
      profileId: "31000000-0000-4000-8000-000000000002",
      name: "Dr. Naila Parveen",
      email: "dr.naila.parveen.demo@dermacare.internal",
      phone: "+8801811000002",
      licenseNumber: "BMDC-DOC-00102",
      experienceYears: 11,
      consultationFee: new Prisma.Decimal("1200.00"),
      rating: new Prisma.Decimal("4.85"),
      ratingCount: 29,
      qualifications: ["MBBS (SSMC)", "MD (Dermatology & Venereology)"],
      bio: "Specialist dermatologist focusing on adolescent and adult acne, rosacea management, hormonal skin changes, and medical chemical peel protocols.",
      specialtyNames: ["Acne", "Rosacea", "General Dermatology"],
    },
    {
      userId: "30000000-0000-4000-8000-000000000003",
      profileId: "31000000-0000-4000-8000-000000000003",
      name: "Dr. Anisur Rahman Khan",
      email: "dr.anisur.khan.demo@dermacare.internal",
      phone: "+8801811000003",
      licenseNumber: "BMDC-DOC-00103",
      experienceYears: 9,
      consultationFee: new Prisma.Decimal("1000.00"),
      rating: new Prisma.Decimal("4.78"),
      ratingCount: 22,
      qualifications: ["MBBS (CMC)", "DDV (BSMMU)"],
      bio: "Clinical dermatologist experienced in infectious dermatoses, fungal tinea infections, contact dermatitis, and tropical dermatology care.",
      specialtyNames: ["Tinea", "Eczema", "General Dermatology"],
    },
    {
      userId: "30000000-0000-4000-8000-000000000004",
      profileId: "31000000-0000-4000-8000-000000000004",
      name: "Dr. Samira Hossain",
      email: "dr.samira.hossain.demo@dermacare.internal",
      phone: "+8801811000004",
      licenseNumber: "BMDC-DOC-00104",
      experienceYears: 13,
      consultationFee: new Prisma.Decimal("1200.00"),
      rating: new Prisma.Decimal("4.89"),
      ratingCount: 31,
      qualifications: ["MBBS (SOMC)", "FCPS (Dermatology)", "Fellow Pigmentary Disorders (Singapore)"],
      bio: "Dedicated pigmentation specialist dealing with vitiligo repigmentation therapies, melasma, post-inflammatory hyperpigmentation, and sun damage.",
      specialtyNames: ["Vitiligo", "Sun Damage", "General Dermatology"],
    },
    {
      userId: "30000000-0000-4000-8000-000000000005",
      profileId: "31000000-0000-4000-8000-000000000005",
      name: "Dr. Tariqul Islam Chowdhury",
      email: "dr.tariqul.chowdhury.demo@dermacare.internal",
      phone: "+8801811000005",
      licenseNumber: "BMDC-DOC-00105",
      experienceYears: 15,
      consultationFee: new Prisma.Decimal("1800.00"),
      rating: new Prisma.Decimal("4.95"),
      ratingCount: 44,
      qualifications: ["MBBS (DMC)", "MD (Dermatology)", "Fellow Dermato-Oncology (UK)"],
      bio: "Dermato-oncology consultant with focus on dysplastic nevi, early skin lesion identification, actinic keratoses, and photodynamic therapy.",
      specialtyNames: ["Skin Cancer", "Psoriasis", "General Dermatology"],
    },
  ];

  for (const d of doctorData) {
    const user = await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
        id: d.userId,
        name: d.name,
        email: d.email,
        phone: d.phone,
        role: Role.DOCTOR,
        status: AccountStatus.ACTIVE,
        emailVerified: true,
        consentVersion: "v1.0",
        termsAcceptedAt: new Date("2026-01-01T00:00:00Z"),
        privacyAcceptedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    await prisma.authIdentity.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: AuthProvider.PASSWORD,
        },
      },
      update: {},
      create: {
        userId: user.id,
        provider: AuthProvider.PASSWORD,
        providerId: user.id,
        passwordHash: userPasswordHash,
      },
    });

    const docProfile = await prisma.doctorProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        id: d.profileId,
        userId: user.id,
        licenseNumber: d.licenseNumber,
        experienceYears: d.experienceYears,
        consultationFee: d.consultationFee,
        rating: d.rating,
        ratingCount: d.ratingCount,
        qualifications: d.qualifications,
        bio: d.bio,
        documentReferences: [`docs/doctor-license-${d.licenseNumber}.pdf`],
        approvalStatus: DoctorApprovalStatus.APPROVED,
        approvedById: adminUser.id,
        approvedAt: new Date("2026-01-10T00:00:00Z"),
      },
    });

    for (const specName of d.specialtyNames) {
      const specId = specMap.get(specName);
      if (specId) {
        await prisma.doctorSpecialization.upsert({
          where: {
            doctorId_specializationId: {
              doctorId: docProfile.id,
              specializationId: specId,
            },
          },
          update: {},
          create: {
            doctorId: docProfile.id,
            specializationId: specId,
          },
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. DOCTOR SLOTS (25 Slots across 5 Doctors)
  // --------------------------------------------------------------------------
  console.log("4. Seeding Doctor Slots...");
  let slotIndex = 1;
  for (let docIdx = 1; docIdx <= 5; docIdx++) {
    const docProfileId = `31000000-0000-4000-8000-00000000000${docIdx}`;
    for (let sIdx = 1; sIdx <= 5; sIdx++) {
      const slotId = `33000000-0000-4000-8000-${String(slotIndex).padStart(12, "0")}`;
      // Booked for first few slots, Available for remaining
      const isBooked = (docIdx === 1 && sIdx <= 3) ||
                       (docIdx === 2 && sIdx <= 3) ||
                       (docIdx === 3 && sIdx <= 3) ||
                       (docIdx === 4 && sIdx <= 2) ||
                       (docIdx === 5 && sIdx <= 1);
      
      const dayOffset = (sIdx % 3) + 1;
      const startHour = 9 + (sIdx * 2);
      const startTime = new Date(`2026-10-2${dayOffset}T${String(startHour).padStart(2, "0")}:00:00Z`);
      const endTime = new Date(`2026-10-2${dayOffset}T${String(startHour).padStart(2, "0")}:30:00Z`);

      await prisma.doctorSlot.upsert({
        where: { id: slotId },
        update: {},
        create: {
          id: slotId,
          doctorId: docProfileId,
          startTime,
          endTime,
          status: isBooked ? SlotStatus.BOOKED : SlotStatus.AVAILABLE,
        },
      });
      slotIndex++;
    }
  }

  // --------------------------------------------------------------------------
  // 5. MEDICINES & STORE INVENTORY (20 Medicines)
  // --------------------------------------------------------------------------
  console.log("5. Seeding 20 Medicines with Pricing and Inventory...");
  const medicineList = [
    { idx: 1, name: "Adapalene Gel 0.1%", strength: "0.1% w/w 30g", requiresRx: true, price: "280.00", stock: 85, desc: "Topical retinoid for mild-to-moderate acne vulgaris." },
    { idx: 2, name: "Benzoyl Peroxide 2.5% Wash", strength: "2.5% w/v 100ml", requiresRx: false, price: "340.00", stock: 120, desc: "Antimicrobial cleanser for inflammatory acne lesions." },
    { idx: 3, name: "Clindamycin Phosphate 1% Solution", strength: "1% w/v 30ml", requiresRx: true, price: "210.00", stock: 65, desc: "Topical antibiotic for inflammatory papules and pustules." },
    { idx: 4, name: "Hydrocortisone 1% Cream", strength: "1% w/w 20g", requiresRx: false, price: "120.00", stock: 150, desc: "Mild topical corticosteroid for acute eczema flares and itching." },
    { idx: 5, name: "Mometasone Furoate 0.1% Ointment", strength: "0.1% w/w 15g", requiresRx: true, price: "260.00", stock: 70, desc: "Medium-potency corticosteroid for localized plaque psoriasis and eczema." },
    { idx: 6, name: "Calcipotriol 0.005% Ointment", strength: "0.005% w/w 30g", requiresRx: true, price: "480.00", stock: 45, desc: "Vitamin D3 analogue for chronic plaque psoriasis management." },
    { idx: 7, name: "Ketoconazole 2% Shampoo", strength: "2% w/v 100ml", requiresRx: false, price: "320.00", stock: 90, desc: "Antifungal shampoo for seborrheic dermatitis and pityriasis versicolor." },
    { idx: 8, name: "Terbinafine 1% Cream", strength: "1% w/w 15g", requiresRx: false, price: "190.00", stock: 110, desc: "Broad-spectrum allylamine topical antifungal for tinea pedis and corporis." },
    { idx: 9, name: "Metronidazole 0.75% Gel", strength: "0.75% w/w 30g", requiresRx: true, price: "240.00", stock: 55, desc: "First-line topical treatment for inflammatory rosacea erythema." },
    { idx: 10, name: "Ivermectin 1% Cream", strength: "1% w/w 30g", requiresRx: true, price: "650.00", stock: 40, desc: "Anti-parasitic and anti-inflammatory cream for papulopustular rosacea." },
    { idx: 11, name: "Tacrolimus 0.1% Ointment", strength: "0.1% w/w 10g", requiresRx: true, price: "720.00", stock: 35, desc: "Calcineurin inhibitor for facial eczema and vitiligo repigmentation." },
    { idx: 12, name: "Salicylic Acid 2% Exfoliating Cleanser", strength: "2% w/v 150ml", requiresRx: false, price: "410.00", stock: 95, desc: "Beta-hydroxy acid cleanser targeting blackheads and hyperkeratosis." },
    { idx: 13, name: "Azelaic Acid 15% Gel", strength: "15% w/w 30g", requiresRx: true, price: "520.00", stock: 60, desc: "Dicarboxylic acid addressing rosacea, comedones, and post-acne pigmentation." },
    { idx: 14, name: "Permethrin 5% Lotion", strength: "5% w/v 60ml", requiresRx: false, price: "180.00", stock: 80, desc: "Scabicidal medication for scabies and mite eradication." },
    { idx: 15, name: "Ceramide Moisturizing Cream", strength: "200g jar", requiresRx: false, price: "850.00", stock: 130, desc: "Lipid barrier replenishment cream formulated for atopic and dry skin." },
    { idx: 16, name: "Broad Spectrum Mineral SPF 50+ Sunscreen", strength: "50ml tube", requiresRx: false, price: "980.00", stock: 140, desc: "Zinc oxide based non-comedogenic physical barrier photoprotection." },
    { idx: 17, name: "Fucidic Acid 2% Cream", strength: "2% w/w 15g", requiresRx: true, price: "175.00", stock: 105, desc: "Narrow-spectrum topical antibiotic for primary staphylococcal impetigo." },
    { idx: 18, name: "Calamine Soothing Lotion", strength: "100ml bottle", requiresRx: false, price: "110.00", stock: 160, desc: "Astringent zinc oxide lotion for pruritus and acute contact irritation." },
    { idx: 19, name: "Urea 10% Intensive Repair Lotion", strength: "10% w/w 100ml", requiresRx: false, price: "290.00", stock: 75, desc: "Keratolytic emollient for severe xerosis and ichthyosiform skin." },
    { idx: 20, name: "Doxycycline Hyclate 100mg Capsules", strength: "100mg (10 caps)", requiresRx: true, price: "150.00", stock: 50, desc: "Oral tetracycline antibiotic for moderate-to-severe inflammatory acne and rosacea." },
  ];

  for (const m of medicineList) {
    const medId = `40000000-0000-4000-8000-${String(m.idx).padStart(12, "0")}`;
    const invId = `41000000-0000-4000-8000-${String(m.idx).padStart(12, "0")}`;

    await prisma.medicine.upsert({
      where: { id: medId },
      update: {},
      create: {
        id: medId,
        name: m.name,
        strength: m.strength,
        description: m.desc,
        requiresPrescription: m.requiresRx,
        isVerified: true,
        verifiedById: adminUser.id,
        verifiedAt: new Date("2026-01-10T00:00:00Z"),
      },
    });

    await prisma.storeInventory.upsert({
      where: { medicineId: medId },
      update: {},
      create: {
        id: invId,
        medicineId: medId,
        price: new Prisma.Decimal(m.price),
        stockQuantity: m.stock,
        isAvailable: true,
      },
    });
  }

  // --------------------------------------------------------------------------
  // 6. SCREENINGS (15 Screenings with realistic demo predictions)
  // --------------------------------------------------------------------------
  console.log("6. Seeding 15 AI Screening Cases and Predictions...");
  const conditionList = await prisma.condition.findMany();
  const condMap = new Map<string, string>();
  for (const c of conditionList) {
    condMap.set(c.name, c.id);
  }

  const screeningCases = [
    {
      idx: 1,
      patientIdx: 2,
      symptoms: "Breakouts on cheeks and chin with inflammatory red papules",
      conditionName: "Acne",
      score: "92.40",
      risk: RiskCategory.LOW,
      redFlag: false,
    },
    {
      idx: 2,
      patientIdx: 1,
      symptoms: "Severe dry, red, itchy patches in the antecubital fossae",
      conditionName: "Eczema",
      score: "88.75",
      risk: RiskCategory.MEDIUM,
      redFlag: false,
    },
    {
      idx: 3,
      patientIdx: 3,
      symptoms: "Thick erythematous scaly plaques over extensor surface of elbows",
      conditionName: "Psoriasis",
      score: "91.10",
      risk: RiskCategory.HIGH,
      redFlag: true,
    },
    {
      idx: 4,
      patientIdx: 6,
      symptoms: "Facial flushing with persistent central redness and telangiectasia",
      conditionName: "Rosacea",
      score: "85.30",
      risk: RiskCategory.MEDIUM,
      redFlag: false,
    },
    {
      idx: 5,
      patientIdx: 7,
      symptoms: "Annular erythematous scaly ring on the right forearm",
      conditionName: "Tinea",
      score: "89.60",
      risk: RiskCategory.LOW,
      redFlag: false,
    },
    {
      idx: 6,
      patientIdx: 8,
      symptoms: "Well-demarcated depigmented patches on dorsal hands",
      conditionName: "Vitiligo",
      score: "94.20",
      risk: RiskCategory.MEDIUM,
      redFlag: false,
    },
    {
      idx: 7,
      patientIdx: 4,
      symptoms: "Irregular pigmented macule with asymmetric borders on upper back",
      conditionName: "Skin Cancer",
      score: "78.50",
      risk: RiskCategory.CRITICAL,
      redFlag: true,
    },
    {
      idx: 8,
      patientIdx: 1,
      symptoms: "Comedones and mild pustules around forehead region",
      conditionName: "Acne",
      score: "86.10",
      risk: RiskCategory.LOW,
      redFlag: false,
    },
    {
      idx: 9,
      patientIdx: 5,
      symptoms: "Intensely pruritic nummular lesions on lower legs",
      conditionName: "Eczema",
      score: "83.40",
      risk: RiskCategory.MEDIUM,
      redFlag: false,
    },
    {
      idx: 10,
      patientIdx: 3,
      symptoms: "Scalp scaling and silvery flakes near hairline",
      conditionName: "Psoriasis",
      score: "90.00",
      risk: RiskCategory.HIGH,
      redFlag: true,
    },
    {
      idx: 11,
      patientIdx: 2,
      symptoms: "Erythematous intertriginous rash with satellite pustules",
      conditionName: "Candidiasis",
      score: "87.80",
      risk: RiskCategory.LOW,
      redFlag: false,
    },
    {
      idx: 12,
      patientIdx: 4,
      symptoms: "Polygonal violaceous pruritic papules on inner wrists",
      conditionName: "Lichen",
      score: "81.25",
      risk: RiskCategory.MEDIUM,
      redFlag: false,
    },
    {
      idx: 13,
      patientIdx: 5,
      symptoms: "Hyperkeratotic verrucous papule on index finger",
      conditionName: "Warts",
      score: "93.00",
      risk: RiskCategory.LOW,
      redFlag: false,
    },
    {
      idx: 14,
      patientIdx: 6,
      symptoms: "Rough erythematous actinic macules on sun-exposed forehead",
      conditionName: "Actinic Keratosis",
      score: "84.90",
      risk: RiskCategory.MEDIUM,
      redFlag: false,
    },
    {
      idx: 15,
      patientIdx: 8,
      symptoms: "Generalized morbilliform maculopapular rash after medication",
      conditionName: "Drug Eruption",
      score: "89.15",
      risk: RiskCategory.HIGH,
      redFlag: true,
    },
  ];

  for (const sc of screeningCases) {
    const scId = `50000000-0000-4000-8000-${String(sc.idx).padStart(12, "0")}`;
    const patProfileId = `21000000-0000-4000-8000-00000000000${sc.patientIdx}`;
    const imgId = `51000000-0000-4000-8000-${String(sc.idx).padStart(12, "0")}`;
    const condId = condMap.get(sc.conditionName) || condMap.get("Acne");

    await prisma.screening.upsert({
      where: { id: scId },
      update: {},
      create: {
        id: scId,
        patientId: patProfileId,
        symptoms: sc.symptoms,
        imageQualityStatus: ImageQualityStatus.GOOD,
        riskLevel: sc.risk,
        redFlagDetected: sc.redFlag,
        aiStatus: ScreeningStatus.COMPLETED,
        disclaimer: "AI-assisted preliminary screening. Not a definitive clinical diagnosis.",
      },
    });

    await prisma.screeningImage.upsert({
      where: { id: imgId },
      update: {},
      create: {
        id: imgId,
        screeningId: scId,
        storageKey: `demo/screenings/screening_${sc.idx}.jpg`,
        imageType: ImageType.FRONT,
      },
    });

    if (condId) {
      await prisma.screeningPrediction.upsert({
        where: {
          screeningId_conditionId: {
            screeningId: scId,
            conditionId: condId,
          },
        },
        update: {},
        create: {
          screeningId: scId,
          conditionId: condId,
          confidenceScore: new Prisma.Decimal(sc.score),
        },
      });
    }
  }

  // --------------------------------------------------------------------------
  // 7. APPOINTMENTS (12 Appointments with valid lifecycle statuses)
  // --------------------------------------------------------------------------
  console.log("7. Seeding 12 Appointments...");
  const appointmentData = [
    { idx: 1, patIdx: 1, docIdx: 1, slotIdx: 1, scIdx: 2, status: AppointmentStatus.COMPLETED, link: "https://meet.dermacare.internal/consult-001" },
    { idx: 2, patIdx: 3, docIdx: 1, slotIdx: 2, scIdx: 3, status: AppointmentStatus.COMPLETED, link: "https://meet.dermacare.internal/consult-002" },
    { idx: 3, patIdx: 5, docIdx: 1, slotIdx: 3, scIdx: 9, status: AppointmentStatus.CONFIRMED, link: "https://meet.dermacare.internal/consult-003" },
    { idx: 4, patIdx: 2, docIdx: 2, slotIdx: 6, scIdx: 1, status: AppointmentStatus.COMPLETED, link: "https://meet.dermacare.internal/consult-004" },
    { idx: 5, patIdx: 6, docIdx: 2, slotIdx: 7, scIdx: 4, status: AppointmentStatus.COMPLETED, link: "https://meet.dermacare.internal/consult-005" },
    { idx: 6, patIdx: 1, docIdx: 2, slotIdx: 8, scIdx: 8, status: AppointmentStatus.CONFIRMED, link: "https://meet.dermacare.internal/consult-006" },
    { idx: 7, patIdx: 7, docIdx: 3, slotIdx: 11, scIdx: 5, status: AppointmentStatus.COMPLETED, link: "https://meet.dermacare.internal/consult-007" },
    { idx: 8, patIdx: 4, docIdx: 3, slotIdx: 12, scIdx: 12, status: AppointmentStatus.COMPLETED, link: "https://meet.dermacare.internal/consult-008" },
    { idx: 9, patIdx: 5, docIdx: 3, slotIdx: 13, scIdx: 13, status: AppointmentStatus.HELD, link: null },
    { idx: 10, patIdx: 8, docIdx: 4, slotIdx: 16, scIdx: 6, status: AppointmentStatus.CANCELLATION_REQUESTED, link: null },
    { idx: 11, patIdx: 3, docIdx: 4, slotIdx: 17, scIdx: 10, status: AppointmentStatus.CANCELLED, link: null },
    { idx: 12, patIdx: 4, docIdx: 5, slotIdx: 21, scIdx: 7, status: AppointmentStatus.NO_SHOW, link: "https://meet.dermacare.internal/consult-012" },
  ];

  for (const app of appointmentData) {
    const appId = `60000000-0000-4000-8000-${String(app.idx).padStart(12, "0")}`;
    const patId = `21000000-0000-4000-8000-00000000000${app.patIdx}`;
    const docId = `31000000-0000-4000-8000-00000000000${app.docIdx}`;
    const slotId = `33000000-0000-4000-8000-${String(app.slotIdx).padStart(12, "0")}`;
    const scId = `50000000-0000-4000-8000-${String(app.scIdx).padStart(12, "0")}`;

    await prisma.appointment.upsert({
      where: { id: appId },
      update: {},
      create: {
        id: appId,
        patientId: patId,
        doctorId: docId,
        slotId: slotId,
        screeningId: scId,
        status: app.status,
        videoLink: app.link,
        historySharingConsent: true,
        meetingProvisioningStatus: app.link ? MeetingProvisioningStatus.READY : MeetingProvisioningStatus.NOT_REQUESTED,
        holdExpiresAt: app.status === AppointmentStatus.HELD ? new Date(Date.now() + 15 * 60_000) : null,
        cancellationRequestedAt: app.status === AppointmentStatus.CANCELLATION_REQUESTED ? new Date() : null,
        cancellationReason: app.status === AppointmentStatus.CANCELLED ? "Schedule conflict requested by patient" : null,
      },
    });
  }

  // --------------------------------------------------------------------------
  // 8. PRESCRIPTIONS (6 Prescriptions linked to completed appointments)
  // --------------------------------------------------------------------------
  console.log("8. Seeding 6 Prescriptions with Clinical Line Items...");
  const prescriptionData = [
    {
      idx: 1,
      appIdx: 1,
      docIdx: 1,
      findings: "Eczematous patches on flexural surfaces. Mild epidermal barrier dysfunction.",
      advice: "Take warm short showers. Apply moisturizer within 3 minutes of bathing. Avoid harsh soaps.",
      followUp: "Review after 3 weeks if pruritus persists.",
      items: [
        { medIdx: 4, dosage: "Apply thin layer", freq: "Twice daily", dur: "7 days", inst: "Apply only to affected red areas." },
        { medIdx: 15, dosage: "Liberal amount", freq: "3 times daily", dur: "30 days", inst: "Gentle massage until absorbed." },
      ],
    },
    {
      idx: 2,
      appIdx: 2,
      docIdx: 1,
      findings: "Chronic plaque psoriasis over bilateral extensor surfaces. Stable.",
      advice: "Avoid direct friction and skin injury (Koebner phenomenon). Daily gentle hydration.",
      followUp: "Follow up in 4 weeks for plaque clearance assessment.",
      items: [
        { medIdx: 6, dosage: "Apply to plaques", freq: "Once daily", dur: "4 weeks", inst: "Do not exceed recommended surface area." },
        { medIdx: 5, dosage: "Apply sparingly", freq: "Once at night", dur: "14 days", inst: "Taper down after improvement." },
      ],
    },
    {
      idx: 3,
      appIdx: 4,
      docIdx: 2,
      findings: "Papulopustular acne vulgaris grade II with early closed comedones.",
      advice: "Gentle non-stripping cleanser. Avoid comedogenic cosmetics. Use oil-free sunblock.",
      followUp: "Review in 6 weeks.",
      items: [
        { medIdx: 1, dosage: "Pea-sized amount", freq: "Every other night", dur: "6 weeks", inst: "Wash face thoroughly before applying." },
        { medIdx: 2, dosage: "Wash affected area", freq: "Once daily morning", dur: "6 weeks", inst: "Rinse completely with lukewarm water." },
      ],
    },
    {
      idx: 4,
      appIdx: 5,
      docIdx: 2,
      findings: "Erythematotelangiectatic rosacea with sensitive facial skin barrier.",
      advice: "Avoid spicy foods, direct heat exposure, and hot beverages. Strict photoprotection.",
      followUp: "Review in 4 weeks.",
      items: [
        { medIdx: 9, dosage: "Thin film", freq: "Twice daily", dur: "4 weeks", inst: "Apply to central facial erythema." },
        { medIdx: 16, dosage: "Generous application", freq: "Every morning", dur: "Ongoing", inst: "Reapply after sweating or face wash." },
      ],
    },
    {
      idx: 5,
      appIdx: 7,
      docIdx: 3,
      findings: "Tinea corporis with annular erythematous scaling edge.",
      advice: "Keep skin folds dry. Wear loose cotton clothing. Complete entire topical antifungal course.",
      followUp: "Review in 2 weeks.",
      items: [
        { medIdx: 8, dosage: "Apply 2cm beyond margin", freq: "Twice daily", dur: "2 weeks", inst: "Continue for 1 week after lesions clear." },
      ],
    },
    {
      idx: 6,
      appIdx: 8,
      docIdx: 3,
      findings: "Lichen planus papules with intense focal pruritus.",
      advice: "Avoid vigorous scratching. Use gentle moisturizing cleansers.",
      followUp: "Clinical review in 3 weeks.",
      items: [
        { medIdx: 5, dosage: "Targeted application", freq: "Twice daily", dur: "14 days", inst: "Limit to violaceous papules." },
        { medIdx: 18, dosage: "Apply as needed", freq: "PRN itch", dur: "10 days", inst: "Shake lotion bottle well before applying." },
      ],
    },
  ];

  for (const p of prescriptionData) {
    const rxId = `70000000-0000-4000-8000-${String(p.idx).padStart(12, "0")}`;
    const appId = `60000000-0000-4000-8000-${String(p.appIdx).padStart(12, "0")}`;
    const docId = `31000000-0000-4000-8000-00000000000${p.docIdx}`;

    await prisma.prescription.upsert({
      where: { id: rxId },
      update: {},
      create: {
        id: rxId,
        appointmentId: appId,
        doctorId: docId,
        findings: p.findings,
        advice: p.advice,
        followUp: p.followUp,
        sentAt: new Date(),
      },
    });

    let itemIdx = 1;
    for (const it of p.items) {
      const medId = `40000000-0000-4000-8000-${String(it.medIdx).padStart(12, "0")}`;
      const med = medicineList.find(m => m.idx === it.medIdx);
      const itemId = `71000000-0000-4000-8000-${String(p.idx).padStart(6, "0")}${String(itemIdx).padStart(6, "0")}`;

      await prisma.prescriptionItem.upsert({
        where: { id: itemId },
        update: {},
        create: {
          id: itemId,
          prescriptionId: rxId,
          medicineId: medId,
          medicineName: med ? med.name : "Topical Medicine",
          dosage: it.dosage,
          frequency: it.freq,
          duration: it.dur,
          instructions: it.inst,
        },
      });
      itemIdx++;
    }
  }

  // --------------------------------------------------------------------------
  // 9. ORDERS & ORDER ITEMS (8 Orders)
  // --------------------------------------------------------------------------
  console.log("9. Seeding 8 Medicine Store Orders and Fulfillment States...");
  const orderData = [
    { idx: 1, patIdx: 1, rxIdx: 1, status: OrderStatus.DELIVERED, address: "House 24, Road 7, Dhanmondi, Dhaka", total: "1090.00", items: [{ medIdx: 4, qty: 2, price: "120.00" }, { medIdx: 15, qty: 1, price: "850.00" }] },
    { idx: 2, patIdx: 2, rxIdx: 3, status: OrderStatus.PROCESSING, address: "Flat 4B, Green View Tower, Uttara, Dhaka", total: "620.00", items: [{ medIdx: 1, qty: 1, price: "280.00" }, { medIdx: 2, qty: 1, price: "340.00" }] },
    { idx: 3, patIdx: 3, rxIdx: 2, status: OrderStatus.CONFIRMED, address: "Lane 3, O.R. Nizam Road, GEC, Chattogram", total: "840.00", items: [{ medIdx: 6, qty: 1, price: "480.00" }, { medIdx: 5, qty: 1, price: "260.00" }, { medIdx: 18, qty: 1, price: "100.00" }] },
    { idx: 4, patIdx: 6, rxIdx: 4, status: OrderStatus.DELIVERED, address: "Holding 15, Station Road, Sylhet", total: "1390.00", items: [{ medIdx: 9, qty: 1, price: "240.00" }, { medIdx: 16, qty: 1, price: "980.00" }, { medIdx: 17, qty: 1, price: "170.00" }] },
    { idx: 5, patIdx: 7, rxIdx: 5, status: OrderStatus.PACKED, address: "52 South Central Road, Khulna", total: "370.00", items: [{ medIdx: 8, qty: 1, price: "190.00" }, { medIdx: 14, qty: 1, price: "180.00" }] },
    { idx: 6, patIdx: 4, rxIdx: 6, status: OrderStatus.PENDING, address: "House 12, Road 4, Banani DOHS, Dhaka", total: "480.00", items: [{ medIdx: 5, qty: 1, price: "260.00" }, { medIdx: 3, qty: 1, price: "210.00" }, { medIdx: 18, qty: 1, price: "10.00" }] },
    { idx: 7, patIdx: 5, rxIdx: null, status: OrderStatus.OUT_FOR_DELIVERY, address: "Plot 88, Block C, Bashundhara R/A, Dhaka", total: "690.00", items: [{ medIdx: 7, qty: 1, price: "320.00" }, { medIdx: 19, qty: 1, price: "290.00" }, { medIdx: 18, qty: 1, price: "80.00" }] },
    { idx: 8, patIdx: 8, rxIdx: null, status: OrderStatus.CANCELLED, address: "House 31, Sector 7, Uttara, Dhaka", total: "420.00", items: [{ medIdx: 12, qty: 1, price: "410.00" }, { medIdx: 18, qty: 1, price: "10.00" }] },
  ];

  for (const o of orderData) {
    const orderId = `80000000-0000-4000-8000-${String(o.idx).padStart(12, "0")}`;
    const patId = `21000000-0000-4000-8000-00000000000${o.patIdx}`;
    const rxId = o.rxIdx ? `70000000-0000-4000-8000-${String(o.rxIdx).padStart(12, "0")}` : null;

    await prisma.order.upsert({
      where: { id: orderId },
      update: {},
      create: {
        id: orderId,
        patientId: patId,
        prescriptionId: rxId,
        status: o.status,
        totalAmount: new Prisma.Decimal(o.total),
        deliveryAddress: o.address,
        paymentExpiresAt: new Date(Date.now() + 48 * 60 * 60_000),
      },
    });

    let oiIdx = 1;
    for (const it of o.items) {
      const invId = `41000000-0000-4000-8000-${String(it.medIdx).padStart(12, "0")}`;
      const med = medicineList.find(m => m.idx === it.medIdx);
      const oiId = `81000000-0000-4000-8000-${String(o.idx).padStart(6, "0")}${String(oiIdx).padStart(6, "0")}`;
      const unitPrice = new Prisma.Decimal(it.price);
      const subtotal = unitPrice.mul(it.qty);

      await prisma.orderItem.upsert({
        where: { id: oiId },
        update: {},
        create: {
          id: oiId,
          orderId: orderId,
          inventoryId: invId,
          medicineName: med ? med.name : "Dermatology Item",
          medicineStrength: med ? med.strength : null,
          quantity: it.qty,
          unitPrice: unitPrice,
          subtotal: subtotal,
        },
      });
      oiIdx++;
    }
  }

  // --------------------------------------------------------------------------
  // 10. DOCTOR EARNINGS & PAYOUT EXAMPLE
  // --------------------------------------------------------------------------
  console.log("10. Seeding Doctor Earnings & Payout Ledger Example...");
  const payoutId = "34000000-0000-4000-8000-000000000001";
  const payoutItemId = "35000000-0000-4000-8000-000000000001";
  const doctor1ProfileId = "31000000-0000-4000-8000-000000000001";
  const appt1Id = "60000000-0000-4000-8000-000000000001";

  await prisma.doctorPayout.upsert({
    where: {
      doctorId_periodStart_periodEnd: {
        doctorId: doctor1ProfileId,
        periodStart: new Date("2026-10-01T00:00:00Z"),
        periodEnd: new Date("2026-10-15T00:00:00Z"),
      },
    },
    update: {},
    create: {
      id: payoutId,
      doctorId: doctor1ProfileId,
      periodStart: new Date("2026-10-01T00:00:00Z"),
      periodEnd: new Date("2026-10-15T00:00:00Z"),
      totalConsultations: 1,
      grossAmount: new Prisma.Decimal("1500.00"),
      platformFee: new Prisma.Decimal("150.00"),
      netAmount: new Prisma.Decimal("1350.00"),
      status: PayoutStatus.PENDING,
      notes: "Demo cycle bi-weekly consultation remittance for development environment.",
    },
  });

  await prisma.doctorPayoutItem.upsert({
    where: { appointmentId: appt1Id },
    update: {},
    create: {
      id: payoutItemId,
      payoutId: payoutId,
      appointmentId: appt1Id,
      consultationAmount: new Prisma.Decimal("1500.00"),
      platformFee: new Prisma.Decimal("150.00"),
      doctorAmount: new Prisma.Decimal("1350.00"),
    },
  });

  // --------------------------------------------------------------------------
  // 11. NOTIFICATIONS
  // --------------------------------------------------------------------------
  console.log("11. Seeding Patient Notifications...");
  const notificationList = [
    {
      id: "90000000-0000-4000-8000-000000000001",
      userId: "20000000-0000-4000-8000-000000000001",
      title: "Prescription Issued",
      message: "Prof. Dr. Syed Moniruzzaman has provided your digital treatment plan and prescription.",
      type: NotificationType.PRESCRIPTION,
      entityType: "Prescription",
      entityId: "70000000-0000-4000-8000-000000000001",
    },
    {
      id: "90000000-0000-4000-8000-000000000002",
      userId: "20000000-0000-4000-8000-000000000001",
      title: "Medication Order Shipped",
      message: "Your dermatology medication parcel has been dispatched and delivered.",
      type: NotificationType.ORDER,
      entityType: "Order",
      entityId: "80000000-0000-4000-8000-000000000001",
    },
    {
      id: "90000000-0000-4000-8000-000000000003",
      userId: "20000000-0000-4000-8000-000000000002",
      title: "AI Screening Result Ready",
      message: "Your acne screening analysis has completed with Low Risk preliminary guidance.",
      type: NotificationType.SYSTEM,
      entityType: "Screening",
      entityId: "50000000-0000-4000-8000-000000000001",
    },
    {
      id: "90000000-0000-4000-8000-000000000004",
      userId: "20000000-0000-4000-8000-000000000002",
      title: "Upcoming Video Consultation",
      message: "Dr. Naila Parveen has confirmed your consultation session.",
      type: NotificationType.APPOINTMENT,
      entityType: "Appointment",
      entityId: "60000000-0000-4000-8000-000000000004",
    },
    {
      id: "90000000-0000-4000-8000-000000000005",
      userId: "20000000-0000-4000-8000-000000000003",
      title: "Appointment Reminder",
      message: "Your consultation session with Prof. Dr. Syed Moniruzzaman is scheduled.",
      type: NotificationType.APPOINTMENT,
      entityType: "Appointment",
      entityId: "60000000-0000-4000-8000-000000000002",
    },
    {
      id: "90000000-0000-4000-8000-000000000006",
      userId: "20000000-0000-4000-8000-000000000004",
      title: "Clinical Screening Notice",
      message: "A red-flag recommendation was generated for your back lesion. Dermatologist consultation advised.",
      type: NotificationType.SYSTEM,
      entityType: "Screening",
      entityId: "50000000-0000-4000-8000-000000000007",
    },
    {
      id: "90000000-0000-4000-8000-000000000007",
      userId: "20000000-0000-4000-8000-000000000005",
      title: "Order Out for Delivery",
      message: "Delivery partner is en route with your skincare order package.",
      type: NotificationType.ORDER,
      entityType: "Order",
      entityId: "80000000-0000-4000-8000-000000000007",
    },
    {
      id: "90000000-0000-4000-8000-000000000008",
      userId: "20000000-0000-4000-8000-000000000006",
      title: "Treatment Advice Sent",
      message: "New prescription instructions issued for your facial rosacea maintenance.",
      type: NotificationType.PRESCRIPTION,
      entityType: "Prescription",
      entityId: "70000000-0000-4000-8000-000000000004",
    },
    {
      id: "90000000-0000-4000-8000-000000000009",
      userId: "20000000-0000-4000-8000-000000000007",
      title: "Pharmacy Order Packed",
      message: "Your medication has been verified and securely packed.",
      type: NotificationType.ORDER,
      entityType: "Order",
      entityId: "80000000-0000-4000-8000-000000000005",
    },
    {
      id: "90000000-0000-4000-8000-000000000010",
      userId: "20000000-0000-4000-8000-000000000008",
      title: "Account Security Verified",
      message: "Your DermaCare AI patient account has been authenticated.",
      type: NotificationType.ACCOUNT,
      entityType: "User",
      entityId: "20000000-0000-4000-8000-000000000008",
    },
  ];

  for (const n of notificationList) {
    await prisma.notification.upsert({
      where: { id: n.id },
      update: {},
      create: {
        id: n.id,
        userId: n.userId,
        title: n.title,
        message: n.message,
        notificationType: n.type,
        relatedEntityType: n.entityType,
        relatedEntityId: n.entityId,
        isRead: false,
      },
    });
  }

  console.log("\n=== Demo Database Seed Completed Successfully ===");
}

main()
  .catch((err) => {
    console.error("FATAL SEED ERROR:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabaseConnections();
  });

