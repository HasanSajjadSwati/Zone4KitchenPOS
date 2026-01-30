import { db } from '@/db';
import { logAudit } from '@/utils/audit';
import type { Category, MenuItem, Variant, VariantOption, MenuItemVariant, Deal, DealItem } from '@/db/types';
import { createId } from '@/utils/uuid';

/**
 * Seeds the Zone Kitchen menu into the POS system.
 * Clears all existing menu data before importing.
 */
export async function seedZoneKitchenMenu(userId: string) {
  const now = new Date();

  // ═══════════════════════════════════════════════════════════
  //  CATEGORIES
  // ═══════════════════════════════════════════════════════════

  // Major
  const FAST = createId();
  const DESI = createId();

  // Fastfood sub-categories
  const BURGERS = createId();
  const ROLLS = createId();
  const PIZZAS = createId();
  const PASTA = createId();
  const WINGS = createId();
  const DRINKS = createId();
  const DEAL_PARTS = createId();

  // Pakistani/Desi sub-categories
  const PLATTERS = createId();
  const PULAO = createId();
  const KARAHI = createId();
  const BBQ = createId();
  const VEG = createId();
  const FISH = createId();
  const TANDOOR = createId();
  const DESI_EXTRAS = createId();

  const categories: Category[] = [
    { id: FAST, name: 'Fastfood', type: 'major', parentId: null, sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
    { id: DESI, name: 'Pakistani/Desi', type: 'major', parentId: null, sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
    // Fastfood subs
    { id: BURGERS, name: 'Burgers', type: 'sub', parentId: FAST, sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
    { id: ROLLS, name: 'Rolls & Wraps', type: 'sub', parentId: FAST, sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
    { id: PIZZAS, name: 'Pizzas', type: 'sub', parentId: FAST, sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
    { id: PASTA, name: 'Cheesy Pasta', type: 'sub', parentId: FAST, sortOrder: 4, isActive: true, createdAt: now, updatedAt: now },
    { id: WINGS, name: 'Wings & Sides', type: 'sub', parentId: FAST, sortOrder: 5, isActive: true, createdAt: now, updatedAt: now },
    { id: DRINKS, name: 'Cold Drinks', type: 'sub', parentId: FAST, sortOrder: 6, isActive: true, createdAt: now, updatedAt: now },
    { id: DEAL_PARTS, name: 'Deal Components', type: 'sub', parentId: FAST, sortOrder: 99, isActive: true, createdAt: now, updatedAt: now },
    // Pakistani subs
    { id: PLATTERS, name: 'Special Platters', type: 'sub', parentId: DESI, sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
    { id: PULAO, name: 'Chicken Pulao', type: 'sub', parentId: DESI, sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
    { id: KARAHI, name: 'Handi & Karahi', type: 'sub', parentId: DESI, sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
    { id: BBQ, name: 'Bar BQ', type: 'sub', parentId: DESI, sortOrder: 4, isActive: true, createdAt: now, updatedAt: now },
    { id: VEG, name: 'Vegetable & Meat', type: 'sub', parentId: DESI, sortOrder: 5, isActive: true, createdAt: now, updatedAt: now },
    { id: FISH, name: 'Fish', type: 'sub', parentId: DESI, sortOrder: 6, isActive: true, createdAt: now, updatedAt: now },
    { id: TANDOOR, name: 'Tandoor', type: 'sub', parentId: DESI, sortOrder: 7, isActive: true, createdAt: now, updatedAt: now },
    { id: DESI_EXTRAS, name: 'Extras', type: 'sub', parentId: DESI, sortOrder: 8, isActive: true, createdAt: now, updatedAt: now },
  ];

  // ═══════════════════════════════════════════════════════════
  //  VARIANTS & OPTIONS
  // ═══════════════════════════════════════════════════════════

  const VAR_FLAVOUR = createId();
  const VAR_BRAND = createId();

  const OPT_TIKKA = createId();
  const OPT_FAJITA = createId();
  const OPT_HOT_SPICY = createId();
  const OPT_CHEESE = createId();
  const OPT_VEGETABLE = createId();
  const OPT_TANDOORI = createId();

  const OPT_PEPSI = createId();
  const OPT_SPRITE = createId();
  const OPT_FANTA = createId();
  const OPT_COKE = createId();
  const OPT_MIRINDA = createId();
  const OPT_7UP = createId();
  const OPT_NEXT = createId();
  const OPT_FIZZUP = createId();

  const allFlavourOpts = [OPT_TIKKA, OPT_FAJITA, OPT_HOT_SPICY, OPT_CHEESE, OPT_VEGETABLE, OPT_TANDOORI];
  const allBrandOpts = [OPT_PEPSI, OPT_SPRITE, OPT_FANTA, OPT_COKE, OPT_MIRINDA, OPT_7UP, OPT_NEXT, OPT_FIZZUP];

  const variants: Variant[] = [
    { id: VAR_FLAVOUR, name: 'Pizza Flavour', type: 'flavour', sortOrder: 1, isActive: true, createdAt: now },
    { id: VAR_BRAND, name: 'Drink Brand', type: 'custom', sortOrder: 2, isActive: true, createdAt: now },
  ];

  const variantOptions: VariantOption[] = [
    // Pizza Flavours
    { id: OPT_TIKKA, variantId: VAR_FLAVOUR, name: 'Tikka', priceModifier: 0, sortOrder: 1, isActive: true, createdAt: now },
    { id: OPT_FAJITA, variantId: VAR_FLAVOUR, name: 'Fajita', priceModifier: 0, sortOrder: 2, isActive: true, createdAt: now },
    { id: OPT_HOT_SPICY, variantId: VAR_FLAVOUR, name: 'Hot Spicy', priceModifier: 0, sortOrder: 3, isActive: true, createdAt: now },
    { id: OPT_CHEESE, variantId: VAR_FLAVOUR, name: 'Cheese', priceModifier: 0, sortOrder: 4, isActive: true, createdAt: now },
    { id: OPT_VEGETABLE, variantId: VAR_FLAVOUR, name: 'Vegetable', priceModifier: 0, sortOrder: 5, isActive: true, createdAt: now },
    { id: OPT_TANDOORI, variantId: VAR_FLAVOUR, name: 'Tandoori', priceModifier: 0, sortOrder: 6, isActive: true, createdAt: now },
    // Drink Brands
    { id: OPT_PEPSI, variantId: VAR_BRAND, name: 'Pepsi', priceModifier: 0, sortOrder: 1, isActive: true, createdAt: now },
    { id: OPT_SPRITE, variantId: VAR_BRAND, name: 'Sprite', priceModifier: 0, sortOrder: 2, isActive: true, createdAt: now },
    { id: OPT_FANTA, variantId: VAR_BRAND, name: 'Fanta', priceModifier: 0, sortOrder: 3, isActive: true, createdAt: now },
    { id: OPT_COKE, variantId: VAR_BRAND, name: 'Coke', priceModifier: 0, sortOrder: 4, isActive: true, createdAt: now },
    { id: OPT_MIRINDA, variantId: VAR_BRAND, name: 'Mirinda', priceModifier: 0, sortOrder: 5, isActive: true, createdAt: now },
    { id: OPT_7UP, variantId: VAR_BRAND, name: '7UP', priceModifier: 0, sortOrder: 6, isActive: true, createdAt: now },
    { id: OPT_NEXT, variantId: VAR_BRAND, name: 'Next Cola', priceModifier: 0, sortOrder: 7, isActive: true, createdAt: now },
    { id: OPT_FIZZUP, variantId: VAR_BRAND, name: 'Fizz Up', priceModifier: 0, sortOrder: 8, isActive: true, createdAt: now },
  ];

  // ═══════════════════════════════════════════════════════════
  //  MENU ITEMS — with tracked IDs for deal references
  // ═══════════════════════════════════════════════════════════

  function mi(id: string, name: string, cat: string, price: number, opts?: { desc?: string; variants?: boolean; dealOnly?: boolean }): MenuItem {
    return {
      id, name, categoryId: cat, price,
      description: opts?.desc ?? null,
      isActive: true,
      isDealOnly: opts?.dealOnly ?? false,
      hasVariants: opts?.variants ?? false,
      createdAt: now, updatedAt: now,
    };
  }

  // ── Burgers ──
  const ID_ZINGER = createId();
  const ID_CRISPY = createId();
  const ID_MIGHTY = createId();
  const ID_MONSTER = createId();
  const ID_CGRILL_S = createId();
  const ID_CGRILL_D = createId();
  const ID_BEEF_S = createId();
  const ID_BEEF_D = createId();

  // ── Rolls ──
  const ID_BEHARI_ROLL = createId();
  const ID_ARABIC_ROLL = createId();
  const ID_TWISTER_S = createId();
  const ID_TWISTER_D = createId();

  // ── Pizzas (each size is a separate item, all have Flavour variant) ──
  const ID_CROWN_R = createId();
  const ID_CROWN_L = createId();
  const ID_CROWN_P = createId();
  const ID_BEHARI_R = createId();
  const ID_BEHARI_L = createId();
  const ID_BEHARI_P = createId();
  const ID_STUFF_R = createId();
  const ID_STUFF_L = createId();
  const ID_STUFF_P = createId();
  const ID_SPAM_R = createId();
  const ID_SPAM_L = createId();
  const ID_SPAM_P = createId();
  const ID_XTREME_S = createId();
  const ID_XTREME_R = createId();
  const ID_XTREME_L = createId();
  const ID_XTREME_P = createId();
  const ID_SAND_S = createId();
  const ID_SAND_R = createId();
  const ID_SAND_L = createId();
  const ID_SAND_P = createId();

  // ── Cheesy Pasta ──
  const ID_ALFREDO = createId();
  const ID_CRUNCHY_PASTA = createId();

  // ── Cold Drinks (each size, each has Brand variant) ──
  const ID_DRINK_345 = createId();
  const ID_DRINK_500 = createId();
  const ID_DRINK_1L = createId();
  const ID_DRINK_1_5L = createId();

  // ── Deal-Only Components ──
  const ID_CHICKEN_PC = createId();
  const ID_REG_FRIES = createId();
  const ID_LRG_FRIES = createId();
  const ID_DIP_SAUCE = createId();
  const ID_HOT_WING = createId();
  const ID_DEAL_PIZZA_S = createId();
  const ID_DEAL_PIZZA_R = createId();
  const ID_DEAL_PIZZA_L = createId();
  const ID_DEAL_PIZZA_P = createId();

  // Collect all pizza IDs for variant linking
  const allPizzaIds = [
    ID_CROWN_R, ID_CROWN_L, ID_CROWN_P,
    ID_BEHARI_R, ID_BEHARI_L, ID_BEHARI_P,
    ID_STUFF_R, ID_STUFF_L, ID_STUFF_P,
    ID_SPAM_R, ID_SPAM_L, ID_SPAM_P,
    ID_XTREME_S, ID_XTREME_R, ID_XTREME_L, ID_XTREME_P,
    ID_SAND_S, ID_SAND_R, ID_SAND_L, ID_SAND_P,
  ];

  const allDrinkIds = [ID_DRINK_345, ID_DRINK_500, ID_DRINK_1L, ID_DRINK_1_5L];

  const menuItems: MenuItem[] = [
    // ── Burgers ──
    mi(ID_ZINGER, 'Zinger Burger', BURGERS, 450),
    mi(ID_CRISPY, 'Crispy Spicy Zinger Burger', BURGERS, 530),
    mi(ID_MIGHTY, 'Mighty Zinger Burger', BURGERS, 650),
    mi(ID_MONSTER, 'Monster Burger', BURGERS, 780),
    mi(ID_CGRILL_S, 'Chicken Grill Single Patty', BURGERS, 580),
    mi(ID_CGRILL_D, 'Chicken Grill Double Patty', BURGERS, 760),
    mi(ID_BEEF_S, 'Beef Burger Single Patty', BURGERS, 560),
    mi(ID_BEEF_D, 'Beef Burger Double Patty', BURGERS, 800),

    // ── Rolls & Wraps ──
    mi(ID_BEHARI_ROLL, 'Special Behari Roll', ROLLS, 580),
    mi(ID_ARABIC_ROLL, 'Arabic Rolls', ROLLS, 490),
    mi(ID_TWISTER_S, 'Twister Roll Single', ROLLS, 350),
    mi(ID_TWISTER_D, 'Twister Roll Double', ROLLS, 660),

    // ── Pizzas (per size, with flavour variant) ──
    mi(ID_CROWN_R, 'Crown Crust Pizza Regular', PIZZAS, 1350, { variants: true }),
    mi(ID_CROWN_L, 'Crown Crust Pizza Large', PIZZAS, 1600, { variants: true }),
    mi(ID_CROWN_P, 'Crown Crust Pizza Party', PIZZAS, 2400, { variants: true }),
    mi(ID_BEHARI_R, 'Behari Kabab Pizza Regular', PIZZAS, 1350, { variants: true }),
    mi(ID_BEHARI_L, 'Behari Kabab Pizza Large', PIZZAS, 1600, { variants: true }),
    mi(ID_BEHARI_P, 'Behari Kabab Pizza Party', PIZZAS, 2400, { variants: true }),
    mi(ID_STUFF_R, 'Stuff Crust Pizza Regular', PIZZAS, 1450, { variants: true }),
    mi(ID_STUFF_L, 'Stuff Crust Pizza Large', PIZZAS, 1950, { variants: true }),
    mi(ID_STUFF_P, 'Stuff Crust Pizza Party', PIZZAS, 2850, { variants: true }),
    mi(ID_SPAM_R, 'Spam Cheezy Pizza Regular', PIZZAS, 1450, { variants: true }),
    mi(ID_SPAM_L, 'Spam Cheezy Pizza Large', PIZZAS, 1950, { variants: true }),
    mi(ID_SPAM_P, 'Spam Cheezy Pizza Party', PIZZAS, 2850, { variants: true }),
    mi(ID_XTREME_S, 'Xtreme Pizza Small', PIZZAS, 700, { variants: true }),
    mi(ID_XTREME_R, 'Xtreme Pizza Regular', PIZZAS, 1500, { variants: true }),
    mi(ID_XTREME_L, 'Xtreme Pizza Large', PIZZAS, 2000, { variants: true }),
    mi(ID_XTREME_P, 'Xtreme Pizza Party', PIZZAS, 2800, { variants: true }),
    mi(ID_SAND_S, 'Sandwich Pizza Small', PIZZAS, 630, { variants: true }),
    mi(ID_SAND_R, 'Sandwich Pizza Regular', PIZZAS, 1370, { variants: true }),
    mi(ID_SAND_L, 'Sandwich Pizza Large', PIZZAS, 1890, { variants: true }),
    mi(ID_SAND_P, 'Sandwich Pizza Party', PIZZAS, 2700, { variants: true }),

    // ── Cheesy Pasta ──
    mi(ID_ALFREDO, 'Alfredo Pasta', PASTA, 800),
    mi(ID_CRUNCHY_PASTA, 'Crunchy Chicken Pasta', PASTA, 800),
    mi(createId(), 'Special Roasted Platter', PASTA, 950),
    mi(createId(), 'Classic Roll Platter', PASTA, 850),
    mi(createId(), 'Pizza Stacker', PASTA, 850),
    mi(createId(), 'Mexican Sandwich', PASTA, 850),
    mi(createId(), 'Calzone Chunks', PASTA, 950),

    // ── Wings & Sides ──
    mi(createId(), 'Oven Baked Wings (Flaming)', WINGS, 1150),
    mi(createId(), 'Oven Baked Wings', WINGS, 550),
    mi(createId(), 'Loaded Fries', WINGS, 550),
    mi(createId(), '6 Nuggets', WINGS, 400),

    // ── Cold Drinks (per size, with Brand variant) ──
    mi(ID_DRINK_345, 'Cold Drink 345ml', DRINKS, 100, { variants: true }),
    mi(ID_DRINK_500, 'Cold Drink 500ml', DRINKS, 120, { variants: true }),
    mi(ID_DRINK_1L, 'Cold Drink 1 Litre', DRINKS, 150, { variants: true }),
    mi(ID_DRINK_1_5L, 'Cold Drink 1.5 Litre', DRINKS, 200, { variants: true }),
    mi(createId(), 'Special Salad', DRINKS, 100),
    mi(createId(), 'Raita', DRINKS, 50),

    // ── Deal-Only Components (hidden from menu, used in deals) ──
    mi(ID_CHICKEN_PC, 'Chicken Piece', DEAL_PARTS, 0, { dealOnly: true }),
    mi(ID_REG_FRIES, 'Regular Fries', DEAL_PARTS, 0, { dealOnly: true }),
    mi(ID_LRG_FRIES, 'Large Fries', DEAL_PARTS, 0, { dealOnly: true }),
    mi(ID_DIP_SAUCE, 'Dip Sauce', DEAL_PARTS, 0, { dealOnly: true }),
    mi(ID_HOT_WING, 'Hot Wing', DEAL_PARTS, 0, { dealOnly: true }),
    mi(ID_DEAL_PIZZA_S, 'Small Pizza', DEAL_PARTS, 0, { dealOnly: true }),
    mi(ID_DEAL_PIZZA_R, 'Regular Pizza', DEAL_PARTS, 0, { dealOnly: true }),
    mi(ID_DEAL_PIZZA_L, 'Large Pizza', DEAL_PARTS, 0, { dealOnly: true }),
    mi(ID_DEAL_PIZZA_P, 'Party Pizza', DEAL_PARTS, 0, { dealOnly: true }),

    // ── Special Platters ──
    mi(createId(), 'Special Platter 1', PLATTERS, 1350, { desc: '800g Rice, 2 Seekh Kabab, 1 Chicken Boti Seekh, 1 Malai Boti Seekh, 500ml Drink' }),
    mi(createId(), 'Special Platter 2', PLATTERS, 2450, { desc: '2 Chicken Tikka, 4 Seekh Kabab, 2 Malai Boti Seekh, 2 Chicken Boti Seekh, 6 Nan, 1.5L Drink' }),
    mi(createId(), 'Special Platter 3', PLATTERS, 3150, { desc: '1.5Kg Rice, 4 Seekh Kabab, 2 Chicken Boti, 2 Malai Boti Seekh, 1 Chicken Tikka, 1.5L Drink' }),
    mi(createId(), 'Special Platter 4', PLATTERS, 3850, { desc: '1.2Kg Pulao, 3 Seekh Kabab, 1 Tikka Boti, 2 Malai Boti, 1 Chicken Tikka, Half Karahi, 8 Nan, 1.5L Drink' }),
    mi(createId(), 'Special Platter 5', PLATTERS, 3990, { desc: '1.2Kg Pulao, 3 Seekh Kabab, 1 Tikka Boti, 1 Malai Boti, Half Mutton Karahi, 1 Chicken Tikka, 5 Nan, 1L Drink' }),
    mi(createId(), 'Special Platter 6', PLATTERS, 6950, { desc: '1.6Kg Pulao, 6 Seekh Kabab, 2 Tikka Boti, 2 Malai Boti, 2 Chicken Tikka, Full Mutton Karahi, 8 Nan, 1.5L Drink' }),

    // ── Chicken Pulao ──
    mi(createId(), 'Single Pulao', PULAO, 470),
    mi(createId(), 'Chicken Piece Choice', PULAO, 490),
    mi(createId(), 'Single Without Kabab', PULAO, 400),
    mi(createId(), 'Single Lunch Box', PULAO, 510),
    mi(createId(), 'Special Pulao', PULAO, 600),
    mi(createId(), 'Special Choice', PULAO, 620),
    mi(createId(), 'Special Without Kabab', PULAO, 530),
    mi(createId(), 'Special Lunch Box', PULAO, 630),
    mi(createId(), 'Pulao Kabab', PULAO, 370),
    mi(createId(), 'Pulao (Plain)', PULAO, 300),
    mi(createId(), 'Beef Shami Kabab', PULAO, 60),

    // ── Handi & Karahi (Half / Full as separate items) ──
    mi(createId(), 'Chicken Karahi Half', KARAHI, 950),
    mi(createId(), 'Chicken Karahi Full', KARAHI, 1800),
    mi(createId(), 'Chicken White Karahi Half', KARAHI, 1000),
    mi(createId(), 'Chicken White Karahi Full', KARAHI, 2000),
    mi(createId(), 'Chicken Karahi with Butter Half', KARAHI, 1000),
    mi(createId(), 'Chicken Karahi with Butter Full', KARAHI, 1900),
    mi(createId(), 'Chicken Boneless Handi Half', KARAHI, 1150),
    mi(createId(), 'Chicken Boneless Handi Full', KARAHI, 2200),
    mi(createId(), 'Chicken Boneless White Handi Half', KARAHI, 1250),
    mi(createId(), 'Chicken Boneless White Handi Full', KARAHI, 2300),
    mi(createId(), 'Beef Karahi Boneless Half', KARAHI, 1500),
    mi(createId(), 'Beef Karahi Boneless Full', KARAHI, 2700),
    mi(createId(), 'Beef White Karahi Boneless Half', KARAHI, 1500),
    mi(createId(), 'Beef White Karahi Boneless Full', KARAHI, 2600),
    mi(createId(), 'Seekh Kabab Fry Half', KARAHI, 1000),
    mi(createId(), 'Seekh Kabab Fry Full', KARAHI, 2050),
    mi(createId(), 'Tikka Half', KARAHI, 1050),
    mi(createId(), 'Tikka Full', KARAHI, 2100),
    mi(createId(), 'Mutton Karahi Half', KARAHI, 2000),
    mi(createId(), 'Mutton Karahi Full', KARAHI, 3600),
    mi(createId(), 'Dumba Shinwari / Sulemani Half', KARAHI, 2350),
    mi(createId(), 'Dumba Shinwari / Sulemani Full', KARAHI, 4400),
    mi(createId(), 'Desi Chicken Karahi Full', KARAHI, 3400),

    // ── Bar BQ ──
    mi(createId(), 'Chicken Tikka', BBQ, 400),
    mi(createId(), 'Chicken Boti', BBQ, 280),
    mi(createId(), 'Chicken Malai Boti', BBQ, 300),
    mi(createId(), 'Chicken Seekh Kabab 6', BBQ, 750),
    mi(createId(), 'Chicken Seekh Kabab 12', BBQ, 1500),
    mi(createId(), 'Chicken Seekh Kabab Fry 12', BBQ, 2100),

    // ── Vegetable & Meat ──
    mi(createId(), 'Chicken Qorma', VEG, 350),
    mi(createId(), 'Daal', VEG, 250),
    mi(createId(), 'Sabzi', VEG, 200),

    // ── Fish ──
    mi(createId(), 'Fried Fish / Grilled Fish', FISH, 0, { desc: 'Price varies' }),

    // ── Tandoor ──
    mi(createId(), 'Roti', TANDOOR, 20),
    mi(createId(), 'Plain Nan', TANDOOR, 30),
    mi(createId(), 'Roghni Nan', TANDOOR, 60),
    mi(createId(), 'Garlic Nan', TANDOOR, 60),
    mi(createId(), 'Kalwanji Nan', TANDOOR, 60),

    // ── Desi Extras ──
    mi(createId(), 'Raita', DESI_EXTRAS, 50),
    mi(createId(), 'Special Salad', DESI_EXTRAS, 100),
  ];

  // ═══════════════════════════════════════════════════════════
  //  MENU ITEM ↔ VARIANT LINKS
  // ═══════════════════════════════════════════════════════════

  const menuItemVariants: MenuItemVariant[] = [];

  // All standalone pizzas → Pizza Flavour (required, single-select)
  for (const pizzaId of allPizzaIds) {
    menuItemVariants.push({
      id: createId(),
      menuItemId: pizzaId,
      variantId: VAR_FLAVOUR,
      isRequired: true,
      selectionMode: 'single',
      availableOptionIds: allFlavourOpts,
      createdAt: now,
    });
  }

  // All cold drinks → Drink Brand (required, single-select)
  for (const drinkId of allDrinkIds) {
    menuItemVariants.push({
      id: createId(),
      menuItemId: drinkId,
      variantId: VAR_BRAND,
      isRequired: true,
      selectionMode: 'single',
      availableOptionIds: allBrandOpts,
      createdAt: now,
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  DEALS + DEAL ITEMS
  // ═══════════════════════════════════════════════════════════

  const deals: Deal[] = [];
  const dealItems: DealItem[] = [];

  /** Helper: create a deal and its items in one call */
  function addDeal(
    name: string,
    price: number,
    description: string,
    items: Array<{ menuItemId: string; quantity: number; requiresVariantSelection?: boolean }>
  ) {
    const dealId = createId();
    deals.push({
      id: dealId, name, description, price,
      categoryId: null, isActive: true, hasVariants: false,
      createdAt: now, updatedAt: now,
    });
    items.forEach((item, idx) => {
      dealItems.push({
        id: createId(),
        dealId,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        requiresVariantSelection: item.requiresVariantSelection ?? false,
        sortOrder: idx + 1,
        createdAt: now,
      });
    });
  }

  // ── Burger Meals ──
  addDeal('Burger Meal 1', 790,
    '1 Zinger Burger, 1 Pcs Chicken, 1 Regular Fries, 1 Drink (345ml)', [
    { menuItemId: ID_ZINGER, quantity: 1 },
    { menuItemId: ID_CHICKEN_PC, quantity: 1 },
    { menuItemId: ID_REG_FRIES, quantity: 1 },
    { menuItemId: ID_DRINK_345, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Burger Meal 2', 790,
    '1 Mighty Zinger, 1 Regular Fries, 1 Drink (345ml)', [
    { menuItemId: ID_MIGHTY, quantity: 1 },
    { menuItemId: ID_REG_FRIES, quantity: 1 },
    { menuItemId: ID_DRINK_345, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Burger Meal 3', 1080,
    '2 Zinger Burgers, 1 Regular Fries, 2 Drinks 345ml', [
    { menuItemId: ID_ZINGER, quantity: 2 },
    { menuItemId: ID_REG_FRIES, quantity: 1 },
    { menuItemId: ID_DRINK_345, quantity: 2, requiresVariantSelection: true },
  ]);

  addDeal('Burger Meal 4', 1360,
    '2 Zinger Burgers, 2 Pcs Chicken, 1 Regular Fries, 2 Drinks (345ml)', [
    { menuItemId: ID_ZINGER, quantity: 2 },
    { menuItemId: ID_CHICKEN_PC, quantity: 2 },
    { menuItemId: ID_REG_FRIES, quantity: 1 },
    { menuItemId: ID_DRINK_345, quantity: 2, requiresVariantSelection: true },
  ]);

  addDeal('Burger Meal 5', 1550,
    '3 Zinger Burgers, 1 Large Fries, 1 Dip Sauce, 1 Litre Drink', [
    { menuItemId: ID_ZINGER, quantity: 3 },
    { menuItemId: ID_LRG_FRIES, quantity: 1 },
    { menuItemId: ID_DIP_SAUCE, quantity: 1 },
    { menuItemId: ID_DRINK_1L, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Burger Meal 6', 1750,
    '3 Zinger Burgers, 3 Pcs Chicken, 1 Litre Drink', [
    { menuItemId: ID_ZINGER, quantity: 3 },
    { menuItemId: ID_CHICKEN_PC, quantity: 3 },
    { menuItemId: ID_DRINK_1L, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Burger Meal 7', 1950,
    '4 Zinger Burgers, 1 Regular Fries, 8 Hot Wings, 1 Dip Sauce, 1 Litre Drink', [
    { menuItemId: ID_ZINGER, quantity: 4 },
    { menuItemId: ID_REG_FRIES, quantity: 1 },
    { menuItemId: ID_HOT_WING, quantity: 8 },
    { menuItemId: ID_DIP_SAUCE, quantity: 1 },
    { menuItemId: ID_DRINK_1L, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Burger Meal 8', 2000,
    '4 Zinger Burgers, 4 Pcs Chicken, 1 Dip Sauce, 1.5 Litre Drink', [
    { menuItemId: ID_ZINGER, quantity: 4 },
    { menuItemId: ID_CHICKEN_PC, quantity: 4 },
    { menuItemId: ID_DIP_SAUCE, quantity: 1 },
    { menuItemId: ID_DRINK_1_5L, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Burger Meal 9', 1990,
    '5 Zinger Burgers, 1 Dip Sauce, 1 Litre Drink', [
    { menuItemId: ID_ZINGER, quantity: 5 },
    { menuItemId: ID_DIP_SAUCE, quantity: 1 },
    { menuItemId: ID_DRINK_1L, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Burger Meal 10', 2970,
    '5 Zinger Burgers, 1 Crunchy Pasta, 1 Large Fries, 1.5 Litre Drink', [
    { menuItemId: ID_ZINGER, quantity: 5 },
    { menuItemId: ID_CRUNCHY_PASTA, quantity: 1 },
    { menuItemId: ID_LRG_FRIES, quantity: 1 },
    { menuItemId: ID_DRINK_1_5L, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Burger Meal 11', 3290,
    '6 Zinger Burgers, 6 Pcs Chicken, 1 Regular Fries, Dip Sauce, 1.5 Litre Drink', [
    { menuItemId: ID_ZINGER, quantity: 6 },
    { menuItemId: ID_CHICKEN_PC, quantity: 6 },
    { menuItemId: ID_REG_FRIES, quantity: 1 },
    { menuItemId: ID_DIP_SAUCE, quantity: 1 },
    { menuItemId: ID_DRINK_1_5L, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Burger Meal 12', 3380,
    '8 Zinger Burgers, 1 Large Fries, 1 Dip Sauce, 1.5 Litre Drink', [
    { menuItemId: ID_ZINGER, quantity: 8 },
    { menuItemId: ID_LRG_FRIES, quantity: 1 },
    { menuItemId: ID_DIP_SAUCE, quantity: 1 },
    { menuItemId: ID_DRINK_1_5L, quantity: 1, requiresVariantSelection: true },
  ]);

  // ── Fabulous Deals ──
  addDeal('Fabulous Deal 1', 500,
    '1 Small Pizza, 1 Drink 345ml', [
    { menuItemId: ID_DEAL_PIZZA_S, quantity: 1 },
    { menuItemId: ID_DRINK_345, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Fabulous Deal 2', 1090,
    '1 Regular Pizza, 500ml Drink', [
    { menuItemId: ID_DEAL_PIZZA_R, quantity: 1 },
    { menuItemId: ID_DRINK_500, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Fabulous Deal 3', 1650,
    '1 Large Pizza, 1 Litre Drink', [
    { menuItemId: ID_DEAL_PIZZA_L, quantity: 1 },
    { menuItemId: ID_DRINK_1L, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Fabulous Deal 4', 2260,
    '1 Party Pizza, 1.5 Litre Drink', [
    { menuItemId: ID_DEAL_PIZZA_P, quantity: 1 },
    { menuItemId: ID_DRINK_1_5L, quantity: 1, requiresVariantSelection: true },
  ]);

  // ── Bumper Offers ──
  addDeal('Bumper Deal 1', 990,
    '2 Small Pizzas, 1 345ml Drink', [
    { menuItemId: ID_DEAL_PIZZA_S, quantity: 2 },
    { menuItemId: ID_DRINK_345, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Bumper Deal 2', 1960,
    '2 Regular Pizzas, 1 Litre Drink', [
    { menuItemId: ID_DEAL_PIZZA_R, quantity: 2 },
    { menuItemId: ID_DRINK_1L, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Bumper Deal 3', 2850,
    '2 Large Pizzas, 1 Litre Drink', [
    { menuItemId: ID_DEAL_PIZZA_L, quantity: 2 },
    { menuItemId: ID_DRINK_1L, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Bumper Deal 4', 3860,
    '2 Party Pizzas, 1.5 Litre Drink', [
    { menuItemId: ID_DEAL_PIZZA_P, quantity: 2 },
    { menuItemId: ID_DRINK_1_5L, quantity: 1, requiresVariantSelection: true },
  ]);

  // ── Crispo Deals ──
  addDeal('Crispo Deal 1', 650,
    '10 Hot Wings, 1 350ml Drink', [
    { menuItemId: ID_HOT_WING, quantity: 10 },
    { menuItemId: ID_DRINK_345, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Crispo Deal 2', 580,
    '2 Chicken Pcs, 1 Regular Fries, 1 Dip Sauce', [
    { menuItemId: ID_CHICKEN_PC, quantity: 2 },
    { menuItemId: ID_REG_FRIES, quantity: 1 },
    { menuItemId: ID_DIP_SAUCE, quantity: 1 },
  ]);

  addDeal('Crispo Deal 3', 580,
    '3 Chicken Pcs', [
    { menuItemId: ID_CHICKEN_PC, quantity: 3 },
  ]);

  addDeal('Crispo Deal 4', 830,
    '3 Chicken Pcs, 1 Regular Fries, 1 345ml Drink', [
    { menuItemId: ID_CHICKEN_PC, quantity: 3 },
    { menuItemId: ID_REG_FRIES, quantity: 1 },
    { menuItemId: ID_DRINK_345, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Crispo Deal 5', 990,
    '4 Chicken Pcs, 1 500ml Drink', [
    { menuItemId: ID_CHICKEN_PC, quantity: 4 },
    { menuItemId: ID_DRINK_500, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Crispo Deal 6', 1370,
    '5 Chicken Pcs, 1 Dip Sauce, 1 Large Fries, 1 500ml Drink', [
    { menuItemId: ID_CHICKEN_PC, quantity: 5 },
    { menuItemId: ID_DIP_SAUCE, quantity: 1 },
    { menuItemId: ID_LRG_FRIES, quantity: 1 },
    { menuItemId: ID_DRINK_500, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Crispo Deal 7', 1830,
    '9 Pcs Bucket', [
    { menuItemId: ID_CHICKEN_PC, quantity: 9 },
  ]);

  addDeal('Crispo Deal 8', 1990,
    '9 Pcs Bucket, 1 Regular Fries, 1.5 Litre Drink', [
    { menuItemId: ID_CHICKEN_PC, quantity: 9 },
    { menuItemId: ID_REG_FRIES, quantity: 1 },
    { menuItemId: ID_DRINK_1_5L, quantity: 1, requiresVariantSelection: true },
  ]);

  // ── Midnight Deals ──
  addDeal('Midnight Deal 1', 1750,
    '2 Zinger Burgers, 1 Regular Pizza, 1 Dip Sauce, 1 Litre Drink', [
    { menuItemId: ID_ZINGER, quantity: 2 },
    { menuItemId: ID_DEAL_PIZZA_R, quantity: 1 },
    { menuItemId: ID_DIP_SAUCE, quantity: 1 },
    { menuItemId: ID_DRINK_1L, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Midnight Deal 2', 1920,
    '2 Small Pizzas, 1 Chicken Crunchy Pasta, 1 Regular Fries, 1 Dip Sauce, 1 Litre Drink', [
    { menuItemId: ID_DEAL_PIZZA_S, quantity: 2 },
    { menuItemId: ID_CRUNCHY_PASTA, quantity: 1 },
    { menuItemId: ID_REG_FRIES, quantity: 1 },
    { menuItemId: ID_DIP_SAUCE, quantity: 1 },
    { menuItemId: ID_DRINK_1L, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Midnight Deal 3', 2100,
    '1 Crown Crust Large, 10 Hot Wings, 1 Regular Fries, 1 Dip Sauce, 1 Litre Drink', [
    { menuItemId: ID_CROWN_L, quantity: 1, requiresVariantSelection: true },
    { menuItemId: ID_HOT_WING, quantity: 10 },
    { menuItemId: ID_REG_FRIES, quantity: 1 },
    { menuItemId: ID_DIP_SAUCE, quantity: 1 },
    { menuItemId: ID_DRINK_1L, quantity: 1, requiresVariantSelection: true },
  ]);

  addDeal('Midnight Deal 4', 2990,
    '1 Crown Crust Party, 1 Chicken Crunchy Pasta, 1 Regular Fries, 1 Litre Drink', [
    { menuItemId: ID_CROWN_P, quantity: 1, requiresVariantSelection: true },
    { menuItemId: ID_CRUNCHY_PASTA, quantity: 1 },
    { menuItemId: ID_REG_FRIES, quantity: 1 },
    { menuItemId: ID_DRINK_1L, quantity: 1, requiresVariantSelection: true },
  ]);

  // ═══════════════════════════════════════════════════════════
  //  DATABASE TRANSACTION — clear & insert
  // ═══════════════════════════════════════════════════════════

  await db.transaction('rw', [
    db.categories, db.menuItems, db.menuItemVariants,
    db.variants, db.variantOptions,
    db.deals, db.dealItems, db.dealVariants,
  ], async () => {
    // Clear existing menu data
    await db.categories.clear();
    await db.menuItems.clear();
    await db.menuItemVariants.clear();
    await db.variants.clear();
    await db.variantOptions.clear();
    await db.deals.clear();
    await db.dealItems.clear();
    await db.dealVariants.clear();

    // Insert all data
    await db.categories.bulkAdd(categories);
    await db.menuItems.bulkAdd(menuItems);
    await db.variants.bulkAdd(variants);
    await db.variantOptions.bulkAdd(variantOptions);
    await db.menuItemVariants.bulkAdd(menuItemVariants);
    await db.deals.bulkAdd(deals);
    await db.dealItems.bulkAdd(dealItems);
  });

  await logAudit({
    userId,
    action: 'import',
    tableName: 'menu',
    recordId: 'seed',
    description: `Seeded Zone Kitchen menu: ${categories.length} categories, ${menuItems.length} items, ${deals.length} deals, ${dealItems.length} deal items`,
  });

  return {
    categories: categories.length,
    menuItems: menuItems.length,
    variants: variants.length,
    variantOptions: variantOptions.length,
    menuItemVariants: menuItemVariants.length,
    deals: deals.length,
    dealItems: dealItems.length,
  };
}
