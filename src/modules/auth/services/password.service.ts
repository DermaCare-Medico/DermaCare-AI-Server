
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, SALT_ROUNDS);

export const verifyPassword = async (
  hash: string,
  plain: string,
): Promise<boolean> => {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
};

// Used when the email is unknown to reduce timing differences.
let dummyHash: string | undefined;

export const burnPasswordCheck = async (
  plain: string,
): Promise<void> => {
  dummyHash ??= await hashPassword("dummy-password-for-timing");
  await verifyPassword(dummyHash, plain);
};
