const Task = require('../models/Task');
const Project = require('../models/Project');

// ─── Helper: Verify user is project member ────────────────────────────────────
const getProjectAndVerifyAccess = async (projectId, userId, userRole) => {
  const project = await Project.findById(projectId);
  if (!project) return { error: 'Project not found.', status: 404 };

  const isMember = project.members.some(
    (m) => m.user.toString() === userId.toString()
  );
  if (!isMember && userRole !== 'admin') {
    return { error: 'You are not a member of this project.', status: 403 };
  }

  return { project };
};

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
const createTask = async (req, res, next) => {
  try {
    const { title, description, projectId, assignedTo, priority, dueDate, tags } = req.body;

    const { project, error, status } = await getProjectAndVerifyAccess(
      projectId,
      req.user._id,
      req.user.role
    );
    if (error) return res.status(status).json({ success: false, message: error });

    // Verify assignee is a project member
    if (assignedTo) {
      const isAssigneeMember = project.members.some(
        (m) => m.user.toString() === assignedTo
      );
      if (!isAssigneeMember) {
        return res.status(400).json({
          success: false,
          message: 'Assignee must be a member of the project.',
        });
      }
    }

    const task = await Task.create({
      title,
      description,
      project: projectId,
      assignedTo: assignedTo || null,
      createdBy: req.user._id,
      priority,
      dueDate,
      tags,
    });

    await task.populate('assignedTo', 'name email avatar');
    await task.populate('createdBy', 'name email avatar');
    await task.populate('project', 'name');

    res.status(201).json({ success: true, task });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
const getTasks = async (req, res, next) => {
  try {
    const {
      projectId,
      status,
      priority,
      assignedTo,
      overdue,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    let filter = {};

    // Admin sees all tasks; member sees tasks in their projects
    if (req.user.role !== 'admin') {
      const userProjects = await Project.find({
        $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
      }).select('_id');
      const projectIds = userProjects.map((p) => p._id);
      filter.project = { $in: projectIds };
    }

    if (projectId) filter.project = projectId;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo === 'me' ? req.user._id : assignedTo;
    if (overdue === 'true') {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $ne: 'completed' };
    }
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate('assignedTo', 'name email avatar')
        .populate('createdBy', 'name email avatar')
        .populate('project', 'name status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Task.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      tasks,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────────
const getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar role')
      .populate('project', 'name status owner members');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    // Check access
    const isMember = task.project.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );
    const isOwner = task.project.owner.toString() === req.user._id.toString();

    if (!isMember && !isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.status(200).json({ success: true, task });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/tasks/:id ───────────────────────────────────────────────────────
const updateTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate('project');
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const isMember = task.project.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );
    if (!isMember && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { title, description, assignedTo, priority, dueDate, tags, status } = req.body;
    const updates = {};
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (priority) updates.priority = priority;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (tags) updates.tags = tags;
    if (status) updates.status = status;

    if (assignedTo !== undefined) {
      if (assignedTo === null) {
        updates.assignedTo = null;
      } else {
        const isAssigneeMember = task.project.members.some(
          (m) => m.user.toString() === assignedTo
        );
        if (!isAssigneeMember) {
          return res.status(400).json({
            success: false,
            message: 'Assignee must be a member of the project.',
          });
        }
        updates.assignedTo = assignedTo;
      }
    }

    // Handle completedAt via pre-save hook
    if (status === 'completed') updates.completedAt = new Date();
    else if (status && status !== 'completed') updates.completedAt = null;

    const updated = await Task.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    })
      .populate('assignedTo', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .populate('project', 'name');

    res.status(200).json({ success: true, task: updated });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/tasks/:id/status ─────────────────────────────────────────────
const updateTaskStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['todo', 'in-progress', 'review', 'completed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const task = await Task.findById(req.params.id).populate('project');
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const isMember = task.project.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );
    const isAssignee =
      task.assignedTo && task.assignedTo.toString() === req.user._id.toString();

    if (!isMember && !isAssignee && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    task.status = status;
    await task.save(); // triggers pre-save for completedAt

    await task.populate('assignedTo', 'name email avatar');
    await task.populate('createdBy', 'name email avatar');
    await task.populate('project', 'name');

    res.status(200).json({ success: true, task });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate('project');
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const isProjectAdmin = task.project.members.some(
      (m) => m.user.toString() === req.user._id.toString() && m.role === 'admin'
    );
    const isOwner = task.project.owner.toString() === req.user._id.toString();
    const isCreator = task.createdBy.toString() === req.user._id.toString();

    if (!isProjectAdmin && !isOwner && !isCreator && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only task creators, project admins, or global admins can delete tasks.',
      });
    }

    await task.deleteOne();
    res.status(200).json({ success: true, message: 'Task deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
};
