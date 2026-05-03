const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');

// ─── Helper: Check if user is project owner or admin ─────────────────────────
const isProjectAdmin = (project, userId) => {
  if (project.owner.toString() === userId.toString()) return true;
  const member = project.members.find(
    (m) => m.user.toString() === userId.toString()
  );
  return member && member.role === 'admin';
};

// ─── POST /api/projects ───────────────────────────────────────────────────────
const createProject = async (req, res, next) => {
  try {
    const { name, description, deadline } = req.body;

    const project = await Project.create({
      name,
      description,
      deadline,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'admin' }],
    });

    await project.populate('owner', 'name email avatar role');
    await project.populate('members.user', 'name email avatar role');

    res.status(201).json({ success: true, project });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/projects ────────────────────────────────────────────────────────
const getProjects = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    // Admin sees all projects; member sees only their own
    let filter = {};
    if (req.user.role !== 'admin') {
      filter = {
        $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
      };
    }

    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [projects, total] = await Promise.all([
      Project.find(filter)
        .populate('owner', 'name email avatar')
        .populate('members.user', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Project.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      projects,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/projects/:id ────────────────────────────────────────────────────
const getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email avatar role')
      .populate('members.user', 'name email avatar role');

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Check access
    const isMember = project.members.some(
      (m) => m.user._id.toString() === req.user._id.toString()
    );
    const isOwner = project.owner._id.toString() === req.user._id.toString();

    if (!isMember && !isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Attach task summary
    const taskStats = await Task.aggregate([
      { $match: { project: project._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const stats = { todo: 0, 'in-progress': 0, review: 0, completed: 0 };
    taskStats.forEach((s) => (stats[s._id] = s.count));

    res.status(200).json({ success: true, project, taskStats: stats });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/projects/:id ────────────────────────────────────────────────────
const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (!isProjectAdmin(project, req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Only project admins can update.' });
    }

    const { name, description, status, deadline } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status) updates.status = status;
    if (deadline !== undefined) updates.deadline = deadline;

    const updated = await Project.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    })
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar');

    res.status(200).json({ success: true, project: updated });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/projects/:id ─────────────────────────────────────────────────
const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const isOwner = project.owner.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the project owner or a global admin can delete this project.',
      });
    }

    // Cascade delete all tasks
    await Task.deleteMany({ project: project._id });
    await project.deleteOne();

    res.status(200).json({ success: true, message: 'Project and all its tasks deleted.' });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/projects/:id/members ──────────────────────────────────────────
const addMember = async (req, res, next) => {
  try {
    const { userId, role = 'member' } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (!isProjectAdmin(project, req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Verify user exists
    const userToAdd = await User.findById(userId);
    if (!userToAdd) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const alreadyMember = project.members.some(
      (m) => m.user.toString() === userId
    );
    if (alreadyMember) {
      return res.status(409).json({ success: false, message: 'User is already a member.' });
    }

    project.members.push({ user: userId, role });
    await project.save();
    await project.populate('members.user', 'name email avatar role');

    res.status(200).json({ success: true, message: 'Member added.', project });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/projects/:id/members/:userId ─────────────────────────────────
const removeMember = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (!isProjectAdmin(project, req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { userId } = req.params;

    if (project.owner.toString() === userId) {
      return res.status(400).json({ success: false, message: 'Cannot remove the project owner.' });
    }

    const memberIndex = project.members.findIndex(
      (m) => m.user.toString() === userId
    );
    if (memberIndex === -1) {
      return res.status(404).json({ success: false, message: 'User is not a member.' });
    }

    project.members.splice(memberIndex, 1);
    await project.save();

    // Unassign tasks in this project assigned to removed user
    await Task.updateMany(
      { project: project._id, assignedTo: userId },
      { assignedTo: null }
    );

    res.status(200).json({ success: true, message: 'Member removed.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
};
