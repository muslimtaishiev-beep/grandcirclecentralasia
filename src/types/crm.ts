export type CrmSource = 'whatsapp' | 'instagram' | 'web_form' | 'manual';

export interface CrmDealItem {
  id: string;
  tenantId: string;
  title: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  value: number;
  column: 'new' | 'contacted' | 'testing' | 'won';
  assignedTo?: string; // Responsible User ID
  assignedName?: string; // Responsible User Display Name
  source?: CrmSource;
  createdAt?: any;
  updatedAt?: any;
}

export interface CrmIntegrationConfig {
  whatsappConnected: boolean;
  whatsappPhone?: string;
  instagramConnected: boolean;
  instagramHandle?: string;
  webhookUrl?: string;
}
