import React from 'react';
import { SiteBlock } from '../../../types/siteBuilder';
import PublicHeroBlock from '../../../pages/public/components/blocks/PublicHeroBlock';
import PublicFeaturesBlock from '../../../pages/public/components/blocks/PublicFeaturesBlock';
import PublicFunctionEmbedBlock from '../../../pages/public/components/blocks/PublicFunctionEmbedBlock';
import PublicPricingBlock from '../../../pages/public/components/blocks/PublicPricingBlock';
import PublicFaqBlock from '../../../pages/public/components/blocks/PublicFaqBlock';
import PublicTestimonialsBlock from '../../../pages/public/components/blocks/PublicTestimonialsBlock';
import PublicFooterBlock from '../../../pages/public/components/blocks/PublicFooterBlock';
import { useParams } from 'react-router-dom';

interface Props {
  block: SiteBlock;
}

export default function BlockPreviewRenderer({ block }: Props) {
  const { orgId } = useParams();
  
  // Отключаем клики внутри превью блоков, чтобы клик выбирал весь блок в редакторе
  return (
    <div className="pointer-events-none select-none">
      {block.type === 'HERO' && <PublicHeroBlock block={block} />}
      {block.type === 'FEATURES_GRID' && <PublicFeaturesBlock block={block} />}
      {block.type === 'FUNCTION_EMBED' && <PublicFunctionEmbedBlock block={block} tenantId={orgId || 'preview'} />}
      {block.type === 'PRICING_TABLE' && <PublicPricingBlock block={block} />}
      {block.type === 'FAQ_ACCORDION' && <PublicFaqBlock block={block} />}
      {block.type === 'TESTIMONIALS' && <PublicTestimonialsBlock block={block} />}
      {block.type === 'FOOTER' && <PublicFooterBlock block={block} />}
    </div>
  );
}
