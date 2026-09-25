 Multi-asset support validation
Repo Avatar
Dfunder/stellarAid-api
Description:
Validate Stellar asset payments.

Tasks:
 Validate asset is in supported list (XLM, USDC, NGNT, EURC)
 Validate trustline exists for the asset
 Validate correct decimal precision per asset (7 for XLM, 7 for USDC, etc.)
 Return clear error for unsupported assets
Acceptance Criteria:
Only supported assets accepted
Trustline validation prevents failed payments
Precision errors caught early

