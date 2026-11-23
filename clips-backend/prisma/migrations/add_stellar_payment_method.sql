-- Add paymentMethod field to Subscription model for Stellar payments
ALTER TABLE "Subscription" 
ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'stripe';

-- Create index for paymentMethod for efficient queries
CREATE INDEX "Subscription_paymentMethod_idx" ON "Subscription"("paymentMethod");
