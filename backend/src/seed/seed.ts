/**
 * Manual seed script — creates sample mandis, Mandi Admins, wholesalers,
 * retailers, and delivery partners so the app has something to look at
 * without manually signing up through the UI every time the DB resets.
 *
 * Per product decision, Mandi Admin and Delivery Partner accounts are NOT
 * self-signup (see TODO.md). To add more of any kind, add an entry to the
 * relevant SEEDS array below and rerun:
 *
 *   npm run seed
 *
 * Safe to rerun any time — every insert checks for an existing row first.
 * Run this AFTER the backend has started at least once (so `synchronize`
 * has created the tables), and again any time the Postgres volume gets
 * wiped (e.g. after `docker compose down -v` or a volume prune).
 */
import { Repository } from 'typeorm';
import { seedDataSource } from './data-source';
import { Mandi } from '../mandis/mandi.entity';
import { User } from '../entities/user.entity';
import { MandiAdminProfile } from '../entities/mandi-admin-profile.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { WholesalerProfile } from '../entities/wholesaler-profile.entity';
import { DeliveryPartnerProfile } from '../entities/delivery-partner-profile.entity';
import { Category } from '../catalog/category.entity';
import { Product } from '../catalog/product.entity';
import {
  AliasLocale,
  AliasSource,
  ProductAlias,
  normaliseAlias,
} from '../catalog/product-alias.entity';
import { normalisePack } from '../catalog/pack-unit';
import { CATEGORY_SEEDS, PRODUCT_SEEDS } from './catalog-seed-data';
import { WholesalerListing } from '../listings/wholesaler-listing.entity';
import { UdhaarAccount } from '../wallet/udhaar-account.entity';

/**
 * Rough ₹ per base unit (per gram / per ml / per count) by category, used
 * only to generate believable seed prices. Real prices come from wholesalers.
 */
const CATEGORY_RATE: Record<string, number> = {
  staples: 0.05,
  rice: 0.09,
  oil: 0.15,
  dal: 0.13,
  spice: 0.5,
  sweet: 0.05,
  bev: 0.45,
  snack: 0.25,
  dairy: 0.07,
  clean: 0.13,
};

function basePriceFor(categorySlug: string, baseValue: number, baseUnit: string) {
  if (baseUnit === 'count') return baseValue * 8;
  const rate = CATEGORY_RATE[categorySlug] ?? 0.08;
  return baseValue * rate;
}

/** Each wholesaler prices a little above or below the others. */
const WHOLESALER_PRICE_FACTOR: Record<string, number> = {
  '9100000001': 0.96,
  '9100000002': 1.0,
  '9100000003': 1.07,
};

/** Skips every 3rd product at a different offset, so catalogues differ. */
const WHOLESALER_SKIP_OFFSET: Record<string, number> = {
  '9100000001': 0,
  '9100000002': 1,
  '9100000003': 2,
};

const STOCK_PATTERN = [120, 45, 8, 260, 0, 75, 5, 180];
const MOQ_PATTERN = [1, 2, 5, 1, 10, 1];

const MANDI_SEEDS = [
  { name: 'Naya Bazaar Mandi', city: 'Delhi' },
  { name: 'Vashi APMC Mandi', city: 'Navi Mumbai' },
  { name: 'Koyambedu Mandi', city: 'Chennai' },
  { name: 'Yeshwanthpur APMC', city: 'Bengaluru' },
  { name: 'Ghazipur Mandi', city: 'Delhi' },
];

// phone -> which seeded mandi (by name) this admin manages
const ADMIN_SEEDS: Array<{ phone: string; mandiName: string }> = [
  { phone: '9999900001', mandiName: 'Naya Bazaar Mandi' },
  { phone: '9999900002', mandiName: 'Vashi APMC Mandi' },
  { phone: '9999900003', mandiName: 'Koyambedu Mandi' },
];

const RETAILER_SEEDS: Array<{
  phone: string;
  shopName: string;
  address: string;
  udhaarLimit: number;
}> = [
  {
    phone: '9000000001',
    shopName: 'Sharma Kirana Store',
    address: 'Shop 12, Model Town Market, Delhi',
    udhaarLimit: 5000,
  },
  {
    phone: '9000000002',
    shopName: 'Verma General Store',
    address: 'Shop 4, Sector 15 Market, Navi Mumbai',
    udhaarLimit: 3000,
  },
  {
    phone: '9000000003',
    shopName: 'Iyer Provisions',
    address: '22 Gandhi Road, T Nagar, Chennai',
    udhaarLimit: 0, // deliberately left at 0 to exercise the "Udhaar not enabled" checkout path
  },
];

const WHOLESALER_SEEDS: Array<{
  phone: string;
  shopName: string;
  mandiName: string;
  address: string;
}> = [
  {
    phone: '9100000001',
    shopName: 'Gupta Traders',
    mandiName: 'Naya Bazaar Mandi',
    address: 'Shed 8, Naya Bazaar Mandi, Delhi',
  },
  {
    phone: '9100000002',
    shopName: 'Patel Wholesale Co.',
    mandiName: 'Vashi APMC Mandi',
    address: 'Block C, Vashi APMC Mandi, Navi Mumbai',
  },
  {
    phone: '9100000003',
    shopName: 'Murugan Agro Traders',
    mandiName: 'Koyambedu Mandi',
    address: 'Stall 45, Koyambedu Mandi, Chennai',
  },
];

// Platform-owned riders — manually seeded, mandi-scoped (see
// PLAN-order-delivery.md §1, §8; no self-signup yet, same as Mandi Admins).
const DELIVERY_PARTNER_SEEDS: Array<{
  phone: string;
  name: string;
  vehicleInfo: string;
  mandiName: string;
}> = [
  {
    phone: '9200000001',
    name: 'Ramesh Kumar',
    vehicleInfo: 'Bike · DL01AB1234',
    mandiName: 'Naya Bazaar Mandi',
  },
  {
    phone: '9200000002',
    name: 'Suresh Yadav',
    vehicleInfo: 'Bike · DL02CD5678',
    mandiName: 'Naya Bazaar Mandi',
  },
  {
    phone: '9200000003',
    name: 'Prakash Jadhav',
    vehicleInfo: 'Auto · MH04EF9012',
    mandiName: 'Vashi APMC Mandi',
  },
  {
    phone: '9200000004',
    name: 'Karthik Raja',
    vehicleInfo: 'Bike · TN09GH3456',
    mandiName: 'Koyambedu Mandi',
  },
];

async function getOrCreateUser(userRepo: Repository<User>, phone: string): Promise<User> {
  let user = await userRepo.findOne({ where: { phone } });
  if (!user) {
    user = await userRepo.save(userRepo.create({ phone }));
  }
  return user;
}

async function seed() {
  const ds = await seedDataSource.initialize();

  const mandiRepo = ds.getRepository(Mandi);
  const userRepo = ds.getRepository(User);
  const adminRepo = ds.getRepository(MandiAdminProfile);
  const retailerRepo = ds.getRepository(RetailerProfile);
  const wholesalerRepo = ds.getRepository(WholesalerProfile);
  const deliveryPartnerRepo = ds.getRepository(DeliveryPartnerProfile);
  const udhaarRepo = ds.getRepository(UdhaarAccount);

  // -- Mandis --
  const mandiByName = new Map<string, Mandi>();
  for (const m of MANDI_SEEDS) {
    let mandi = await mandiRepo.findOne({ where: { name: m.name } });
    if (!mandi) {
      mandi = await mandiRepo.save(mandiRepo.create(m));
      console.log(`Created mandi: ${mandi.name} (${mandi.id})`);
    } else {
      console.log(`Mandi already exists: ${mandi.name} (${mandi.id})`);
    }
    mandiByName.set(m.name, mandi);
  }

  // -- Mandi Admins --
  for (const a of ADMIN_SEEDS) {
    const mandi = mandiByName.get(a.mandiName);
    if (!mandi) {
      console.warn(`Skipping admin ${a.phone}: mandi "${a.mandiName}" not seeded`);
      continue;
    }

    const user = await getOrCreateUser(userRepo, a.phone);

    const existingAdmin = await adminRepo.findOne({ where: { userId: user.id } });
    if (existingAdmin) {
      console.log(`Admin profile already exists for ${a.phone}`);
      continue;
    }

    await adminRepo.save(adminRepo.create({ userId: user.id, mandiId: mandi.id }));
    console.log(`Created Mandi Admin: ${a.phone} -> ${mandi.name}`);
  }

  // -- Retailers --
  for (const r of RETAILER_SEEDS) {
    const user = await getOrCreateUser(userRepo, r.phone);

    const existing = await retailerRepo.findOne({ where: { userId: user.id } });
    if (existing) {
      console.log(`Retailer profile already exists for ${r.phone}`);
      continue;
    }

    await retailerRepo.save(
      retailerRepo.create({ userId: user.id, shopName: r.shopName, address: r.address }),
    );
    console.log(`Created Retailer: ${r.phone} -> ${r.shopName}`);
  }

  // -- Udhaar accounts (starter credit limits for the seeded retailers) --
  for (const r of RETAILER_SEEDS) {
    const user = await userRepo.findOne({ where: { phone: r.phone } });
    if (!user) continue;
    const retailer = await retailerRepo.findOne({ where: { userId: user.id } });
    if (!retailer) continue;

    const existing = await udhaarRepo.findOne({ where: { retailerProfileId: retailer.id } });
    if (existing) continue;

    await udhaarRepo.save(
      udhaarRepo.create({
        retailerProfileId: retailer.id,
        creditLimit: r.udhaarLimit.toFixed(2),
        outstandingBalance: '0.00',
      }),
    );
    console.log(`Udhaar account for ${r.phone}: limit ₹${r.udhaarLimit}`);
  }

  // -- Wholesalers --
  for (const w of WHOLESALER_SEEDS) {
    const mandi = mandiByName.get(w.mandiName);
    if (!mandi) {
      console.warn(`Skipping wholesaler ${w.phone}: mandi "${w.mandiName}" not seeded`);
      continue;
    }

    const user = await getOrCreateUser(userRepo, w.phone);

    const existing = await wholesalerRepo.findOne({ where: { userId: user.id } });
    if (existing) {
      console.log(`Wholesaler profile already exists for ${w.phone}`);
      continue;
    }

    await wholesalerRepo.save(
      wholesalerRepo.create({
        userId: user.id,
        shopName: w.shopName,
        mandiId: mandi.id,
        address: w.address,
      }),
    );
    console.log(`Created Wholesaler: ${w.phone} -> ${w.shopName} (${mandi.name})`);
  }

  // -- Delivery partners (riders) --
  for (const d of DELIVERY_PARTNER_SEEDS) {
    const mandi = mandiByName.get(d.mandiName);
    if (!mandi) {
      console.warn(`Skipping rider ${d.phone}: mandi "${d.mandiName}" not seeded`);
      continue;
    }

    const user = await getOrCreateUser(userRepo, d.phone);

    const existing = await deliveryPartnerRepo.findOne({ where: { userId: user.id } });
    if (existing) {
      console.log(`Delivery partner profile already exists for ${d.phone}`);
      continue;
    }

    await deliveryPartnerRepo.save(
      deliveryPartnerRepo.create({
        userId: user.id,
        name: d.name,
        vehicleInfo: d.vehicleInfo,
        mandiId: mandi.id,
      }),
    );
    console.log(`Created Delivery Partner: ${d.phone} -> ${d.name} (${mandi.name})`);
  }

  // -- Categories --
  const categoryRepo = ds.getRepository(Category);
  const categoryBySlug = new Map<string, Category>();
  let newCategories = 0;

  for (const c of CATEGORY_SEEDS) {
    let category = await categoryRepo.findOne({ where: { slug: c.slug } });
    if (!category) {
      category = await categoryRepo.save(categoryRepo.create(c));
      newCategories += 1;
    }
    categoryBySlug.set(c.slug, category);
  }
  console.log(
    `Categories: ${newCategories} created, ${CATEGORY_SEEDS.length - newCategories} already existed`,
  );

  // -- Products + aliases --
  const productRepo = ds.getRepository(Product);
  const aliasRepo = ds.getRepository(ProductAlias);
  let newProducts = 0;
  let newAliases = 0;

  for (const p of PRODUCT_SEEDS) {
    const category = categoryBySlug.get(p.categorySlug);
    if (!category) {
      console.warn(`Skipping "${p.name}": category "${p.categorySlug}" not seeded`);
      continue;
    }

    const packValue = p.packValue.toFixed(2);
    let product = await productRepo.findOne({
      where: { name: p.name, packValue, packUnit: p.packUnit },
    });

    if (!product) {
      const { baseValue, baseUnit } = normalisePack(p.packValue, p.packUnit);
      product = await productRepo.save(
        productRepo.create({
          name: p.name,
          brand: p.brand,
          categoryId: category.id,
          packValue,
          packUnit: p.packUnit,
          packBaseValue: baseValue.toFixed(2),
          packBaseUnit: baseUnit,
        }),
      );
      newProducts += 1;
    }

    for (const alias of p.aliases) {
      const normalised = normaliseAlias(alias);
      const exists = await aliasRepo.findOne({
        where: { productId: product.id, normalised },
      });
      if (exists) continue;

      await aliasRepo.save(
        aliasRepo.create({
          productId: product.id,
          alias: alias.trim(),
          normalised,
          // Tag by script so Devanagari and romanized spellings stay distinguishable.
          locale: /[ऀ-ॿ]/.test(alias) ? AliasLocale.HI : AliasLocale.EN,
          source: AliasSource.SYSTEM,
        }),
      );
      newAliases += 1;
    }
  }

  console.log(
    `Products: ${newProducts} created, ${PRODUCT_SEEDS.length - newProducts} already existed`,
  );
  console.log(`Aliases: ${newAliases} created`);

  // -- Wholesaler listings --
  // Prices are derived from a per-category rate applied to each product's
  // canonical base measure, then nudged per wholesaler. That gives plausible
  // figures without price needing to live on the master product.
  const listingRepo = ds.getRepository(WholesalerListing);
  const allProducts = await productRepo.find({ relations: { category: true } });

  let newListings = 0;

  for (const w of WHOLESALER_SEEDS) {
    const user = await userRepo.findOne({ where: { phone: w.phone } });
    if (!user) continue;
    const profile = await wholesalerRepo.findOne({ where: { userId: user.id } });
    if (!profile) continue;

    const variance = WHOLESALER_PRICE_FACTOR[w.phone] ?? 1;

    // Each wholesaler stocks a different slice of the catalogue so the
    // multi-seller comparison on a product page has something to show.
    const stocked = allProducts.filter(
      (_, index) => index % 3 !== WHOLESALER_SKIP_OFFSET[w.phone],
    );

    for (const product of stocked) {
      const exists = await listingRepo.findOne({
        where: { productId: product.id, wholesalerProfileId: profile.id },
      });
      if (exists) continue;

      const base = basePriceFor(
        product.category?.slug ?? 'staples',
        Number(product.packBaseValue),
        product.packBaseUnit,
      );
      const price = Math.max(10, Math.round(base * variance));
      const mrp = Math.round(price * 1.18);

      // A few deliberately low-stock rows so the inventory screen's
      // "low / out" counter isn't always zero.
      const stock = STOCK_PATTERN[newListings % STOCK_PATTERN.length];

      await listingRepo.save(
        listingRepo.create({
          productId: product.id,
          wholesalerProfileId: profile.id,
          mandiId: profile.mandiId,
          pricePerUnit: price.toFixed(2),
          mrp: mrp.toFixed(2),
          stockUnits: stock,
          moq: MOQ_PATTERN[newListings % MOQ_PATTERN.length],
        }),
      );
      newListings += 1;
    }
  }

  console.log(`Listings: ${newListings} created`);

  await ds.destroy();
  console.log('Seed complete.');
  console.log('');
  console.log('Log in as any seeded phone number above via the app\'s Phone screen —');
  console.log('OTP is dev-stubbed, so use the "Autofill dev OTP" button after requesting it.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
