// data.jsx — seed data for the PharmaCare prototype

const SEED_MEDICINES = [
  { id: 'm1',  name: 'Paracetamol 500mg',     content: 'Acetaminophen',           purchasePrice: 18.40, mrp: 32.00, type: 'tab', addedFrom: 'manual' },
  { id: 'm2',  name: 'Amoxicillin 500mg',     content: 'Amoxicillin trihydrate',  purchasePrice: 42.50, mrp: 68.00, type: 'cap', addedFrom: 'manual' },
  { id: 'm3',  name: 'Metformin 500mg',       content: 'Metformin HCl',           purchasePrice: 24.10, mrp: 41.20, type: 'tab', addedFrom: 'bill'   },
  { id: 'm4',  name: 'Atorvastatin 20mg',     content: 'Atorvastatin calcium',    purchasePrice: 58.00, mrp: 96.00, type: 'tab', addedFrom: 'manual' },
  { id: 'm5',  name: 'Cetirizine 10mg',       content: 'Cetirizine HCl',          purchasePrice: 12.30, mrp: 22.00, type: 'tab', addedFrom: 'manual' },
  { id: 'm6',  name: 'Pantoprazole 40mg',     content: 'Pantoprazole sodium',     purchasePrice: 36.20, mrp: 58.50, type: 'cap', addedFrom: 'bill'   },
  { id: 'm7',  name: 'Telmisartan 40mg',      content: 'Telmisartan',             purchasePrice: 48.00, mrp: 78.00, type: 'tab', addedFrom: 'manual' },
  { id: 'm8',  name: 'Azithromycin 500mg',    content: 'Azithromycin dihydrate',  purchasePrice: 64.50, mrp: 112.00, type: 'tab', addedFrom: 'manual' },
  { id: 'm9',  name: 'Losartan 50mg',         content: 'Losartan potassium',      purchasePrice: 32.00, mrp: 54.00, type: 'tab', addedFrom: 'manual' },
  { id: 'm10', name: 'Glimepiride 2mg',       content: 'Glimepiride',             purchasePrice: 28.40, mrp: 46.00, type: 'tab', addedFrom: 'bill'   },
  { id: 'm11', name: 'Vitamin D3 60K IU',     content: 'Cholecalciferol',         purchasePrice: 22.00, mrp: 38.00, type: 'cap', addedFrom: 'manual' },
  { id: 'm12', name: 'Ibuprofen 400mg',       content: 'Ibuprofen',               purchasePrice: 16.80, mrp: 28.00, type: 'tab', addedFrom: 'manual' },
  { id: 'm13', name: 'Omeprazole 20mg',       content: 'Omeprazole',              purchasePrice: 30.10, mrp: 49.00, type: 'cap', addedFrom: 'manual' },
  { id: 'm14', name: 'Levothyroxine 50mcg',   content: 'Levothyroxine sodium',    purchasePrice: 44.00, mrp: 72.00, type: 'tab', addedFrom: 'bill'   },
  { id: 'm15', name: 'Amlodipine 5mg',        content: 'Amlodipine besylate',     purchasePrice: 19.20, mrp: 33.00, type: 'tab', addedFrom: 'manual' },
  { id: 'm16', name: 'Salbutamol Inhaler',    content: 'Salbutamol sulfate',      purchasePrice: 86.00, mrp: 140.00, type: 'syrup', addedFrom: 'manual' },
  { id: 'm17', name: 'Diclofenac 50mg',       content: 'Diclofenac sodium',       purchasePrice: 14.40, mrp: 24.00, type: 'tab', addedFrom: 'manual' },
  { id: 'm18', name: 'Ranitidine 150mg',      content: 'Ranitidine HCl',          purchasePrice: 17.60, mrp: 30.00, type: 'tab', addedFrom: 'bill'   },
  { id: 'm19', name: 'Montelukast 10mg',      content: 'Montelukast sodium',      purchasePrice: 38.50, mrp: 64.00, type: 'tab', addedFrom: 'manual' },
  { id: 'm20', name: 'Insulin Glargine',      content: 'Insulin glargine',        purchasePrice: 320.00, mrp: 480.00, type: 'syrup', addedFrom: 'manual' },
  { id: 'm21', name: 'Clopidogrel 75mg',      content: 'Clopidogrel bisulfate',   purchasePrice: 52.00, mrp: 84.00, type: 'tab', addedFrom: 'manual' },
  { id: 'm22', name: 'ORS Sachet',            content: 'Oral rehydration salts',  purchasePrice:  6.50, mrp: 12.00, type: 'syrup', addedFrom: 'manual' },
];

// Date helpers (relative to today so the prototype always feels live)
const today = new Date();
const day = (offset) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const SEED_CUSTOMERS = [
  { id: 'c1',  name: 'Ramesh Kulkarni',   phone: '9822041567', altPhone: '9822041568', address: 'Flat 4B, Shanti Apts, FC Road, Pune', notes: 'Prefers morning visits', isActive: true,
    medicines: [{ medicineName: 'Metformin 500mg' }, { medicineName: 'Glimepiride 2mg' }], nextDueDate: day(1) },
  { id: 'c2',  name: 'Anjali Deshpande',  phone: '9890123456', altPhone: '', address: 'Bungalow 12, Aundh, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Levothyroxine 50mcg' }], nextDueDate: day(2) },
  { id: 'c3',  name: 'Mohammed Iqbal',    phone: '9764321890', altPhone: '', address: 'Camp Area, Pune', notes: 'Calls before coming', isActive: true,
    medicines: [{ medicineName: 'Telmisartan 40mg' }, { medicineName: 'Atorvastatin 20mg' }], nextDueDate: day(0) },
  { id: 'c4',  name: 'Sunita Joshi',      phone: '9011223344', altPhone: '9011223345', address: 'Kothrud, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Amlodipine 5mg' }], nextDueDate: day(2) },
  { id: 'c5',  name: 'Vikram Singh',      phone: '9700556677', altPhone: '', address: 'Hadapsar, Pune', notes: 'Diabetic — insulin user', isActive: true,
    medicines: [{ medicineName: 'Insulin Glargine' }, { medicineName: 'Metformin 500mg' }], nextDueDate: day(1) },
  { id: 'c6',  name: 'Priya Nair',        phone: '9845112233', altPhone: '', address: 'Baner, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Cetirizine 10mg' }, { medicineName: 'Montelukast 10mg' }], nextDueDate: day(7) },
  { id: 'c7',  name: 'Arjun Pawar',       phone: '9923456712', altPhone: '', address: 'Shivajinagar, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Pantoprazole 40mg' }], nextDueDate: day(14) },
  { id: 'c8',  name: 'Rekha Sawant',      phone: '9876123450', altPhone: '', address: 'Wakad, Pune', notes: 'Senior citizen', isActive: true,
    medicines: [{ medicineName: 'Atorvastatin 20mg' }, { medicineName: 'Clopidogrel 75mg' }, { medicineName: 'Telmisartan 40mg' }], nextDueDate: day(2) },
  { id: 'c9',  name: 'Nilesh Mhatre',     phone: '9612345670', altPhone: '', address: 'Viman Nagar, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Omeprazole 20mg' }], nextDueDate: day(5) },
  { id: 'c10', name: 'Kavita Bhosale',    phone: '9534567812', altPhone: '9534567813', address: 'Karve Nagar, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Losartan 50mg' }], nextDueDate: day(3) },
  { id: 'c11', name: 'Sandeep Khanna',    phone: '9445678123', altPhone: '', address: 'Pimpri, Pune', notes: 'Pays in cash monthly', isActive: true,
    medicines: [{ medicineName: 'Pantoprazole 40mg' }, { medicineName: 'Vitamin D3 60K IU' }], nextDueDate: day(10) },
  { id: 'c12', name: 'Meera Iyer',        phone: '9356789234', altPhone: '', address: 'Koregaon Park, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Salbutamol Inhaler' }], nextDueDate: day(21) },
  { id: 'c13', name: 'Rajesh Gawde',      phone: '9267890345', altPhone: '', address: 'Yerwada, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Amoxicillin 500mg' }], nextDueDate: day(4) },
  { id: 'c14', name: 'Lata More',         phone: '9178901456', altPhone: '', address: 'Sinhagad Road, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Diclofenac 50mg' }, { medicineName: 'Ranitidine 150mg' }], nextDueDate: day(2) },
  { id: 'c15', name: 'Harshada Patil',    phone: '9089012567', altPhone: '', address: 'Magarpatta, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Vitamin D3 60K IU' }], nextDueDate: day(30) },
  { id: 'c16', name: 'Yusuf Sheikh',      phone: '9991234567', altPhone: '', address: 'Kondhwa, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Glimepiride 2mg' }, { medicineName: 'Metformin 500mg' }], nextDueDate: day(1) },
  { id: 'c17', name: 'Pooja Agarwal',     phone: '9882345678', altPhone: '', address: 'NIBM Road, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Levothyroxine 50mcg' }], nextDueDate: day(6) },
  { id: 'c18', name: 'Deepak Rao',        phone: '9773456789', altPhone: '', address: 'Hinjewadi, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Amlodipine 5mg' }, { medicineName: 'Atorvastatin 20mg' }], nextDueDate: day(8) },
  { id: 'c19', name: 'Smita Kale',        phone: '9664567890', altPhone: '', address: 'Bavdhan, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Cetirizine 10mg' }], nextDueDate: day(45) },
  { id: 'c20', name: 'Anand Bhide',       phone: '9555678901', altPhone: '', address: 'Erandwane, Pune', notes: '', isActive: true,
    medicines: [{ medicineName: 'Telmisartan 40mg' }], nextDueDate: day(2) },
];

const SEED_PAYMENTS = [
  { id: 'p1',  customerId: 'c1',  amount: 1240, type: 'received', note: 'Feb medicines paid in full',     date: day(-3) },
  { id: 'p2',  customerId: 'c1',  amount: 480,  type: 'received', note: '',                                date: day(-32) },
  { id: 'p3',  customerId: 'c1',  amount: 200,  type: 'given',    note: 'Refund for damaged strip',        date: day(-45) },
  { id: 'p4',  customerId: 'c3',  amount: 2150, type: 'received', note: 'Monthly settlement',              date: day(-7) },
  { id: 'p5',  customerId: 'c5',  amount: 4800, type: 'received', note: 'Insulin + tablets — March',       date: day(-2) },
  { id: 'p6',  customerId: 'c5',  amount: 4650, type: 'received', note: 'Insulin + tablets — Feb',         date: day(-31) },
  { id: 'p7',  customerId: 'c8',  amount: 1820, type: 'received', note: '',                                date: day(-5) },
  { id: 'p8',  customerId: 'c8',  amount: 500,  type: 'given',    note: 'Advance returned',                date: day(-12) },
  { id: 'p9',  customerId: 'c11', amount: 960,  type: 'received', note: 'Cash',                            date: day(-1) },
  { id: 'p10', customerId: 'c14', amount: 340,  type: 'received', note: '',                                date: day(-9) },
  { id: 'p11', customerId: 'c16', amount: 1080, type: 'received', note: '',                                date: day(-4) },
  { id: 'p12', customerId: 'c18', amount: 720,  type: 'received', note: '',                                date: day(-6) },
  { id: 'p13', customerId: 'c20', amount: 540,  type: 'received', note: '',                                date: day(-8) },
  { id: 'p14', customerId: 'c2',  amount: 380,  type: 'received', note: '',                                date: day(-14) },
  { id: 'p15', customerId: 'c10', amount: 620,  type: 'received', note: '',                                date: day(-2) },
];

const SEED_EMPLOYEES = [
  { id: 'e1', name: 'Aditi Sharma',   email: 'aditi@pharmacare.local',   phone: '9823100001', role: 'admin',    isApproved: true,  createdAt: day(-180) },
  { id: 'e2', name: 'Rohan Mehta',    email: 'rohan@pharmacare.local',   phone: '9823100002', role: 'employee', isApproved: true,  createdAt: day(-92)  },
  { id: 'e3', name: 'Sneha Pillai',   email: 'sneha@pharmacare.local',   phone: '9823100003', role: 'employee', isApproved: true,  createdAt: day(-45)  },
  { id: 'e4', name: 'Karthik Nayak',  email: 'karthik@pharmacare.local', phone: '9823100004', role: 'employee', isApproved: true,  createdAt: day(-21)  },
  { id: 'e5', name: 'Pranav Joshi',   email: 'pranav@pharmacare.local',  phone: '9823100005', role: 'employee', isApproved: false, createdAt: day(-2)   },
  { id: 'e6', name: 'Neha Kulkarni',  email: 'neha.k@pharmacare.local',  phone: '9823100006', role: 'employee', isApproved: false, createdAt: day(-1)   },
  { id: 'e7', name: 'Ishita Bose',    email: 'ishita@pharmacare.local',  phone: '9823100007', role: 'employee', isApproved: false, createdAt: day(0)    },
];

Object.assign(window, { SEED_MEDICINES, SEED_CUSTOMERS, SEED_PAYMENTS, SEED_EMPLOYEES });
