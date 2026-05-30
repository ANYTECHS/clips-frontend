# Wallet Migration Guide (Part 1 → Part 2)

## Overview
This guide explains how users who have previously connected a **wallet** (Part 1) can migrate to the new **auto‑generated wallet** system introduced in Part 2 of the Clips Frontend application.

## Why Migrate?
- **Improved security** – the auto‑generated wallet never stores private keys in the browser.
- **Seamless onboarding** – users no longer need to manually install extensions such as Freighter.
- **Cross‑chain compatibility** – the new system supports Stellar, Ethereum and Solana out‑of‑the‑box.

## Prerequisites
1. Ensure you are on the latest version of the application (`git pull` on `main`).
2. Have an active internet connection.
3. Back up any important data (e.g., NFT identifiers) linked to your current wallet.

## Migration Steps
1. **Open the Migration Page**
   - Navigate to `https://<your‑app>/wallet/migrate` (or click **Migrate Wallet** in the user profile menu).
2. **Authenticate**
   - If you are still connected with a legacy wallet, you will be prompted to sign a one‑time message using that wallet. This authorises the migration.
3. **Generate the Auto‑Generated Wallet**
   - The backend will create a new wallet, store the encrypted private key on our server, and return a **wallet ID**.
4. **Link Existing Assets**
   - The system automatically scans the blockchain for assets associated with your old address and links them to the new wallet. Verify the asset list on the **Assets** tab.
5. **Confirm Migration**
   - Press **Confirm Migration**. Your session will now be switched to the auto‑generated wallet.
6. **Logout & Re‑login** (optional)
   - For a clean state, log out and log back in. Your UI will now display the auto‑generated wallet address.

## Post‑Migration Verification
- Open the **Wallet Dashboard** and ensure your address matches the newly generated one (displayed in truncated format).
- Verify that all previously owned NFTs and tokens appear under **My Assets**.
- Test a simple transaction (e.g., a tip) to confirm signing works.

## FAQ
- **What happens to my old private key?**
  - It remains in your browser extension but is no longer used by the app. You may revoke the extension’s permissions if desired.
- **Can I revert to the old wallet?**
  - Yes, use the **Switch Wallet** option in the profile menu and select **Legacy Wallet**.
- **Is there any fee?**
  - No on‑chain fees are incurred during migration; only a minimal network request fee for asset lookup.

---
*This document is version‑controlled. Update it as the wallet system evolves.*
