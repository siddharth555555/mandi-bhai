import { PackUnit } from '../catalog/pack-unit';

export const CATEGORY_SEEDS = [
  {
    slug: 'staples',
    nameEn: 'Atta & Flour',
    nameHi: 'आटा',
    icon: 'grain',
    tint: '#E7EDFD',
    iconColor: '#2456E6',
    sortOrder: 1,
  },
  {
    slug: 'rice',
    nameEn: 'Rice & Grains',
    nameHi: 'चावल',
    icon: 'rice_bowl',
    tint: '#DEF3E9',
    iconColor: '#12A36B',
    sortOrder: 2,
  },
  {
    slug: 'oil',
    nameEn: 'Oils & Ghee',
    nameHi: 'तेल-घी',
    icon: 'water_drop',
    tint: '#FFF1D6',
    iconColor: '#E8930B',
    sortOrder: 3,
  },
  {
    slug: 'dal',
    nameEn: 'Dals & Pulses',
    nameHi: 'दालें',
    icon: 'nutrition',
    tint: '#FFE9E3',
    iconColor: '#FF5436',
    sortOrder: 4,
  },
  {
    slug: 'spice',
    nameEn: 'Masale',
    nameHi: 'मसाले',
    icon: 'local_fire_department',
    tint: '#FDE7EC',
    iconColor: '#E14D6B',
    sortOrder: 5,
  },
  {
    slug: 'sweet',
    nameEn: 'Sugar & Salt',
    nameHi: 'चीनी-नमक',
    icon: 'blur_on',
    tint: '#E2EEFF',
    iconColor: '#2563EB',
    sortOrder: 6,
  },
  {
    slug: 'bev',
    nameEn: 'Tea & Beverages',
    nameHi: 'चाय',
    icon: 'emoji_food_beverage',
    tint: '#E2EEFF',
    iconColor: '#2E7DF2',
    sortOrder: 7,
  },
  {
    slug: 'snack',
    nameEn: 'Snacks',
    nameHi: 'नमकीन',
    icon: 'cookie',
    tint: '#FFF1D6',
    iconColor: '#E8930B',
    sortOrder: 8,
  },
  {
    slug: 'dairy',
    nameEn: 'Dairy',
    nameHi: 'डेयरी',
    icon: 'water_full',
    tint: '#D9F0F2',
    iconColor: '#0E9AA7',
    sortOrder: 9,
  },
  {
    slug: 'clean',
    nameEn: 'Home & Clean',
    nameHi: 'सफ़ाई',
    icon: 'cleaning_services',
    tint: '#DEF3E9',
    iconColor: '#12A36B',
    sortOrder: 10,
  },
];

export type ProductSeed = {
  name: string;
  brand?: string;
  categorySlug: string;
  packValue: number;
  packUnit: PackUnit;
  /** Alternative names — how shopkeepers actually ask for the thing. */
  aliases: string[];
};

/**
 * Aliases deliberately mix Devanagari, romanized Hindi, English, and common
 * misspellings, because that's what real search traffic looks like. The
 * seeder tags locale automatically by script.
 */
export const PRODUCT_SEEDS: ProductSeed[] = [
  // -- Atta & Flour --
  {
    name: 'Aashirvaad Whole Wheat Atta',
    brand: 'Aashirvaad',
    categorySlug: 'staples',
    packValue: 5,
    packUnit: PackUnit.KG,
    aliases: [
      'आटा',
      'atta',
      'gehu ka atta',
      'wheat flour',
      'ashirwad atta',
      'ashirvad',
    ],
  },
  {
    name: 'Aashirvaad Whole Wheat Atta',
    brand: 'Aashirvaad',
    categorySlug: 'staples',
    packValue: 10,
    packUnit: PackUnit.KG,
    aliases: ['आटा 10 किलो', 'atta 10kg', 'ashirwad atta bada'],
  },
  {
    name: 'Pillsbury Chakki Fresh Atta',
    brand: 'Pillsbury',
    categorySlug: 'staples',
    packValue: 5,
    packUnit: PackUnit.KG,
    aliases: ['pillsbury atta', 'chakki atta', 'चक्की आटा'],
  },
  {
    name: 'Besan Gram Flour',
    categorySlug: 'staples',
    packValue: 1,
    packUnit: PackUnit.KG,
    aliases: ['बेसन', 'besan', 'gram flour', 'chana atta'],
  },

  // -- Rice & Grains --
  {
    name: 'India Gate Basmati Rice Classic',
    brand: 'India Gate',
    categorySlug: 'rice',
    packValue: 5,
    packUnit: PackUnit.KG,
    aliases: ['चावल', 'chawal', 'basmati', 'basmati chawal', 'india gate rice'],
  },
  {
    name: 'Daawat Rozana Gold Basmati Rice',
    brand: 'Daawat',
    categorySlug: 'rice',
    packValue: 5,
    packUnit: PackUnit.KG,
    aliases: ['daawat rice', 'dawat chawal', 'rozana rice'],
  },
  {
    name: 'Sona Masoori Rice',
    categorySlug: 'rice',
    packValue: 25,
    packUnit: PackUnit.KG,
    aliases: ['sona masuri', 'sona masoori', 'सोना मसूरी', 'south rice'],
  },
  {
    name: 'Poha Flattened Rice',
    categorySlug: 'rice',
    packValue: 1,
    packUnit: PackUnit.KG,
    aliases: ['पोहा', 'poha', 'chiwda', 'flattened rice'],
  },

  // -- Oils & Ghee --
  {
    name: 'Fortune Sunlite Refined Sunflower Oil',
    brand: 'Fortune',
    categorySlug: 'oil',
    packValue: 1,
    packUnit: PackUnit.L,
    aliases: ['तेल', 'tel', 'sunflower oil', 'refined oil', 'fortune oil'],
  },
  {
    name: 'Saffola Gold Refined Oil',
    brand: 'Saffola',
    categorySlug: 'oil',
    packValue: 1,
    packUnit: PackUnit.L,
    aliases: ['saffola oil', 'safola', 'सैफोला'],
  },
  {
    name: 'Amul Pure Ghee',
    brand: 'Amul',
    categorySlug: 'oil',
    packValue: 1,
    packUnit: PackUnit.L,
    aliases: ['घी', 'ghee', 'desi ghee', 'amul ghee'],
  },
  {
    name: 'Mustard Oil Kachi Ghani',
    categorySlug: 'oil',
    packValue: 1,
    packUnit: PackUnit.L,
    aliases: ['सरसों का तेल', 'sarson ka tel', 'mustard oil', 'kachi ghani'],
  },

  // -- Dals & Pulses --
  {
    name: 'Tata Sampann Toor Dal',
    brand: 'Tata Sampann',
    categorySlug: 'dal',
    packValue: 1,
    packUnit: PackUnit.KG,
    aliases: ['दाल', 'dal', 'arhar dal', 'toor dal', 'tur dal', 'अरहर दाल'],
  },
  {
    name: 'Tata Sampann Chana Dal',
    brand: 'Tata Sampann',
    categorySlug: 'dal',
    packValue: 1,
    packUnit: PackUnit.KG,
    aliases: ['चना दाल', 'chana dal', 'bengal gram'],
  },
  {
    name: 'Moong Dal Yellow',
    categorySlug: 'dal',
    packValue: 1,
    packUnit: PackUnit.KG,
    aliases: ['मूंग दाल', 'moong dal', 'mung dal', 'yellow lentil'],
  },
  {
    name: 'Rajma Kidney Beans',
    categorySlug: 'dal',
    packValue: 1,
    packUnit: PackUnit.KG,
    aliases: ['राजमा', 'rajma', 'kidney beans'],
  },

  // -- Masale --
  {
    name: 'Everest Turmeric Powder',
    brand: 'Everest',
    categorySlug: 'spice',
    packValue: 200,
    packUnit: PackUnit.G,
    aliases: ['हल्दी', 'haldi', 'turmeric', 'haldi powder', 'everest haldi'],
  },
  {
    name: 'MDH Deggi Mirch',
    brand: 'MDH',
    categorySlug: 'spice',
    packValue: 100,
    packUnit: PackUnit.G,
    aliases: ['मिर्च', 'mirchi', 'mirch', 'red chilli powder', 'lal mirch'],
  },
  {
    name: 'Catch Garam Masala',
    brand: 'Catch',
    categorySlug: 'spice',
    packValue: 100,
    packUnit: PackUnit.G,
    aliases: ['गरम मसाला', 'garam masala', 'masala'],
  },
  {
    name: 'Everest Jeera Whole',
    brand: 'Everest',
    categorySlug: 'spice',
    packValue: 100,
    packUnit: PackUnit.G,
    aliases: ['जीरा', 'jeera', 'cumin', 'cumin seeds'],
  },

  // -- Sugar & Salt --
  {
    name: 'Madhur Pure Sugar',
    brand: 'Madhur',
    categorySlug: 'sweet',
    packValue: 5,
    packUnit: PackUnit.KG,
    aliases: ['चीनी', 'cheeni', 'chini', 'shakkar', 'sugar'],
  },
  {
    name: 'Tata Salt Iodised',
    brand: 'Tata',
    categorySlug: 'sweet',
    packValue: 1,
    packUnit: PackUnit.KG,
    aliases: ['नमक', 'namak', 'salt', 'tata namak'],
  },
  {
    name: 'Jaggery Gud Block',
    categorySlug: 'sweet',
    packValue: 1,
    packUnit: PackUnit.KG,
    aliases: ['गुड़', 'gud', 'gur', 'jaggery'],
  },

  // -- Tea & Beverages --
  {
    name: 'Tata Tea Gold',
    brand: 'Tata Tea',
    categorySlug: 'bev',
    packValue: 1,
    packUnit: PackUnit.KG,
    aliases: ['चाय', 'chai', 'chai patti', 'tea', 'tata chai'],
  },
  {
    name: 'Brooke Bond Red Label Tea',
    brand: 'Red Label',
    categorySlug: 'bev',
    packValue: 500,
    packUnit: PackUnit.G,
    aliases: ['red label', 'लाल लेबल', 'redlabel chai'],
  },
  {
    name: 'Nescafe Classic Coffee',
    brand: 'Nescafe',
    categorySlug: 'bev',
    packValue: 200,
    packUnit: PackUnit.G,
    aliases: ['कॉफी', 'coffee', 'nescafe', 'coffee powder'],
  },

  // -- Snacks --
  {
    name: "Haldiram's Aloo Bhujia",
    brand: "Haldiram's",
    categorySlug: 'snack',
    packValue: 400,
    packUnit: PackUnit.G,
    aliases: ['नमकीन', 'namkeen', 'bhujia', 'aloo bhujia', 'haldiram namkeen'],
  },
  {
    name: 'Parle-G Glucose Biscuits',
    brand: 'Parle',
    categorySlug: 'snack',
    packValue: 800,
    packUnit: PackUnit.G,
    aliases: ['बिस्कुट', 'biscuit', 'parle g', 'parleg', 'glucose biscuit'],
  },
  {
    name: 'Britannia Good Day Cashew Cookies',
    brand: 'Britannia',
    categorySlug: 'snack',
    packValue: 600,
    packUnit: PackUnit.G,
    aliases: ['good day', 'गुड डे', 'cashew biscuit'],
  },

  // -- Dairy --
  {
    name: 'Amul Taaza Toned Milk',
    brand: 'Amul',
    categorySlug: 'dairy',
    packValue: 1,
    packUnit: PackUnit.L,
    aliases: ['दूध', 'doodh', 'milk', 'amul milk', 'taaza'],
  },
  {
    name: 'Amul Butter',
    brand: 'Amul',
    categorySlug: 'dairy',
    packValue: 500,
    packUnit: PackUnit.G,
    aliases: ['मक्खन', 'makhan', 'butter', 'amul butter'],
  },
  {
    name: 'Amul Masti Dahi',
    brand: 'Amul',
    categorySlug: 'dairy',
    packValue: 400,
    packUnit: PackUnit.G,
    aliases: ['दही', 'dahi', 'curd', 'yoghurt'],
  },

  // -- Home & Clean --
  {
    name: 'Surf Excel Easy Wash Detergent Powder',
    brand: 'Surf Excel',
    categorySlug: 'clean',
    packValue: 1,
    packUnit: PackUnit.KG,
    aliases: ['सर्फ', 'surf', 'detergent', 'washing powder', 'kapde ka powder'],
  },
  {
    name: 'Vim Dishwash Bar',
    brand: 'Vim',
    categorySlug: 'clean',
    packValue: 300,
    packUnit: PackUnit.G,
    aliases: ['बर्तन साबुन', 'bartan sabun', 'dish soap', 'vim bar'],
  },
  {
    name: 'Lifebuoy Total Soap',
    brand: 'Lifebuoy',
    categorySlug: 'clean',
    packValue: 125,
    packUnit: PackUnit.G,
    aliases: ['साबुन', 'sabun', 'soap', 'nahane ka sabun', 'lifebuoy'],
  },
  {
    name: 'Harpic Toilet Cleaner',
    brand: 'Harpic',
    categorySlug: 'clean',
    packValue: 1,
    packUnit: PackUnit.L,
    aliases: ['हार्पिक', 'harpic', 'toilet cleaner', 'bathroom cleaner'],
  },
];
