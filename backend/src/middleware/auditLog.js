const db = require('../config/database');

/**
 * Log an admin action to the audit log
 * @param {Object} req - Express request object (for user, IP, user-agent)
 * @param {string} action - Action performed (e.g., 'approve_application', 'delete_user')
 * @param {string} entityType - Type of entity (e.g., 'application', 'user', 'chat')
 * @param {string} entityId - UUID of the entity
 * @param {Object} oldValues - Previous state (null for creates)
 * @param {Object} newValues - New state (null for deletes)
 */
const logAdminAction = async (req, action, entityType, entityId, oldValues = null, newValues = null) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) {
      console.warn('Audit log: No user ID available');
      return;
    }

    const ipAddress = req.ip ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.connection?.remoteAddress ||
      'unknown';

    const userAgent = req.headers['user-agent'] || null;

    await db.query(
      `INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        adminId,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    // Don't throw - audit logging should not break the main operation
    console.error('Failed to log admin action:', error.message);
  }
};

/**
 * Middleware that automatically logs admin actions
 * Use for routes where you want automatic logging based on response
 */
const auditMiddleware = (action, entityType, getEntityId) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function(data) {
      // Only log successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId = typeof getEntityId === 'function'
          ? getEntityId(req, data)
          : req.params.id;

        logAdminAction(req, action, entityType, entityId, req.auditOldValues, data)
          .catch(err => console.error('Audit middleware error:', err));
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Helper to capture old values before an update/delete
 */
const captureOldValues = (oldValues) => {
  return (req, res, next) => {
    req.auditOldValues = oldValues;
    next();
  };
};

module.exports = {
  logAdminAction,
  auditMiddleware,
  captureOldValues
};
