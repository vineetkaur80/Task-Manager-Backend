# Task Manager Backend

A simple Express.js backend for managing tasks with MongoDB.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas account)

## Setup

1. **Install MongoDB** (if using local):
   - Download and install MongoDB Community Server from [mongodb.com](https://www.mongodb.com/try/download/community)
   - Start MongoDB service

   Or use **MongoDB Atlas** (cloud):
   - Create account at [mongodb.com/atlas](https://www.mongodb.com/atlas)
   - Create a cluster and get connection string

2. **Clone and install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   - Update `.env` file with your MongoDB connection string:
     ```
     MONGODB_URI=mongodb://localhost:27017/taskmanager
     # or for Atlas: mongodb+srv://username:password@cluster.mongodb.net/taskmanager
     ```

4. **Start the server**:
   ```bash
   npm start
   ```

   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

The server will run on http://localhost:3000 by default.

## API Endpoints

### Tasks

- `GET /tasks` - Get all tasks
- `GET /tasks/:id` - Get a specific task by ID
- `POST /tasks` - Create a new task
- `PUT /tasks/:id` - Update a task by ID
- `DELETE /tasks/:id` - Delete a task by ID

### Task Object

```json
{
  "_id": "60d5ecb74bb2c72b8c8b4567",
  "title": "Sample Task",
  "description": "Task description",
  "completed": false,
  "createdAt": "2023-05-02T10:00:00.000Z",
  "updatedAt": "2023-05-02T10:00:00.000Z",
  "__v": 0
}
```

### Create/Update Task Request

```json
{
  "title": "Task Title",
  "description": "Task Description",
  "completed": false
}
```