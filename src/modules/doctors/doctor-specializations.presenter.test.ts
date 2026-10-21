import assert from "node:assert/strict";
import test from "node:test";

import { presentDoctorSpecializations } from "./doctor-specializations.presenter.js";

test("presents zero Doctor specializations", () => {
  assert.deepEqual(presentDoctorSpecializations([]), {
    specialization: null,
    specializations: [],
  });
});

test("presents one Doctor specialization in both compatible fields", () => {
  const dermatology = { id: "dermatology", name: "Dermatology" };
  assert.deepEqual(presentDoctorSpecializations([{ specialization: dermatology }]), {
    specialization: dermatology,
    specializations: [dermatology],
  });
});

test("preserves multiple Doctor specializations", () => {
  const dermatology = { id: "dermatology", name: "Dermatology" };
  const pediatrics = { id: "pediatrics", name: "Pediatric Dermatology" };
  assert.deepEqual(
    presentDoctorSpecializations([
      { specialization: dermatology },
      { specialization: pediatrics },
    ]),
    {
      specialization: dermatology,
      specializations: [dermatology, pediatrics],
    },
  );
});
