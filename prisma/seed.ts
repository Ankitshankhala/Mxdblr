import { PrismaClient } from '@prisma/client'
import productsData from '../data/products.json'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding MXD products...')

  // Upsert each product so re-running seed is safe
  for (const p of productsData.products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        slug: p.slug,
        category: p.category,
        description: p.description,
        discountPct: p.discount_pct,
        images: p.images,
        sourceUrl: p.source_url,
      },
      create: {
        sku: p.sku,
        name: p.name,
        slug: p.slug,
        category: p.category,
        description: p.description,
        discountPct: p.discount_pct,
        images: p.images,
        sourceUrl: p.source_url,
        isActive: true,
      },
    })
    console.log(`  ✓ ${p.sku} — ${p.name}`)
  }

  console.log(`\nSeeded ${productsData.products.length} products across ${productsData._meta.categories.length} categories.`)
  console.log('\nNote: No prices stored — platform uses WhatsApp inquiry model.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
