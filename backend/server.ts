import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'your-secret-key-change-in-production';
const MONGODB_URI = 'mongodb://localhost:27017/hypergig';

// MongoDB Connection
mongoose.connect(MONGODB_URI).then(() => {
  console.log('✅ MongoDB connected');
}).catch(err => console.error('❌ MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  kycId: { type: String, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Income Schema
const incomeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  source: { type: String, required: true },
  amount: { type: Number, required: true },
  month: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const Income = mongoose.model('Income', incomeSchema);

// Expense Schema
const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  month: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const Expense = mongoose.model('Expense', expenseSchema);

// Loan Application Schema
const loanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'pending' },
  appliedAt: { type: Date, default: Date.now }
});

const Loan = mongoose.model('Loan', loanSchema);

// Settings Schema
const settingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  notifications: { type: Boolean, default: true },
  autoTaxCalculation: { type: Boolean, default: true },
  currency: { type: String, default: 'INR' },
  language: { type: String, default: 'en' }
});

const Settings = mongoose.model('Settings', settingsSchema);

// Middleware to verify JWT
const authenticateToken = (req: any, res: Response, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Auth Routes
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, mobile, kycId, password } = req.body;

    const existingUser = await User.findOne({ mobile });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password || 'demo123', 10);
    const user = new User({ name, mobile, kycId, password: hashedPassword });
    await user.save();

    // Create default settings
    await Settings.create({ userId: user._id });

    const token = jwt.sign({ userId: user._id, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user._id, name: user.name, mobile: user.mobile } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { mobile, kycId } = req.body;

    const user = await User.findOne({ mobile, kycId });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user._id, name: user.name, mobile: user.mobile } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Income Routes
app.get('/api/incomes', authenticateToken, async (req: any, res: Response) => {
  try {
    const incomes = await Income.find({ userId: req.user.userId });
    res.json(incomes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/incomes', authenticateToken, async (req: any, res: Response) => {
  try {
    const income = new Income({ ...req.body, userId: req.user.userId });
    await income.save();
    res.json(income);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Expense Routes
app.get('/api/expenses', authenticateToken, async (req: any, res: Response) => {
  try {
    const expenses = await Expense.find({ userId: req.user.userId });
    res.json(expenses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/expenses', authenticateToken, async (req: any, res: Response) => {
  try {
    const expense = new Expense({ ...req.body, userId: req.user.userId });
    await expense.save();
    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Loan Routes
app.get('/api/loans', authenticateToken, async (req: any, res: Response) => {
  try {
    const loans = await Loan.find({ userId: req.user.userId });
    res.json(loans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/loans', authenticateToken, async (req: any, res: Response) => {
  try {
    const loan = new Loan({ ...req.body, userId: req.user.userId });
    await loan.save();
    res.json(loan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Settings Routes
app.get('/api/settings', authenticateToken, async (req: any, res: Response) => {
  try {
    let settings = await Settings.findOne({ userId: req.user.userId });
    if (!settings) {
      settings = await Settings.create({ userId: req.user.userId });
    }
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings', authenticateToken, async (req: any, res: Response) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { userId: req.user.userId },
      req.body,
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Risk Scoring Endpoint (using your algorithm)
app.post('/api/risk-score', authenticateToken, async (req: any, res: Response) => {
  try {
    const { payments, wallet, tasks, delays, taxProfile, insuranceProfile } = req.body;
    
    // Import and use your scoring logic
    const profile = buildGigProfile({
      payments,
      wallet,
      tasks,
      delays,
      taxProfile,
      insuranceProfile
    });
    
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Seed dummy data
app.post('/api/seed', async (req: Request, res: Response) => {
  try {
    // Create demo user
    const hashedPassword = await bcrypt.hash('demo123', 10);
    const user = await User.create({
      name: 'Alex Kumar',
      mobile: '9876543210',
      kycId: 'ABCD1234E',
      password: hashedPassword
    });

    // Seed incomes
    const incomes = [
      { source: 'Zomato', month: 'Jan', amount: 18000 },
      { source: 'Swiggy', month: 'Jan', amount: 15000 },
      { source: 'Uber', month: 'Jan', amount: 12000 },
      { source: 'Rapido', month: 'Jan', amount: 8000 },
      { source: 'Zomato', month: 'Feb', amount: 19000 },
      { source: 'Swiggy', month: 'Feb', amount: 16000 },
      { source: 'Uber', month: 'Feb', amount: 11000 },
      { source: 'Rapido', month: 'Feb', amount: 7000 },
      { source: 'Zomato', month: 'Mar', amount: 20000 },
      { source: 'Swiggy', month: 'Mar', amount: 16500 },
      { source: 'Uber', month: 'Mar', amount: 13000 },
      { source: 'Rapido', month: 'Mar', amount: 9000 },
      { source: 'Zomato', month: 'Apr', amount: 21000 },
      { source: 'Swiggy', month: 'Apr', amount: 17000 },
      { source: 'Uber', month: 'Apr', amount: 12500 },
      { source: 'Rapido', month: 'Apr', amount: 9500 },
      { source: 'Zomato', month: 'May', amount: 21500 },
      { source: 'Swiggy', month: 'May', amount: 18000 },
      { source: 'Uber', month: 'May', amount: 14000 },
      { source: 'Rapido', month: 'May', amount: 10000 },
      { source: 'Zomato', month: 'Jun', amount: 22000 },
      { source: 'Swiggy', month: 'Jun', amount: 18200 },
      { source: 'Uber', month: 'Jun', amount: 14500 },
      { source: 'Rapido', month: 'Jun', amount: 10200 }
    ];

    for (const inc of incomes) {
      await Income.create({ ...inc, userId: user._id });
    }

    // Seed expenses
    const expenses = [
      { category: 'Fuel', month: 'Jun', amount: 6000 },
      { category: 'Food', month: 'Jun', amount: 3500 },
      { category: 'Health', month: 'Jun', amount: 1200 },
      { category: 'EMI', month: 'Jun', amount: 4500 },
      { category: 'Maintenance', month: 'Jun', amount: 800 }
    ];

    for (const exp of expenses) {
      await Expense.create({ ...exp, userId: user._id });
    }

    // Create default settings
    await Settings.create({ userId: user._id });

    res.json({ message: 'Dummy data seeded successfully', userId: user._id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions from your gigScoring.ts
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function buildFeatures(payments: any[], wallet: any, tasks: any) {
  if (payments.length === 0) {
    return { avgMonthlyIncome: 0, incomeVolatility: 0, taskReliability: 0, savingsBuffer: 0 };
  }

  const monthTotals: Record<string, number> = {};
  for (const p of payments) {
    const d = new Date(p.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthTotals[key] = (monthTotals[key] || 0) + p.amount;
  }
  
  const monthlyAmounts = Object.values(monthTotals);
  const avgMonthlyIncome = mean(monthlyAmounts);
  const incomeStd = stdDev(monthlyAmounts);
  const incomeVolatility = avgMonthlyIncome > 0 ? incomeStd / avgMonthlyIncome : 0;
  const taskReliability = tasks.acceptedTasks > 0 ? clamp(tasks.completedTasks / tasks.acceptedTasks, 0, 1) : 0;
  const savingsBuffer = wallet.monthlyExpenses > 0 ? wallet.balance / wallet.monthlyExpenses : 0;

  return { avgMonthlyIncome, incomeVolatility, taskReliability, savingsBuffer };
}

function buildGigProfile(params: any) {
  const features = buildFeatures(params.payments, params.wallet, params.tasks);
  
  // Simplified risk calculation
  const pDefault = 0.15; // placeholder
  const normalizedScore100 = 75; // placeholder
  const finalScore100 = 75;
  const riskBand = finalScore100 >= 80 ? 'LOW' : finalScore100 >= 55 ? 'MEDIUM' : 'HIGH';
  
  return {
    features,
    risk: {
      defaultProbability: pDefault,
      baseScoreRaw: 750,
      normalizedScore100,
      finalScore100,
      riskBand,
      incomeStabilityIndex: 78
    },
    loanOffers: [],
    tax: { estimatedTax: 28000, effectiveRate: 0.08, slabNote: 'Simplified' },
    insurance: { recommendedTotalCover: 5000000, suggestions: [] }
  };
}

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
