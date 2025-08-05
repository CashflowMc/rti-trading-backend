// Add this section to your server.js file after the schemas and before the routes

// Subscription Plans Schema
const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  tier: { type: String, required: true },
  priceId: { type: String, required: true },
  price: { type: Number, required: true },
  interval: { type: String, required: true }, // 'week' or 'month'
  features: [String],
  isActive: { type: Boolean, default: true }
});

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

// Initialize subscription plans data
const initializeSubscriptionPlans = async () => {
  try {
    const existingPlans = await SubscriptionPlan.countDocuments();
    if (existingPlans === 0) {
      const plans = [
        {
          name: 'Weekly Access',
          tier: 'WEEKLY',
          priceId: 'price_weekly_placeholder', // Replace with your actual Stripe Price ID
          price: 6,
          interval: 'week',
          features: [
            'Full group access',
            'Custom charts & analysis',
            'Unlimited live alerts',
            'Live news feed',
            'Real-time market data',
            'Direct trader access'
          ]
        },
        {
          name: 'Monthly Access',
          tier: 'MONTHLY',
          priceId: 'price_monthly_placeholder', // Replace with your actual Stripe Price ID
          price: 20,
          interval: 'month',
          features: [
            'Full group access',
            'Custom charts & analysis',
            'Unlimited live alerts',
            'Live news feed',
            'Real-time market data',
            'Direct trader access',
            'Save $4/month vs weekly'
          ]
        }
      ];
      
      await SubscriptionPlan.insertMany(plans);
      console.log('📦 Subscription plans initialized');
    }
  } catch (error) {
    console.error('Error initializing subscription plans:', error);
  }
};

// Add this route for getting subscription plans
app.get('/api/subscription/plans', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    res.json(plans);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ error: 'Error fetching subscription plans' });
  }
});

// Call this function in your startServer function
// Add this line to your startServer function after createAdminUser():
// await initializeSubscriptionPlans();
