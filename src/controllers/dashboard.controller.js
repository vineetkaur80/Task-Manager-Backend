const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');

// ─── GET /api/dashboard ───────────────────────────────────────────────────────
const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin';

    const now = new Date();

    // ── Project scope ──────────────────────────────────────────────────────────
    let projectFilter = {};
    let taskFilter = {};

    if (!isAdmin) {
      const userProjects = await Project.find({
        $or: [{ owner: userId }, { 'members.user': userId }],
      }).select('_id');
      const projectIds = userProjects.map((p) => p._id);
      projectFilter = { _id: { $in: projectIds } };
      taskFilter = { project: { $in: projectIds } };
    }

    // ── Parallel queries ───────────────────────────────────────────────────────
    const [
      totalProjects,
      activeProjects,
      totalTasks,
      tasksByStatus,
      overdueTasks,
      myTasks,
      recentTasks,
      upcomingDeadlines,
      totalUsers,
    ] = await Promise.all([
      // Projects
      Project.countDocuments(projectFilter),
      Project.countDocuments({ ...projectFilter, status: 'active' }),

      // Tasks
      Task.countDocuments(taskFilter),

      // Tasks grouped by status
      Task.aggregate([
        { $match: taskFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Overdue tasks
      Task.countDocuments({
        ...taskFilter,
        dueDate: { $lt: now },
        status: { $ne: 'completed' },
      }),

      // My assigned tasks
      Task.countDocuments({ ...taskFilter, assignedTo: userId }),

      // 5 most recently created tasks
      Task.find(taskFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('assignedTo', 'name avatar')
        .populate('project', 'name'),

      // Tasks due in next 7 days
      Task.find({
        ...taskFilter,
        dueDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        status: { $ne: 'completed' },
      })
        .sort({ dueDate: 1 })
        .limit(10)
        .populate('assignedTo', 'name avatar')
        .populate('project', 'name'),

      // Total users (admin only, others get 0)
      isAdmin ? User.countDocuments({ isActive: true }) : Promise.resolve(0),
    ]);

    // ── Format status breakdown ────────────────────────────────────────────────
    const statusMap = { todo: 0, 'in-progress': 0, review: 0, completed: 0 };
    tasksByStatus.forEach((s) => (statusMap[s._id] = s.count));

    // ── Priority breakdown for non-completed tasks ────────────────────────────
    const priorityBreakdown = await Task.aggregate([
      {
        $match: {
          ...taskFilter,
          status: { $ne: 'completed' },
        },
      },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);
    const priorityMap = { low: 0, medium: 0, high: 0, urgent: 0 };
    priorityBreakdown.forEach((p) => (priorityMap[p._id] = p.count));

    res.status(200).json({
      success: true,
      dashboard: {
        overview: {
          totalProjects,
          activeProjects,
          totalTasks,
          completedTasks: statusMap['completed'],
          overdueTasks,
          myAssignedTasks: myTasks,
          ...(isAdmin && { totalUsers }),
        },
        tasksByStatus: statusMap,
        tasksByPriority: priorityMap,
        recentTasks,
        upcomingDeadlines,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard };
