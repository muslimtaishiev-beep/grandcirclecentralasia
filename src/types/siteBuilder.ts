import { z } from 'zod';

// ============================================================================
// 1. STYLE SCHEMAS
// ============================================================================

export const TypographySchema = z.object({
  fontFamily: z.string().default('Inter'),
  fontSize: z.string().default('16px'),
  fontWeight: z.number().min(100).max(900).default(400),
  lineHeight: z.number().default(1.5),
  color: z.string().default('#111827'),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).default('left'),
});

export const SpacingSchema = z.object({
  desktop: z.object({
    padding: z.tuple([z.number(), z.number(), z.number(), z.number()]).default([0, 0, 0, 0]),
    margin: z.tuple([z.number(), z.number(), z.number(), z.number()]).default([0, 0, 0, 0]),
  }),
  tablet: z.object({
    padding: z.tuple([z.number(), z.number(), z.number(), z.number()]).default([0, 0, 0, 0]),
    margin: z.tuple([z.number(), z.number(), z.number(), z.number()]).default([0, 0, 0, 0]),
  }),
  mobile: z.object({
    padding: z.tuple([z.number(), z.number(), z.number(), z.number()]).default([0, 0, 0, 0]),
    margin: z.tuple([z.number(), z.number(), z.number(), z.number()]).default([0, 0, 0, 0]),
  }),
});

export const BackgroundSchema = z.object({
  type: z.enum(['solid', 'linear-gradient', 'radial-gradient', 'image']).default('solid'),
  color: z.string().default('#ffffff'),
  gradient: z.string().optional(),
  imageUrl: z.string().url().optional(),
  imageSize: z.enum(['cover', 'contain']).optional(),
  imagePosition: z.string().optional(),
  overlayOpacity: z.number().min(0).max(1).optional(),
});

export const BorderAndShadowSchema = z.object({
  borderRadius: z.number().default(0),
  borderWidth: z.number().default(0),
  borderStyle: z.enum(['solid', 'dashed', 'dotted', 'none']).default('none'),
  borderColor: z.string().default('transparent'),
  shadow: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    blur: z.number().default(0),
    spread: z.number().default(0),
    color: z.string().default('rgba(0,0,0,0)'),
  }).optional(),
});

// ============================================================================
// 2. BLOCK CONFIG SCHEMAS
// ============================================================================

const BaseCtaSchema = z.object({
  text: z.string(),
  link: z.string(),
  style: z.enum(['primary', 'secondary', 'outline', 'text']).default('primary'),
});

const HeroConfigSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  badge: z.string().optional(),
  primaryCta: BaseCtaSchema.optional(),
  secondaryCta: BaseCtaSchema.optional(),
  backgroundMedia: z.string().optional(), // URL to video or image
});

const FeatureItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  icon: z.string().default('CheckCircle'), // Lucide icon name
  link: z.string().optional(),
});

const FeaturesGridConfigSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  columns: z.number().min(1).max(4).default(3),
  items: z.array(FeatureItemSchema),
});

const FunctionEmbedConfigSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  embeddedFunctionId: z.string(), // Links to CustomBusinessFunction.id
  widgetTheme: z.enum(['card', 'inline', 'full-bleed']).default('card'),
  hideSystemHeaders: z.boolean().default(false),
});

const PricingTierSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  price: z.string(),
  period: z.string().optional(), // e.g. "/мес"
  isPopular: z.boolean().default(false),
  features: z.array(z.object({
    name: z.string(),
    isIncluded: z.boolean().default(true),
  })),
  cta: BaseCtaSchema,
});

const PricingTableConfigSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  tiers: z.array(PricingTierSchema),
});

const TestimonialItemSchema = z.object({
  id: z.string().uuid(),
  authorName: z.string(),
  authorRole: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  text: z.string(),
  rating: z.number().min(1).max(5),
  isVerified: z.boolean().default(false),
});

const TestimonialsConfigSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  items: z.array(TestimonialItemSchema),
});

const FaqItemSchema = z.object({
  id: z.string().uuid(),
  question: z.string(),
  answer: z.string(),
});

const FaqAccordionConfigSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  allowMultipleExpanded: z.boolean().default(false),
  items: z.array(FaqItemSchema),
});

const FooterConfigSchema = z.object({
  logoUrl: z.string().optional(),
  copyrightText: z.string(),
  socialLinks: z.array(z.object({
    platform: z.string(),
    url: z.string().url(),
  })).optional(),
  navColumns: z.array(z.object({
    id: z.string().uuid(),
    title: z.string(),
    links: z.array(z.object({
      label: z.string(),
      url: z.string(),
    })),
  })).optional(),
});

// ============================================================================
// 3. PAGE & BLOCK SCHEMAS
// ============================================================================

export const BlockTypeEnum = z.enum([
  'HERO', 
  'FEATURES_GRID', 
  'FUNCTION_EMBED', 
  'PRICING_TABLE', 
  'TESTIMONIALS', 
  'FAQ_ACCORDION', 
  'FOOTER'
]);

export const SiteBlockSchema = z.object({
  id: z.string().uuid(),
  type: BlockTypeEnum,
  order: z.number().min(0),
  
  // Design properties
  background: BackgroundSchema.optional(),
  spacing: SpacingSchema.optional(),
  borderAndShadow: BorderAndShadowSchema.optional(),
  typographyOverrides: TypographySchema.optional(),

  // Content specific config
  config: z.discriminatedUnion('type', [
    z.object({ type: z.literal('HERO'), data: HeroConfigSchema }),
    z.object({ type: z.literal('FEATURES_GRID'), data: FeaturesGridConfigSchema }),
    z.object({ type: z.literal('FUNCTION_EMBED'), data: FunctionEmbedConfigSchema }),
    z.object({ type: z.literal('PRICING_TABLE'), data: PricingTableConfigSchema }),
    z.object({ type: z.literal('TESTIMONIALS'), data: TestimonialsConfigSchema }),
    z.object({ type: z.literal('FAQ_ACCORDION'), data: FaqAccordionConfigSchema }),
    z.object({ type: z.literal('FOOTER'), data: FooterConfigSchema }),
  ]),
});

export const TenantLandingPageSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  slug: z.string(),
  version: z.number().min(1),
  status: z.enum(['draft', 'published']),
  seo: z.object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    ogImageUrl: z.string().url().optional(),
  }),
  theme: z.object({
    fontFamily: z.string().default('Inter'),
    primaryColor: z.string().default('#10b981'),
    accentColor: z.string().default('#34d399'),
  }),
  blocks: z.array(SiteBlockSchema),
  updatedAt: z.number(),
});

// ============================================================================
// 4. TYPESCRIPT EXPORTS
// ============================================================================

export type TypographyConfig = z.infer<typeof TypographySchema>;
export type SpacingConfig = z.infer<typeof SpacingSchema>;
export type BackgroundConfig = z.infer<typeof BackgroundSchema>;
export type BorderAndShadowConfig = z.infer<typeof BorderAndShadowSchema>;

export type BlockType = z.infer<typeof BlockTypeEnum>;
export type SiteBlock = z.infer<typeof SiteBlockSchema>;
export type TenantLandingPage = z.infer<typeof TenantLandingPageSchema>;

// ============================================================================
// 5. HISTORY ENGINE ACTION TYPES
// ============================================================================

export type HistoryAction = 
  | { type: 'ADD_BLOCK'; payload: { block: SiteBlock; index?: number } }
  | { type: 'REMOVE_BLOCK'; payload: { blockId: string } }
  | { type: 'MOVE_BLOCK'; payload: { sourceIndex: number; destinationIndex: number } }
  | { type: 'UPDATE_BLOCK_CONFIG'; payload: { blockId: string; updates: Partial<SiteBlock['config']['data']> } }
  | { type: 'UPDATE_BLOCK_PROPS'; payload: { blockId: string; updates: Partial<Omit<SiteBlock, 'id' | 'type' | 'order' | 'config'>> } }
  | { type: 'UPDATE_PAGE_META'; payload: { updates: Partial<Omit<TenantLandingPage, 'blocks' | 'id' | 'tenantId' | 'version'>> } }
  | { type: 'SET_SELECTED_BLOCK'; payload: { blockId: string | null } }
  | { type: 'SET_SELECTED_DEVICE'; payload: { device: 'desktop' | 'tablet' | 'mobile' } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET_STATE'; payload: { page: TenantLandingPage } }
  | { type: 'SYNC_SUCCESS'; payload: { newVersion: number; newHash: string } }
  | { type: 'SYNC_ERROR'; payload: { error: Error } };
