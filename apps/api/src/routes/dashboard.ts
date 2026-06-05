import { Router } from 'express';
import { modelsFor } from '../db/models';
import { ah } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { reminderWindow, startOfMonth } from '../utils/dateWindow';

const router = Router();
router.use(requireAuth);

router.get(
  '/summary',
  ah(async (req, res) => {
    const { Customer, Payment, User, Medicine } = modelsFor(req);
    const now = new Date();
    const { from, to } = reminderWindow(now);
    const monthStart = startOfMonth(now);
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const endOfDay2 = new Date(startOfToday); endOfDay2.setDate(endOfDay2.getDate() + 2); endOfDay2.setHours(23, 59, 59, 999);

    const [totalCustomers, remindersDue, totalMedicines, addedFromBill, dueToday, due2Days] =
      await Promise.all([
        Customer.countDocuments({ isActive: true }),
        Customer.countDocuments({
          isActive: true,
          reminderIgnored: false,
          nextDueDate: { $gte: from, $lte: to },
        }),
        Medicine.countDocuments({}),
        Medicine.countDocuments({ addedFrom: 'bill' }),
        Customer.countDocuments({
          isActive: true,
          nextDueDate: { $gte: startOfToday, $lt: new Date(startOfToday.getTime() + 86400000) },
        }),
        Customer.countDocuments({
          isActive: true,
          nextDueDate: { $gte: startOfToday, $lte: endOfDay2 },
        }),
      ]);

    const monthAgg = await Payment.aggregate([
      { $match: { date: { $gte: monthStart } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    let moneyReceivedThisMonth = 0;
    let moneyGivenThisMonth = 0;
    for (const r of monthAgg) {
      if (r._id === 'received') moneyReceivedThisMonth = r.total;
      if (r._id === 'given') moneyGivenThisMonth = r.total;
    }

    const remindersPreview = await Customer.find({
      isActive: true,
      reminderIgnored: false,
      nextDueDate: { $gte: from, $lte: to },
    })
      .sort({ nextDueDate: 1 })
      .limit(5)
      .lean();

    const recentPayments = await Payment.find({})
      .sort({ date: -1 })
      .limit(6)
      .populate('customerId', 'name')
      .lean();

    let pendingEmployeeRequests: any[] = [];
    if (req.user!.role === 'admin') {
      pendingEmployeeRequests = await User.find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .lean();
    }

    res.json({
      data: {
        kpis: {
          totalCustomers,
          remindersDue,
          moneyReceivedThisMonth,
          moneyGivenThisMonth,
          totalMedicines,
          addedFromBill,
          dueToday,
          due2Days,
          pendingEmployees: pendingEmployeeRequests.length,
        },
        remindersPreview,
        recentPayments,
        pendingEmployeeRequests,
      },
    });
  })
);

export default router;
