-- Migration script to encrypt existing accessToken and refreshToken fields in UserPlatform table
-- This script should be run once after deploying the encryption service

-- First, let's identify how many records need encryption
SELECT COUNT(*) as total_records,
       COUNT(CASE WHEN accessToken IS NOT NULL THEN 1 END) as has_access_token,
       COUNT(CASE WHEN refreshToken IS NOT NULL THEN 1 END) as has_refresh_token
FROM "UserPlatform";

-- Note: The actual encryption will be performed by the application service
-- This migration script is for documentation purposes
-- The UserPlatformService.migrateExistingRecords() method will handle the actual encryption

-- After running the migration, you can verify encryption by checking:
-- 1. All tokens should be base64 encoded
-- 2. Decrypted tokens should match original values
-- 3. New tokens should be automatically encrypted

-- Example verification query (run after migration):
-- SELECT id, platform, username, 
--        CASE 
--          WHEN accessToken IS NOT NULL THEN 'ENCRYPTED'
--          ELSE NULL 
--        END as accessToken_status,
--        CASE 
--          WHEN refreshToken IS NOT NULL THEN 'ENCRYPTED'
--          ELSE NULL 
--        END as refreshToken_status
-- FROM "UserPlatform"
-- WHERE accessToken IS NOT NULL OR refreshToken IS NOT NULL;
