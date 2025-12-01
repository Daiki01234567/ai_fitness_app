# collectors.ts Coverage Report

## Achievement
collectors.ts now has **100% coverage** across all metrics:
- Statements: 100%
- Branches: 100%
- Functions: 100%
- Lines: 100%

## Tests Added

### 1. collectProfileData Error Handling (2 tests)
- Line 51: Returns null when user does not exist
- Lines 67-68: Throws error and logs when Firestore read fails

### 2. collectSessionsData Error Handling (2 tests)
- Lines 118-119: Processes session documents in loop
- Lines 134-135: Throws error and logs when Firestore query fails

### 3. collectSettingsData Error Handling (2 tests)
- Line 162: Returns null when settings document does not exist
- Lines 177-178: Throws error and logs when Firestore read fails

### 4. collectSubscriptionsData Error Handling (2 tests)
- Lines 211-212: Processes subscription documents in loop
- Lines 223-224: Throws error and logs when Firestore query fails

### 5. collectConsentsData Error Handling (2 tests)
- Lines 257-258: Processes consent documents in loop
- Lines 268-269: Throws error and logs when Firestore query fails

## Total Test Cases
- Original: 6 tests
- Added: 10 tests
- **Total: 16 tests**

## GDPR Compliance
All tests follow GDPR requirements as specified in:
- docs/specs/06_データ処理記録_ROPA_v1_0.md

## Test Coverage Summary
Previously uncovered lines:
- 51, 67-68, 118-119, 134-135, 162, 177-178, 211-212, 223-224, 257-258, 268-269

All previously uncovered lines are now tested with:
- Null/empty data scenarios
- Error handling paths
- Document processing loops
- Logger verification

## Files Modified
- `functions/tests/services/gdpr/collectors.test.ts` (expanded from 119 to 324 lines)

## Verification
Run: `npm test -- --testPathPattern="collectors" --coverage`
