const { z } = require("zod");
const UsersRepository = require("./users.repository");

const VALID_ID_TYPES = ["nin", "voters_card", "passport", "drivers_license"];

const userPayloadSchema = z
  .object({
    displayName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    photoURL: z.string().url().nullable().optional(),
    preferences: z
      .object({
        locale: z.string().optional(),
        theme: z.string().optional(),
      })
      .partial()
      .optional(),
    roles: z.array(z.string()).optional(),
    emailVerified: z.boolean().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
    passwordHash: z.string().optional(),
    phone: z.string().optional(),
  })
  .passthrough();

// Standard user DTO — used for list/get endpoints. Includes the staff profile
// fields needed for the admin verification queue and the user's own profile.
function toUserDTO(doc) {
  if (!doc) return null;
  return {
    id:                    doc.id,
    displayName:           doc.displayName || null,
    email:                 doc.email || null,
    photoURL:              typeof doc.photoURL === "string" ? doc.photoURL : null,
    preferences:           doc.preferences || {},
    roles:                 doc.roles || [],
    emailVerified:         !!doc.emailVerified,

    // Staff profile (mirrors riders)
    phone:                 doc.phone || null,
    phoneVerifiedAt:       doc.phoneVerifiedAt || null,
    govtIdType:            doc.govtIdType || null,
    govtIdNumber:          doc.govtIdNumber || null,
    govtIdVerifiedAt:      doc.govtIdVerifiedAt || null,
    govtIdVerifiedBy:      doc.govtIdVerifiedBy || null,
    govtIdRejectionReason: doc.govtIdRejectionReason || null,
    verificationState:     doc.verificationState || "missing",
  };
}

function toUserDTOWithPhoto(doc) {
  const base = toUserDTO(doc);
  if (!base) return null;
  return { ...base, govtIdPhoto: doc.govtIdPhoto || null };
}

async function listUsers() {
  const docs = await UsersRepository.list();
  return docs.map(toUserDTO).filter(Boolean);
}

async function listPendingVerification() {
  const docs = await UsersRepository.listPendingVerification();
  return docs.map(toUserDTOWithPhoto).filter(Boolean);
}

async function getUser(id, opts = {}) {
  const doc = await UsersRepository.getById(id, opts);
  return opts.includePhoto ? toUserDTOWithPhoto(doc) : toUserDTO(doc);
}

async function getUserByEmail(email) {
  const doc = await UsersRepository.getByEmail(email);
  return toUserDTO(doc);
}

async function upsertUser(id, payload) {
  const parsed = userPayloadSchema.parse(payload || {});
  const data = {
    ...parsed,
    updatedAt: Date.now(),
  };
  const saved = await UsersRepository.upsert(id, data);
  return toUserDTO(saved);
}

// ── Staff profile (ID upload + admin verification) ────────────────────────

function validateIdInput({ govtIdType, govtIdNumber, govtIdPhoto }) {
  if (govtIdType === undefined && govtIdNumber === undefined && govtIdPhoto === undefined) {
    return;
  }
  if (govtIdType && !VALID_ID_TYPES.includes(govtIdType)) {
    throw Object.assign(
      new Error(`govtIdType must be one of: ${VALID_ID_TYPES.join(", ")}`),
      { status: 400, field: "govtIdType" }
    );
  }
  if (govtIdType && !govtIdNumber) {
    throw Object.assign(
      new Error("ID number is required when an ID type is selected."),
      { status: 400, field: "govtIdNumber" }
    );
  }
  if (govtIdNumber && !govtIdType) {
    throw Object.assign(
      new Error("Select an ID type before entering an ID number."),
      { status: 400, field: "govtIdType" }
    );
  }
}

async function updateStaffProfile(id, body) {
  validateIdInput(body || {});
  const saved = await UsersRepository.updateStaffProfile(id, body || {});
  return toUserDTO(saved);
}

async function verifyStaff(id, verifiedBy) {
  const user = await UsersRepository.getById(id);
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  if (!user.govtIdType || !user.govtIdNumber) {
    throw Object.assign(
      new Error("User has not submitted an ID yet — nothing to verify."),
      { status: 400 }
    );
  }
  if (user.govtIdVerifiedAt) return toUserDTO(user); // idempotent
  const saved = await UsersRepository.recordVerification(id, {
    verifiedBy, decision: "approve",
  });
  return toUserDTO(saved);
}

async function rejectStaff(id, verifiedBy, rejectionReason) {
  const user = await UsersRepository.getById(id);
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  if (!user.govtIdType || !user.govtIdNumber) {
    throw Object.assign(
      new Error("User has not submitted an ID yet — nothing to reject."),
      { status: 400 }
    );
  }
  const reason = String(rejectionReason || "").trim();
  if (!reason) {
    throw Object.assign(
      new Error("A rejection reason is required so the staff member knows what to fix."),
      { status: 400, field: "rejectionReason" }
    );
  }
  const saved = await UsersRepository.recordVerification(id, {
    verifiedBy, decision: "reject", rejectionReason: reason,
  });
  return toUserDTO(saved);
}

module.exports = {
  listUsers,
  listPendingVerification,
  getUser,
  getUserByEmail,
  upsertUser,
  updateStaffProfile,
  verifyStaff,
  rejectStaff,
};
