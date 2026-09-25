Payment error handling
Repo Avatar
Dfunder/stellarAid-api
Description:
Graceful handling of payment failures.

Tasks:
 Map Stellar SDK errors to user-friendly messages
 Handle: insufficient funds, network timeout, contract errors
 Return structured error responses with error codes
 Log detailed errors for debugging
Acceptance Criteria:
All Stellar errors mapped to readable messages
No raw SDK errors exposed to frontend
Error logs include full context for debugging
Order and payment unit tests
Repo Avatar
Dfunder/stellarAid-api
Description:
Test order and payment service logic.

Tasks:
 Test order creation and validation
 Test fee calculation
 Test status transitions
 Test withdrawal validation
Acceptance Criteria:
All order flows tested
Edge cases (duplicate orders, self-purchase) covered
Fee calculations verified