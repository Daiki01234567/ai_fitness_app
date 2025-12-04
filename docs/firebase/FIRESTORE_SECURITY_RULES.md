# Firestore Security Rules Documentation

**Version**: 1.0.0
**Date**: 2025-11-24
**Status**: Implemented

## Overview

This document describes the Firestore security rules implementation for the AI Fitness App. The rules ensure GDPR compliance, field-level access control, and protection of sensitive user data.

## Key Features

### 1. Field-Level Access Control

Critical fields are read-only and can only be modified by Cloud Functions:
- `tosAccepted` - Terms of Service acceptance status
- `ppAccepted` - Privacy Policy acceptance status
- `deletionScheduled` - Account deletion flag
- `forceLogout` - Force logout flag
- `createdAt` - Creation timestamp
- `email` - User email address
- `userId` - User identifier

### 2. GDPR Compliance

#### Data Subject Rights
- **Access Right**: Users can read their own data
- **Deletion Right**: 30-day grace period for data deletion
- **Data Portability**: Users can export their data during deletion grace period
- **Consent Management**: Immutable audit log of consent changes

#### Deletion Grace Period
When a user requests deletion:
1. `deletionScheduled` flag is set to `true`
2. User can still read data (for export) but cannot write
3. After 30 days, Cloud Functions permanently delete the data

### 3. Custom Claims

The rules support two custom claims for advanced access control:

#### Admin Claim (`admin: true`)
Grants access to administrative collections:
- `bigquerySyncFailures` - BigQuery sync error tracking
- `securityIncidents` - Security incident management

#### Force Logout Claim (`forceLogout: true`)
When set, immediately revokes all access for the user. Used when:
- User withdraws consent
- Security incident detected
- Account compromise suspected

### 4. Data Validation

All write operations include comprehensive validation:

#### User Profile Validation
- Height: 100-250 cm
- Weight: 30-300 kg
- Gender: `male`, `female`, `other`, `prefer_not_to_say`, or `null`
- Email: Valid email format

#### Session Data Validation
- Exercise types: `squat`, `armcurl`, `sideraise`, `shoulderpress`, `pushup`
- Status: `active`, `completed`, `cancelled`
- Pose data: Maximum 10,000 frames
- Required fields validation

## Collections Structure

### Root Collections

#### `/users/{userId}`
- **Read**: Owner only, not scheduled for deletion, not forced logout
- **Create**: Owner only with valid initial data and consent
- **Update**: Owner only, field-level restrictions apply
- **Delete**: Prohibited (Cloud Functions only)

#### `/consents/{consentId}`
- **Read**: Owner only (based on `userId` field)
- **Create**: Prohibited (Cloud Functions only)
- **Update**: Prohibited (immutable data)
- **Delete**: Prohibited (immutable data)

#### `/notifications/{notificationId}`
- **Read**: Owner only
- **Create**: Prohibited (Cloud Functions only)
- **Update**: Owner only (for marking as read)
- **Delete**: Owner only

#### `/dataDeletionRequests/{requestId}`
- **Read**: Owner only
- **Create**: Owner only with validation
- **Update**: Prohibited (Cloud Functions only)
- **Delete**: Prohibited

#### `/bigquerySyncFailures/{failureId}`
- **Read/Write**: Admin only

#### `/securityIncidents/{incidentId}`
- **Read/Write**: Admin only

### Subcollections

#### `/users/{userId}/sessions/{sessionId}`
- **Read**: Owner only
- **Create**: Owner only with validation
- **Update**: Limited updates with validation
- **Delete**: Prohibited

#### `/users/{userId}/sessions/{sessionId}/frames/{frameId}`
- **Read**: Owner only
- **Create**: Owner only with 33-point landmark validation
- **Update**: Prohibited (immutable data)
- **Delete**: Prohibited (immutable data)

#### `/users/{userId}/settings/{settingId}`
- **Read/Write**: Owner only

#### `/users/{userId}/subscriptions/{subscriptionId}`
- **Read**: Owner only
- **Write**: Prohibited (RevenueCat integration only)

## Security Patterns

### Zero Trust Architecture
- Default deny all access
- Explicit permission required for each operation
- Multiple validation layers

### Defense in Depth
1. **Authentication Layer**: Firebase Authentication
2. **Authorization Layer**: Firestore Security Rules
3. **Validation Layer**: Data type and range checks
4. **Audit Layer**: Immutable consent logs

### Principle of Least Privilege
- Users can only access their own data
- Admin access limited to specific collections
- Cloud Functions have elevated privileges for system operations

## Testing

### Test Coverage
The security rules are tested with comprehensive test suites covering:
- Authentication scenarios
- Authorization boundaries
- Data validation
- Custom claims
- Edge cases and error conditions

### Running Tests

```bash
cd tests
npm install
npm test
```

### Test Files
- `tests/firestore.rules.test.ts` - Main test suite
- `tests/package.json` - Test dependencies

## Deployment

### Local Development
```bash
firebase emulators:start --only firestore
```

### Production Deployment
```bash
firebase deploy --only firestore:rules
```

### Validation
```bash
firebase firestore:rules:validate
```

## Monitoring

### Security Events to Monitor
1. Failed authentication attempts
2. Authorization violations
3. Data validation failures
4. Admin access usage
5. Force logout activations

### Recommended Alerts
- Multiple failed access attempts from same user
- Unexpected admin access patterns
- Bulk deletion requests
- Validation failure spikes

## Best Practices

### For Developers
1. Never bypass security rules in production
2. Test all rule changes in emulator first
3. Keep validation functions simple and efficient
4. Document any rule exceptions

### For Operations
1. Regular security rule audits (monthly)
2. Monitor rule evaluation performance
3. Keep Cloud Functions updated for system operations
4. Maintain audit logs for compliance

## Compliance Notes

### GDPR Requirements Met
- ✅ Data minimization through field restrictions
- ✅ Purpose limitation via validation
- ✅ Storage limitation with deletion support
- ✅ Integrity and confidentiality through access control
- ✅ Accountability via audit logs

### Security Standards
- Follows OWASP security principles
- Implements defense in depth
- Zero trust architecture
- Principle of least privilege

## Troubleshooting

### Common Issues

#### "Permission Denied" Errors
1. Check authentication status
2. Verify user owns the resource
3. Check for deletion scheduled flag
4. Verify no force logout claim

#### Validation Failures
1. Ensure all required fields present
2. Check data types match expectations
3. Verify ranges for numeric values
4. Confirm enum values are valid

#### Test Failures
1. Ensure emulator is running
2. Check test data matches validation rules
3. Verify custom claims are set correctly
4. Review recent rule changes

## References

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [GDPR Compliance Guidelines](https://gdpr-info.eu/)
- [OWASP Security Principles](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)
- Project Documentation:
  - `docs/specs/02_Firestoreデータベース設計書_v3_3.md`
  - `docs/specs/07_セキュリティポリシー_v1_0.md`
  - `CLAUDE.md`

## Change Log

### Version 1.0.0 (2025-11-24)
- Initial implementation
- Full GDPR compliance
- Field-level access control
- Custom claims support
- Comprehensive validation
- Test suite creation