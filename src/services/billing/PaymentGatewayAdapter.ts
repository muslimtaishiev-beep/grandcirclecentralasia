import { SubscriptionTierId } from '../../types/billing';

export interface CheckoutRequest {
  tenantId: string;
  tierId: SubscriptionTierId;
  interval: 'month' | 'year';
  gateway: 'stripe' | 'mbank' | 'kaspi' | 'manual_invoice';
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResponse {
  redirectUrl?: string;
  qrCodeUrl?: string;
  clientSecret?: string;
  error?: string;
}

class PaymentGatewayAdapter {
  async initiateSubscriptionCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
    // Simulated unified gateway logic
    
    if (req.gateway === 'stripe') {
      // Typically calls a Cloud Function to create a Stripe Checkout Session
      console.log('Initiating Stripe Checkout for', req.tierId);
      return {
        redirectUrl: `${req.successUrl}?session_id=cs_test_mock123`
      };
    }

    if (req.gateway === 'mbank') {
      // Generates dynamic QR code for Kyrgyzstan MBank standard
      console.log('Generating MBank QR code for', req.tierId);
      return {
        qrCodeUrl: 'https://mbank.kg/mock-qr-code/12345'
      };
    }

    if (req.gateway === 'kaspi') {
      // Generates deep link / invoice for Kaspi Pay
      console.log('Generating Kaspi Pay invoice for', req.tierId);
      return {
        redirectUrl: 'https://kaspi.kz/pay/mock_invoice_123'
      };
    }

    return { error: 'Unsupported gateway' };
  }

  async handleWebhookEvent(eventPayload: any, signature: string, gateway: string): Promise<void> {
    // In a real app, this runs on the backend (Node.js/Cloud Functions).
    // The webhook validates the signature, extracts the tenantId, and updates Firestore.
    // payment_success -> extend currentPeriodEnd, mark invoice as paid, update status to active.
    console.log(`Received webhook from ${gateway}:`, eventPayload);
  }
}

export const paymentGatewayAdapter = new PaymentGatewayAdapter();
