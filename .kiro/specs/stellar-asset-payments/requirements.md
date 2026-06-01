# Requirements Document

## Introduction

This feature extends the ClipCash application to support Stellar asset payments beyond native XLM. Users will be able to pay for services (such as NFT minting) using custom Stellar assets like USDC or other tokens. The feature includes trustline management, asset balance viewing, and asset selection for payments.

Currently, the application supports MetaMask (Ethereum) and Phantom (Solana) wallet connections, with Stellar testnet configured for NFT minting. This feature adds comprehensive Stellar asset payment capabilities to complement the existing Stellar NFT functionality.

## Glossary

- **Stellar_Asset_Payment_System**: The system component that handles payments using Stellar assets beyond XLM
- **Trustline_Manager**: The component responsible for establishing and managing trustlines for Stellar assets
- **Asset_Balance_Viewer**: The UI component that displays user balances for various Stellar assets
- **Payment_Asset_Selector**: The UI component that allows users to choose which asset to use for payment
- **Stellar_Wallet**: A wallet that supports Stellar network operations (e.g., Freighter, Albedo)
- **Trustline**: A Stellar blockchain mechanism that allows an account to hold and transact with a specific asset
- **Custom_Asset**: Any Stellar asset other than native XLM (e.g., USDC, custom tokens)
- **Asset_Issuer**: The Stellar account that issues a custom asset
- **Asset_Code**: The identifier for a Stellar asset (e.g., "USDC", "MYTOKEN")
- **Horizon_API**: The Stellar REST API for querying blockchain data and submitting transactions
- **Stellar_SDK**: The JavaScript library for interacting with the Stellar network

## Requirements

### Requirement 1: Stellar Wallet Connection

**User Story:** As a user, I want to connect my Stellar wallet to the application, so that I can use Stellar assets for payments.

#### Acceptance Criteria

1. THE Stellar_Wallet SHALL support Freighter wallet browser extension
2. WHEN a user clicks the connect wallet button, THE Stellar_Wallet SHALL request connection permission from the Freighter extension
3. WHEN the user approves the connection, THE Stellar_Wallet SHALL retrieve and store the user's public key
4. WHEN the user denies the connection, THE Stellar_Wallet SHALL display an error message indicating connection was rejected
5. WHEN the wallet is connected, THE Stellar_Wallet SHALL persist the connection state across browser sessions
6. WHEN the user disconnects the wallet, THE Stellar_Wallet SHALL clear all stored wallet data and session state
7. THE Stellar_Wallet SHALL display the connected wallet address in truncated format (first 4 and last 4 characters)
8. WHEN the Freighter extension is not installed, THE Stellar_Wallet SHALL display a message with installation instructions

### Requirement 2: Asset Balance Display

**User Story:** As a user, I want to view my Stellar asset balances, so that I know which assets I can use for payments.

#### Acceptance Criteria

1. WHEN a Stellar wallet is connected, THE Asset_Balance_Viewer SHALL query the Horizon_API for all asset balances
2. THE Asset_Balance_Viewer SHALL display native XLM balance with up to 7 decimal places
3. THE Asset_Balance_Viewer SHALL display custom asset balances with asset code and issuer domain
4. WHEN an asset has a home domain configured, THE Asset_Balance_Viewer SHALL display the domain name instead of the full issuer address
5. WHEN the balance query fails, THE Asset_Balance_Viewer SHALL display an error message and provide a retry option
6. THE Asset_Balance_Viewer SHALL refresh balances every 30 seconds while the wallet is connected
7. WHEN an account has zero balances for all assets, THE Asset_Balance_Viewer SHALL display a message indicating no assets are available
8. THE Asset_Balance_Viewer SHALL sort assets with XLM first, followed by custom assets alphabetically by asset code

### Requirement 3: Trustline Establishment

**User Story:** As a user, I want to establish trustlines for Stellar assets, so that I can receive and use those assets for payments.

#### Acceptance Criteria

1. THE Trustline_Manager SHALL provide a UI to add trustlines by entering asset code and issuer address
2. WHEN a user submits a trustline request, THE Trustline_Manager SHALL validate that the asset code is between 1 and 12 alphanumeric characters
3. WHEN a user submits a trustline request, THE Trustline_Manager SHALL validate that the issuer address is a valid Stellar public key format
4. WHEN validation passes, THE Trustline_Manager SHALL construct a change trust operation with the specified asset
5. WHEN the trustline transaction is submitted, THE Trustline_Manager SHALL request signature from the connected Stellar_Wallet
6. WHEN the user approves the transaction, THE Trustline_Manager SHALL submit the signed transaction to the Stellar network via Horizon_API
7. WHEN the transaction succeeds, THE Trustline_Manager SHALL display a success message and refresh the asset balances
8. WHEN the transaction fails, THE Trustline_Manager SHALL display the error message from the Stellar network
9. THE Trustline_Manager SHALL prevent duplicate trustline creation for assets that already have an established trustline
10. THE Trustline_Manager SHALL provide a list of popular assets (USDC, AQUA, yXLM) with pre-filled issuer addresses for quick setup

### Requirement 4: Trustline Removal

**User Story:** As a user, I want to remove trustlines for assets I no longer use, so that I can clean up my account and reclaim base reserves.

#### Acceptance Criteria

1. WHEN an asset balance is zero, THE Trustline_Manager SHALL display a remove trustline option for that asset
2. WHEN an asset balance is greater than zero, THE Trustline_Manager SHALL disable the remove trustline option and display a message indicating the balance must be zero
3. WHEN a user confirms trustline removal, THE Trustline_Manager SHALL construct a change trust operation with limit set to zero
4. WHEN the remove trustline transaction is submitted, THE Trustline_Manager SHALL request signature from the connected Stellar_Wallet
5. WHEN the transaction succeeds, THE Trustline_Manager SHALL display a success message and refresh the asset balances
6. WHEN the transaction fails, THE Trustline_Manager SHALL display the error message from the Stellar network

### Requirement 5: Asset Selection for Payments

**User Story:** As a user, I want to select which Stellar asset to use for payment, so that I can pay with my preferred asset.

#### Acceptance Criteria

1. WHEN initiating a payment transaction, THE Payment_Asset_Selector SHALL display all assets with sufficient balance to cover the payment amount
2. THE Payment_Asset_Selector SHALL calculate and display the equivalent payment amount in each available asset based on current exchange rates
3. WHEN no exchange rate is available for an asset, THE Payment_Asset_Selector SHALL display the asset but indicate that pricing is unavailable
4. THE Payment_Asset_Selector SHALL default to XLM as the selected payment asset
5. WHEN a user selects a different asset, THE Payment_Asset_Selector SHALL update the payment amount display to reflect the selected asset
6. THE Payment_Asset_Selector SHALL display asset codes with their issuer domain for easy identification
7. WHEN only XLM is available, THE Payment_Asset_Selector SHALL automatically use XLM without showing a selection UI

### Requirement 6: Asset Payment Execution

**User Story:** As a user, I want to complete payments using my selected Stellar asset, so that I can pay for services with the asset of my choice.

#### Acceptance Criteria

1. WHEN a user confirms a payment, THE Stellar_Asset_Payment_System SHALL construct a payment operation with the selected asset, amount, and destination address
2. WHEN the payment is for XLM, THE Stellar_Asset_Payment_System SHALL use a native payment operation
3. WHEN the payment is for a custom asset, THE Stellar_Asset_Payment_System SHALL use an asset payment operation with the asset code and issuer
4. THE Stellar_Asset_Payment_System SHALL include a memo field in the transaction for payment reference tracking
5. WHEN the transaction is constructed, THE Stellar_Asset_Payment_System SHALL request signature from the connected Stellar_Wallet
6. WHEN the user approves the transaction, THE Stellar_Asset_Payment_System SHALL submit the signed transaction to the Stellar network via Horizon_API
7. WHEN the transaction succeeds, THE Stellar_Asset_Payment_System SHALL return the transaction hash and display a success message
8. WHEN the transaction fails due to insufficient balance, THE Stellar_Asset_Payment_System SHALL display an error message indicating insufficient funds
9. WHEN the transaction fails for other reasons, THE Stellar_Asset_Payment_System SHALL display the error message from the Stellar network
10. THE Stellar_Asset_Payment_System SHALL verify transaction confirmation by querying the transaction status from Horizon_API before marking payment as complete

### Requirement 7: Exchange Rate Integration

**User Story:** As a user, I want to see accurate exchange rates for Stellar assets, so that I understand the cost of payments in different assets.

#### Acceptance Criteria

1. THE Stellar_Asset_Payment_System SHALL query exchange rates from the Stellar DEX via Horizon_API path payments endpoint
2. THE Stellar_Asset_Payment_System SHALL cache exchange rates for 60 seconds to minimize API calls
3. WHEN an exchange rate query fails, THE Stellar_Asset_Payment_System SHALL fall back to displaying amounts without conversion
4. THE Stellar_Asset_Payment_System SHALL calculate exchange rates relative to XLM as the base currency
5. WHEN displaying converted amounts, THE Stellar_Asset_Payment_System SHALL show up to 7 decimal places for precision
6. THE Stellar_Asset_Payment_System SHALL refresh exchange rates when the user manually triggers a refresh action

### Requirement 8: Transaction History

**User Story:** As a user, I want to view my Stellar asset payment history, so that I can track my spending and verify completed transactions.

#### Acceptance Criteria

1. THE Stellar_Asset_Payment_System SHALL query the user's payment history from Horizon_API when the wallet is connected
2. THE Stellar_Asset_Payment_System SHALL display the 20 most recent payment transactions
3. THE Stellar_Asset_Payment_System SHALL show transaction date, asset type, amount, destination address, and transaction status for each payment
4. WHEN a transaction has a memo, THE Stellar_Asset_Payment_System SHALL display the memo text
5. THE Stellar_Asset_Payment_System SHALL provide a link to view the full transaction details on a Stellar blockchain explorer
6. THE Stellar_Asset_Payment_System SHALL filter the history to show only outgoing payments from the connected wallet
7. WHEN the history query fails, THE Stellar_Asset_Payment_System SHALL display an error message and provide a retry option
8. THE Stellar_Asset_Payment_System SHALL support pagination to load older transactions beyond the initial 20

### Requirement 9: Error Handling and User Feedback

**User Story:** As a user, I want clear error messages and feedback during Stellar asset operations, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN a Stellar network request times out, THE Stellar_Asset_Payment_System SHALL display an error message indicating network connectivity issues
2. WHEN the user's account does not meet minimum balance requirements, THE Stellar_Asset_Payment_System SHALL display an error message explaining the minimum balance requirement
3. WHEN a transaction fails due to insufficient XLM for fees, THE Stellar_Asset_Payment_System SHALL display an error message indicating the user needs more XLM for transaction fees
4. WHEN the Horizon_API returns an error, THE Stellar_Asset_Payment_System SHALL parse and display the error message in user-friendly language
5. THE Stellar_Asset_Payment_System SHALL display loading indicators during all asynchronous operations
6. WHEN an operation succeeds, THE Stellar_Asset_Payment_System SHALL display a success message for 3 seconds before auto-dismissing
7. WHEN an operation fails, THE Stellar_Asset_Payment_System SHALL keep the error message visible until the user dismisses it
8. THE Stellar_Asset_Payment_System SHALL log all errors to the browser console with full error details for debugging

### Requirement 10: Security and Validation

**User Story:** As a user, I want my Stellar asset transactions to be secure and validated, so that I can trust the payment system.

#### Acceptance Criteria

1. THE Stellar_Asset_Payment_System SHALL validate all user inputs before constructing transactions
2. THE Stellar_Asset_Payment_System SHALL sanitize asset codes and issuer addresses to prevent injection attacks
3. THE Stellar_Asset_Payment_System SHALL verify that destination addresses are valid Stellar public keys before submitting payments
4. THE Stellar_Asset_Payment_System SHALL never store or transmit private keys
5. THE Stellar_Asset_Payment_System SHALL require user signature approval for every transaction via the connected wallet
6. THE Stellar_Asset_Payment_System SHALL validate transaction amounts are positive numbers with no more than 7 decimal places
7. WHEN a transaction is constructed, THE Stellar_Asset_Payment_System SHALL display a confirmation dialog showing all transaction details before requesting signature
8. THE Stellar_Asset_Payment_System SHALL implement rate limiting to prevent transaction spam (maximum 10 transactions per minute)
9. THE Stellar_Asset_Payment_System SHALL verify the Stellar network passphrase matches the configured network (testnet or mainnet) before submitting transactions
10. THE Stellar_Asset_Payment_System SHALL redact wallet addresses in analytics events according to existing PII protection patterns
