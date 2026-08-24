import React from 'react';
import { SiteBlock } from '../../../types/siteBuilder';

import PublicHeroBlock from './blocks/PublicHeroBlock';
import PublicFeaturesBlock from './blocks/PublicFeaturesBlock';
import PublicFunctionEmbedBlock from './blocks/PublicFunctionEmbedBlock';
import PublicPricingBlock from './blocks/PublicPricingBlock';
import PublicFaqBlock from './blocks/PublicFaqBlock';
import PublicTestimonialsBlock from './blocks/PublicTestimonialsBlock';
import PublicFooterBlock from './blocks/PublicFooterBlock';

interface Props {
  blocks: SiteBlock[];
  tenantId: string;
}

export default function PublicBlockDispatcher({ blocks, tenantId }: Props) {
  // Sort blocks by order just in case
  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);

  return (
    <>
      {sortedBlocks.map(block => {
        switch (block.type) {
          case 'HERO':
            return <PublicHeroBlock key={block.id} block={block} />;
          case 'FEATURES_GRID':
            return <PublicFeaturesBlock key={block.id} block={block} />;
          case 'FUNCTION_EMBED':
            return <PublicFunctionEmbedBlock key={block.id} block={block} tenantId={tenantId} />;
          case 'PRICING_TABLE':
            return <PublicPricingBlock key={block.id} block={block} />;
          case 'FAQ_ACCORDION':
            return <PublicFaqBlock key={block.id} block={block} />;
          case 'TESTIMONIALS':
            return <PublicTestimonialsBlock key={block.id} block={block} />;
          case 'FOOTER':
            return <PublicFooterBlock key={block.id} block={block} />;
          default:
            return <div key={block.id} style={{ display: 'none' }}>Unsupported block type: {block.type}</div>;
        }
      })}
    </>
  );
}
