const UsersRepository = require("../../app/users/users.repository");
const RolesRepository = require("../../app/roles/roles.repository");
const { warn } = require("../logger");

async function attachAuthz(req, res, next) {
  try {
    if (req.authz) return next();

    const uid = req.user && req.user.uid;
    if (!uid) {
      return res.status(401).json({ message: "Unauthenticated" });
    }

    const userDoc = await UsersRepository.getById(uid);
    const roleIds = Array.isArray(userDoc?.roles) ? userDoc.roles : [];

    const rolePromises = roleIds.map((roleId) => RolesRepository.getById(roleId));
    const roleDocs = await Promise.all(rolePromises);

    const roles = roleDocs.filter(Boolean);

    const permissionsSet = new Set();
    roles.forEach((role) => {
      if (Array.isArray(role.permissions)) {
        role.permissions.forEach((permission) => permissionsSet.add(permission));
      }
    });

    const permissions = Array.from(permissionsSet);
    const isAdmin = roleIds.includes("admin") || permissions.includes("*");

    if (!userDoc) {
      warn("authz_user_missing", { uid });
    }

    req.authz = {
      uid,
      user: userDoc,
      roles,
      permissions,
      isAdmin,
    };

    return next();
  } catch (err) {
    return next(err);
  }
}

function requireAdmin(req, res, next) {
  const authz = req.authz;

  if (!authz) {
    return res.status(500).json({ message: "Authorization context missing" });
  }

  if (!authz.isAdmin) {
    return res.status(403).json({ message: "Admin privileges required" });
  }

  return next();
}

function requireSelfOrAdmin(paramName = "id") {
  return function selfOrAdminMiddleware(req, res, next) {
    const authz = req.authz;

    if (!authz) {
      return res
        .status(500)
        .json({ message: "Authorization context missing" });
    }

    if (authz.isAdmin) {
      return next();
    }

    const targetId = req.params[paramName];

    if (targetId && targetId === authz.uid) {
      return next();
    }

    return res.status(403).json({ message: "Forbidden" });
  };
}

function requireSuperAdmin(req, res, next) {
  const authz = req.authz;

  if (!authz) {
    return res.status(500).json({ message: "Authorization context missing" });
  }

  const roleIds = Array.isArray(authz.user?.roles) ? authz.user.roles : [];
  const isSuperAdmin = roleIds.includes("super_admin") || authz.isAdmin;

  if (!isSuperAdmin) {
    return res.status(403).json({ message: "Super admin privileges required" });
  }

  return next();
}

module.exports = {
  attachAuthz,
  requireAdmin,
  requireSelfOrAdmin,
  requireSuperAdmin,
};
