export const PLANS = {
  PRO: {
    priceId: process.env.STRIPE_PRO_PRICE_ID || '',
    name: 'Clerva Pro',
    price: 29,
    interval: 'month' as const,
    leadLimit: 500,
    replyLimit: 999999,
  },
  FREE_TRIAL: {
    name: 'Free Trial',
    leadLimit: 25,
    replyLimit: 5,
    trialDays: 7,
  },
} as const
