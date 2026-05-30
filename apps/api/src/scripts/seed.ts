import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Customer } from '../models/Customer';
import { Payment } from '../models/Payment';
import { Medicine } from '../models/Medicine';
import { ActivityLog } from '../models/ActivityLog';
import { ensureSettings, Settings } from '../models/Settings';
import { normalizePhone } from '../utils/phone';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pharmacare';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@pharmacare.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
};

const SEED_MEDICINES = [
  { name: 'Paracetamol 500mg', content: 'Acetaminophen', purchasePrice: 18, mrp: 32, discountedPrice: 28, type: 'tab', addedFrom: 'manual' },
  { name: 'Amoxicillin 500mg', content: 'Amoxicillin trihydrate', purchasePrice: 43, mrp: 68, discountedPrice: 62, type: 'cap', addedFrom: 'manual' },
  { name: 'Metformin 500mg', content: 'Metformin HCl', purchasePrice: 24, mrp: 41, discountedPrice: 37, type: 'tab', addedFrom: 'bill' },
  { name: 'Atorvastatin 20mg', content: 'Atorvastatin calcium', purchasePrice: 58, mrp: 96, discountedPrice: 86, type: 'tab', addedFrom: 'manual' },
  { name: 'Cetirizine 10mg', content: 'Cetirizine HCl', purchasePrice: 12, mrp: 22, discountedPrice: 20, type: 'tab', addedFrom: 'manual' },
  { name: 'Pantoprazole 40mg', content: 'Pantoprazole sodium', purchasePrice: 36, mrp: 59, discountedPrice: 53, type: 'cap', addedFrom: 'bill' },
  { name: 'Telmisartan 40mg', content: 'Telmisartan', purchasePrice: 48, mrp: 78, discountedPrice: 70, type: 'tab', addedFrom: 'manual' },
  { name: 'Azithromycin 500mg', content: 'Azithromycin dihydrate', purchasePrice: 65, mrp: 112, discountedPrice: 100, type: 'tab', addedFrom: 'manual' },
  { name: 'Losartan 50mg', content: 'Losartan potassium', purchasePrice: 32, mrp: 54, discountedPrice: 49, type: 'tab', addedFrom: 'manual' },
  { name: 'Glimepiride 2mg', content: 'Glimepiride', purchasePrice: 28, mrp: 46, discountedPrice: 41, type: 'tab', addedFrom: 'bill' },
  { name: 'Vitamin D3 60K IU', content: 'Cholecalciferol', purchasePrice: 22, mrp: 38, discountedPrice: 34, type: 'cap', addedFrom: 'manual' },
  { name: 'Ibuprofen 400mg', content: 'Ibuprofen', purchasePrice: 17, mrp: 28, discountedPrice: 25, type: 'tab', addedFrom: 'manual' },
  { name: 'Omeprazole 20mg', content: 'Omeprazole', purchasePrice: 30, mrp: 49, discountedPrice: 44, type: 'cap', addedFrom: 'manual' },
  { name: 'Levothyroxine 50mcg', content: 'Levothyroxine sodium', purchasePrice: 44, mrp: 72, discountedPrice: 65, type: 'tab', addedFrom: 'bill' },
  { name: 'Amlodipine 5mg', content: 'Amlodipine besylate', purchasePrice: 19, mrp: 33, discountedPrice: 30, type: 'tab', addedFrom: 'manual' },
  { name: 'Salbutamol Inhaler', content: 'Salbutamol sulfate', purchasePrice: 86, mrp: 140, discountedPrice: 126, type: 'syrup', addedFrom: 'manual' },
  { name: 'Diclofenac 50mg', content: 'Diclofenac sodium', purchasePrice: 14, mrp: 24, discountedPrice: 22, type: 'tab', addedFrom: 'manual' },
  { name: 'Ranitidine 150mg', content: 'Ranitidine HCl', purchasePrice: 18, mrp: 30, discountedPrice: 27, type: 'tab', addedFrom: 'bill' },
  { name: 'Montelukast 10mg', content: 'Montelukast sodium', purchasePrice: 39, mrp: 64, discountedPrice: 58, type: 'tab', addedFrom: 'manual' },
  { name: 'Insulin Glargine', content: 'Insulin glargine', purchasePrice: 320, mrp: 480, discountedPrice: 432, type: 'syrup', addedFrom: 'manual' },
  { name: 'Clopidogrel 75mg', content: 'Clopidogrel bisulfate', purchasePrice: 52, mrp: 84, discountedPrice: 76, type: 'tab', addedFrom: 'manual' },
  { name: 'ORS Sachet', content: 'Oral rehydration salts', purchasePrice: 7, mrp: 12, discountedPrice: 11, type: 'syrup', addedFrom: 'manual' },
];

const CUSTOMERS = [
  { name: 'Ramesh Kulkarni', phone: '9822041567', altPhone: '9822041568', address: 'Flat 4B, Shanti Apts, FC Road, Pune', notes: 'Prefers morning visits', medicines: ['Metformin 500mg', 'Glimepiride 2mg'], offset: 1 },
  { name: 'Anjali Deshpande', phone: '9890123456', medicines: ['Levothyroxine 50mcg'], offset: 2 },
  { name: 'Mohammed Iqbal', phone: '9764321890', notes: 'Calls before coming', medicines: ['Telmisartan 40mg', 'Atorvastatin 20mg'], offset: 0 },
  { name: 'Sunita Joshi', phone: '9011223344', altPhone: '9011223345', address: 'Kothrud, Pune', medicines: ['Amlodipine 5mg'], offset: 2 },
  { name: 'Vikram Singh', phone: '9700556677', address: 'Hadapsar, Pune', notes: 'Diabetic — insulin user', medicines: ['Insulin Glargine', 'Metformin 500mg'], offset: 1 },
  { name: 'Priya Nair', phone: '9845112233', address: 'Baner, Pune', medicines: ['Cetirizine 10mg', 'Montelukast 10mg'], offset: 7 },
  { name: 'Arjun Pawar', phone: '9923456712', address: 'Shivajinagar, Pune', medicines: ['Pantoprazole 40mg'], offset: 14 },
  { name: 'Rekha Sawant', phone: '9876123450', address: 'Wakad, Pune', notes: 'Senior citizen', medicines: ['Atorvastatin 20mg', 'Clopidogrel 75mg', 'Telmisartan 40mg'], offset: 2 },
  { name: 'Nilesh Mhatre', phone: '9612345670', address: 'Viman Nagar, Pune', medicines: ['Omeprazole 20mg'], offset: 5 },
  { name: 'Kavita Bhosale', phone: '9534567812', altPhone: '9534567813', address: 'Karve Nagar, Pune', medicines: ['Losartan 50mg'], offset: 3 },
  { name: 'Sandeep Khanna', phone: '9445678123', address: 'Pimpri, Pune', notes: 'Pays in cash monthly', medicines: ['Pantoprazole 40mg', 'Vitamin D3 60K IU'], offset: 10 },
  { name: 'Meera Iyer', phone: '9356789234', address: 'Koregaon Park, Pune', medicines: ['Salbutamol Inhaler'], offset: 21 },
  { name: 'Rajesh Gawde', phone: '9267890345', address: 'Yerwada, Pune', medicines: ['Amoxicillin 500mg'], offset: 4 },
  { name: 'Lata More', phone: '9178901456', address: 'Sinhagad Road, Pune', medicines: ['Diclofenac 50mg', 'Ranitidine 150mg'], offset: -1 },
  { name: 'Harshada Patil', phone: '9089012567', address: 'Magarpatta, Pune', medicines: ['Vitamin D3 60K IU'], offset: 30 },
  { name: 'Yusuf Sheikh', phone: '9991234567', address: 'Kondhwa, Pune', medicines: ['Glimepiride 2mg', 'Metformin 500mg'], offset: 1 },
  { name: 'Pooja Agarwal', phone: '9882345678', address: 'NIBM Road, Pune', medicines: ['Levothyroxine 50mcg'], offset: 6 },
  { name: 'Deepak Rao', phone: '9773456789', address: 'Hinjewadi, Pune', medicines: ['Amlodipine 5mg', 'Atorvastatin 20mg'], offset: 8 },
  { name: 'Smita Kale', phone: '9664567890', address: 'Bavdhan, Pune', medicines: ['Cetirizine 10mg'], offset: 45 },
  { name: 'Anand Bhide', phone: '9555678901', address: 'Erandwane, Pune', medicines: ['Telmisartan 40mg'], offset: 2 },
];

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== 'true') {
    console.warn('Refusing to seed in production. Set SEED_FORCE=true to override.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('[seed] connected to', MONGO_URI);

  await Promise.all([
    User.deleteMany({}),
    Customer.deleteMany({}),
    Payment.deleteMany({}),
    Medicine.deleteMany({}),
    ActivityLog.deleteMany({}),
    Settings.deleteMany({}),
  ]);
  console.log('[seed] cleared collections');

  await ensureSettings();

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await User.create({
    name: 'Aditi Sharma',
    email: ADMIN_EMAIL.toLowerCase(),
    phone: normalizePhone('9823100001'),
    passwordHash: adminHash,
    role: 'admin',
    status: 'active',
    lastActive: new Date(),
  });

  const employeeHash = await bcrypt.hash('changeme123', 10);
  const employees = await User.insertMany([
    { name: 'Rohan Mehta', email: 'rohan@pharmacare.local', phone: normalizePhone('9823100002'), passwordHash: employeeHash, role: 'employee', status: 'active' },
    { name: 'Sneha Pillai', email: 'sneha@pharmacare.local', phone: normalizePhone('9823100003'), passwordHash: employeeHash, role: 'employee', status: 'active' },
    { name: 'Karthik Nayak', email: 'karthik@pharmacare.local', phone: normalizePhone('9823100004'), passwordHash: employeeHash, role: 'employee', status: 'active' },
    { name: 'Pranav Joshi', email: 'pranav@pharmacare.local', phone: normalizePhone('9823100005'), passwordHash: employeeHash, role: 'employee', status: 'pending' },
    { name: 'Neha Kulkarni', email: 'neha.k@pharmacare.local', phone: normalizePhone('9823100006'), passwordHash: employeeHash, role: 'employee', status: 'pending' },
    { name: 'Ishita Bose', email: 'ishita@pharmacare.local', phone: normalizePhone('9823100007'), passwordHash: employeeHash, role: 'employee', status: 'pending' },
  ]);

  await Medicine.insertMany(SEED_MEDICINES);

  const customerDocs = await Customer.insertMany(
    CUSTOMERS.map(c => ({
      name: c.name,
      phone: normalizePhone(c.phone),
      altPhone: c.altPhone ? normalizePhone(c.altPhone) : undefined,
      address: c.address,
      notes: c.notes,
      medicines: c.medicines.map(m => ({ medicineName: m })),
      nextDueDate: day(c.offset),
      createdBy: admin._id,
    }))
  );

  const findCustomer = (name: string) => customerDocs.find(c => c.name === name)!;

  const payments = [
    { customerName: 'Ramesh Kulkarni', amount: 1240, type: 'received' as const, notes: 'Feb medicines paid in full', offset: -3 },
    { customerName: 'Ramesh Kulkarni', amount: 480, type: 'received' as const, offset: -32 },
    { customerName: 'Ramesh Kulkarni', amount: 200, type: 'given' as const, notes: 'Refund for damaged strip', offset: -45 },
    { customerName: 'Mohammed Iqbal', amount: 2150, type: 'received' as const, notes: 'Monthly settlement', offset: -7 },
    { customerName: 'Vikram Singh', amount: 4800, type: 'received' as const, notes: 'Insulin + tablets — March', offset: -2 },
    { customerName: 'Vikram Singh', amount: 4650, type: 'received' as const, notes: 'Insulin + tablets — Feb', offset: -31 },
    { customerName: 'Rekha Sawant', amount: 1820, type: 'received' as const, offset: -5 },
    { customerName: 'Rekha Sawant', amount: 500, type: 'given' as const, notes: 'Advance returned', offset: -12 },
    { customerName: 'Sandeep Khanna', amount: 960, type: 'received' as const, notes: 'Cash', offset: -1 },
    { customerName: 'Lata More', amount: 340, type: 'received' as const, offset: -9 },
    { customerName: 'Yusuf Sheikh', amount: 1080, type: 'received' as const, offset: -4 },
    { customerName: 'Deepak Rao', amount: 720, type: 'received' as const, offset: -6 },
    { customerName: 'Anand Bhide', amount: 540, type: 'received' as const, offset: -8 },
    { customerName: 'Anjali Deshpande', amount: 380, type: 'received' as const, offset: -14 },
    { customerName: 'Kavita Bhosale', amount: 620, type: 'received' as const, offset: -2 },
  ];

  await Payment.insertMany(
    payments.map(p => ({
      customerId: findCustomer(p.customerName)._id,
      type: p.type,
      amount: p.amount,
      date: day(p.offset),
      notes: p.notes,
      recordedBy: admin._id,
    }))
  );

  console.log(`[seed] Done.`);
  console.log(`[seed] Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`[seed] ${employees.length} employees, ${customerDocs.length} customers, ${SEED_MEDICINES.length} medicines, ${payments.length} payments`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
