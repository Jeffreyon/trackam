/**
 * Requires the authenticated user's org to have a specific marketplace capability.
 * Must run after localAuth so req.user is populated.
 *
 * Usage: router.get("/...", localAuth, requireCapability("carry"), handler)
 */
function requireCapability(capability) {
  return function (req, res, next) {
    const caps = req.user?.capabilities || [];
    if (!caps.includes(capability)) {
      return res.status(403).json({
        message: `This action requires the '${capability}' capability.`,
      });
    }
    next();
  };
}

module.exports = requireCapability;
