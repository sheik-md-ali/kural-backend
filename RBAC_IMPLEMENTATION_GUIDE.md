# Role-Based Access Control (RBAC) System - Implementation Guide

## 🎯 Overview

This document provides a comprehensive guide to the Role-Based Access Control (RBAC) system implemented for the election management platform. The system enforces strict role-based permissions for managing users, booths, and booth agents.

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Frontend Components](#frontend-components)
6. [Setup Instructions](#setup-instructions)
7. [Testing Guide](#testing-guide)
8. [Security Features](#security-features)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   L0 Pages   │  │   L1 Pages   │  │   L2 Pages   │     │
│  │  - Users     │  │  - Booths    │  │  - Booths    │     │
│  │  - Booths    │  │  - Agents    │  │  - Agents    │     │
│  │  - Agents    │  │  - Dashboard │  │  - Dashboard │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                          │                                   │
│                    Protected Routes                          │
│                  Role-Based Navigation                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/REST API
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Express)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              RBAC Routes (/api/rbac)                  │  │
│  │  • User Management   • Booth Management               │  │
│  │  • Agent Management  • Dashboard Stats                │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Authentication Middleware                  │  │
│  │  • isAuthenticated   • hasRole                        │  │
│  │  • validateACAccess  • canManage*                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
└────────────────────────────┬───────────────────────────────┘
                             │ MongoDB Driver
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    Database (MongoDB)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    users     │  │    booths    │  │   surveys    │     │
│  │  • Indexed   │  │  • Indexed   │  │  • Indexed   │     │
│  │  • Validated │  │  • Relations │  │  • Relations │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 👥 User Roles & Permissions

### L0 - Super Admin (ACIM - Overall Manager)

**Full System Access:**
- ✅ Create/manage all user types (L1, L2, BoothAgent)
- ✅ Create/manage booths across all constituencies
- ✅ Create/manage booth agents across all constituencies
- ✅ Assign agents to any booth
- ✅ View system-wide statistics
- ✅ No AC restrictions

**Access Level:** Global

### L1 - ACIM (Assembly Constituency In-charge Manager)

**AC-Level Management:**
- ✅ Create/manage booths within assigned AC only
- ✅ Create/manage booth agents within assigned AC
- ✅ Assign agents to booths within assigned AC
- ✅ View AC-specific statistics
- ❌ Cannot create users (must request L0)
- ❌ Cannot access other ACs

**Access Level:** Assembly Constituency (AC)

### L2 - ACI (Assembly Constituency In-charge)

**AC-Level Operations:**
- ✅ Create/manage booths within assigned AC
- ✅ Create/manage booth agents within assigned AC
- ✅ Assign agents to booths within assigned AC
- ✅ View AC-specific statistics
- ❌ Cannot create users
- ❌ Cannot access other ACs

**Access Level:** Assembly Constituency (AC)

### BoothAgent - Field Agent

**Field Operations:**
- ✅ View assigned booth information
- ✅ Submit survey data
- ✅ Update voter information
- ❌ No management privileges

**Access Level:** Assigned Booths

---

## 🗄️ Database Schema

### Users Collection

```javascript
{
  _id: ObjectId,
  name: String,              // Required
  email: String,             // Optional, unique if provided
  phone: String,             // Optional, unique if provided
  passwordHash: String,      // Hashed with bcrypt
  role: String,              // L0, L1, L2, BoothAgent
  assignedAC: Number,        // Required for L1, L2
  aci_name: String,          // AC name for reference
  isActive: Boolean,         // Soft delete flag
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `email` (sparse)
- `phone` (sparse)
- `role + assignedAC` (compound)

### Booths Collection

```javascript
{
  _id: ObjectId,
  boothNumber: Number,       // Required
  boothName: String,         // Required
  boothCode: String,         // Required, unique (e.g., "AC119-B101")
  ac_id: Number,             // Required, indexed
  ac_name: String,           // Required
  address: String,           // Optional
  totalVoters: Number,       // Default: 0
  assignedAgents: [ObjectId], // Array of User references
  primaryAgent: ObjectId,    // Reference to User (primary agent)
  createdBy: ObjectId,       // Reference to User (creator)
  isActive: Boolean,         // Soft delete flag
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `boothCode` (unique)
- `ac_id + boothNumber` (compound)
- `assignedAgents` (array)

---

## 🔌 API Endpoints

Base URL: `http://localhost:4000/api/rbac`

### User Management (L0 Only)

#### GET /users
Get all users with optional filters.

**Query Parameters:**
- `role` - Filter by role (L1, L2, BoothAgent)
- `ac` - Filter by AC number
- `search` - Search by name, email, or phone

**Response:**
```json
{
  "success": true,
  "count": 10,
  "users": [
    {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210",
      "role": "L2",
      "assignedAC": 119,
      "aci_name": "Thondamuthur",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /users
Create a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "secure123",
  "role": "L2",
  "assignedAC": 119,
  "aci_name": "Thondamuthur"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": { ... }
}
```

#### PUT /users/:userId
Update an existing user.

#### DELETE /users/:userId
Soft delete a user (sets `isActive: false`).

---

### Booth Management (L0, L1, L2)

#### GET /booths
Get booths (filtered by AC for L1/L2).

**Query Parameters:**
- `ac` - Filter by AC number
- `search` - Search by booth name or code

**Response:**
```json
{
  "success": true,
  "count": 5,
  "booths": [
    {
      "_id": "...",
      "boothNumber": 101,
      "boothName": "Government School 1",
      "boothCode": "AC119-B101",
      "ac_id": 119,
      "ac_name": "Thondamuthur",
      "totalVoters": 1250,
      "assignedAgents": [
        {
          "_id": "...",
          "name": "Agent 1",
          "phone": "9999999001"
        }
      ],
      "primaryAgent": {
        "_id": "...",
        "name": "Agent 1"
      }
    }
  ]
}
```

#### POST /booths
Create a new booth.

**Request Body:**
```json
{
  "boothNumber": 101,
  "boothName": "Government School 1",
  "boothCode": "AC119-B101",
  "acId": 119,
  "acName": "Thondamuthur",
  "address": "Ward 1, Thondamuthur",
  "totalVoters": 1250
}
```

#### PUT /booths/:boothId
Update booth information.

#### DELETE /booths/:boothId
Soft delete a booth.

---

### Booth Agent Management (L0, L1, L2)

#### GET /booth-agents
Get booth agents (filtered by AC for L1/L2).

**Query Parameters:**
- `ac` - Filter by AC number
- `assigned` - Filter by assignment status (true/false)
- `search` - Search by name or phone

**Response:**
```json
{
  "success": true,
  "count": 5,
  "agents": [
    {
      "_id": "...",
      "name": "Agent 1",
      "phone": "9999999001",
      "role": "BoothAgent",
      "assignedAC": 119
    }
  ]
}
```

#### POST /booth-agents/:boothId/assign
Assign an agent to a booth.

**Request Body:**
```json
{
  "agentId": "agent_id_here",
  "isPrimary": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Agent assigned successfully",
  "booth": { ... }
}
```

#### DELETE /booth-agents/:boothId/unassign/:agentId
Unassign an agent from a booth.

---

### Dashboard Statistics

#### GET /dashboard/stats
Get role-specific dashboard statistics.

**Response (L0):**
```json
{
  "success": true,
  "stats": {
    "totalBooths": 50,
    "totalAgents": 25,
    "assignedAgents": 20,
    "unassignedAgents": 5,
    "totalACIMs": 5,
    "totalACIs": 10,
    "totalUsers": 40
  }
}
```

**Response (L1/L2):**
```json
{
  "success": true,
  "stats": {
    "totalBooths": 10,
    "totalAgents": 5,
    "assignedAgents": 4,
    "unassignedAgents": 1
  }
}
```

---

## 🎨 Frontend Components

### L0 - User Management
**File:** `src/pages/l0/UserManagement.tsx`

**Features:**
- Create L1, L2, and BoothAgent users
- Edit user information
- Delete users (soft delete)
- Filter by role and AC
- Search by name, email, or phone

**Navigation:** Dashboard → User Management

### Shared - Booth & Agent Management
**File:** `src/pages/shared/BoothAgentManagement.tsx`

**Features:**
- Create booths
- Edit booth information
- Delete booths (soft delete)
- Assign agents to booths
- Set primary agent
- Unassign agents
- Filter by AC (automatic for L1/L2)

**Navigation:** 
- L1: Dashboard → Booth Management
- L2: Dashboard → Booth & Agent Management

### Role-Based Navigation
**File:** `src/components/DashboardLayout.tsx`

**Features:**
- Dynamic menu items based on role
- Automatic hiding of unauthorized features
- Role-specific page titles

---

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ..
npm install
```

### 2. Configure Environment

```bash
# Copy environment template
cp server/.env.example server/.env

# Edit .env with your MongoDB URI
# MONGODB_URI=mongodb://127.0.0.1:27017/kuralapp
```

### 3. Run Setup Script

```bash
node server/scripts/setupRBAC.js
```

This will create:
- 1 Super Admin (L0)
- 1 ACIM (L1) for AC 119
- 1 ACI (L2) for AC 119
- 5 Booth Agents
- 5 Sample Booths with assignments

### 4. Start the Application

```bash
# Start backend
cd server
npm start

# Start frontend (in new terminal)
cd ..
npm run dev
```

### 5. Login Credentials

**Super Admin (L0):**
- Email: admin@kuralapp.com
- Password: admin123

**ACIM (L1):**
- Email: acim119@kuralapp.com
- Password: acim123

**ACI (L2):**
- Email: aci119@kuralapp.com
- Password: aci123

**Booth Agents:**
- Phone: 9999999001 to 9999999005
- Password: agent123

---

## 🧪 Testing Guide

### Test User Management (L0)

1. Login as Super Admin
2. Navigate to User Management
3. Create new L1 user with AC assignment
4. Create new L2 user with AC assignment
5. Create new BoothAgent user
6. Verify users appear in list
7. Edit a user
8. Delete a user

### Test Booth Management (L1/L2)

1. Login as ACIM or ACI
2. Navigate to Booth Management
3. Create new booth (should auto-fill AC)
4. Verify booth appears in list
5. Edit booth information
6. Delete booth

### Test Agent Assignment (L1/L2)

1. Login as ACIM or ACI
2. Navigate to Booth Management
3. Click "Assign" on a booth
4. Select an agent from dropdown
5. Check "Set as Primary Agent"
6. Submit assignment
7. Verify agent appears in booth list
8. Unassign agent

### Test AC Access Control

1. Login as ACIM (AC 119)
2. Verify you can only see AC 119 booths
3. Try to create booth in different AC (should fail)
4. Login as ACI (AC 119)
5. Verify same AC restrictions apply

### Test Role Restrictions

1. Login as L2 (ACI)
2. Verify "User Management" menu is hidden
3. Try to access `/l0/users` directly (should redirect)
4. Login as L1 (ACIM)
5. Verify similar restrictions

---

## 🔒 Security Features

### Authentication
- Password hashing with bcrypt (10 rounds)
- Session-based authentication (req.user)
- Protected routes requiring authentication

### Authorization
- Middleware-based role checking
- AC-level access control for L1/L2
- Frontend and backend enforcement

### Input Validation
- Required field validation
- Duplicate email/phone checking
- Role validation
- AC assignment validation

### Data Protection
- Soft deletes (preserves data)
- Password excluded from responses
- AC filtering at database level

### Audit Trail
- `createdBy` field on booths
- Timestamps on all records
- User activity logging (planned)

---

## 📝 Additional Notes

### Best Practices

1. **Always test with different roles** to ensure access control works
2. **Use the setup script** to quickly reset test data
3. **Check backend logs** for error messages
4. **Verify AC filtering** when testing L1/L2 users
5. **Test edge cases** (empty AC, invalid roles, etc.)

### Common Issues

**Issue:** "Authentication required"
**Solution:** Ensure user is logged in and session is active

**Issue:** "Access denied to this AC"
**Solution:** Verify user's assignedAC matches the resource AC

**Issue:** "User with this email already exists"
**Solution:** Use a different email or delete existing user

**Issue:** Booth agents not appearing
**Solution:** Ensure agents have assignedAC matching the booth's AC

### Future Enhancements

- [ ] JWT token authentication
- [ ] Refresh token mechanism
- [ ] Activity logging system
- [ ] Bulk user import
- [ ] Advanced search and filters
- [ ] Real-time notifications
- [ ] Mobile app support

---

## 📞 Support

For issues or questions, refer to:
- Backend middleware: `server/middleware/auth.js`
- RBAC routes: `server/routes/rbac.js`
- User model: `server/models/User.js`
- Booth model: `server/models/Booth.js`

---

**Last Updated:** November 14, 2025
**Version:** 1.0.0
