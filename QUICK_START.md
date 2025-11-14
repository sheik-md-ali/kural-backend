# 🚀 RBAC System - Quick Start Guide

## ✅ System Status: FULLY IMPLEMENTED

Your Role-Based Access Control system is now complete and ready to use!

---

## 📦 What's Been Built

### Backend Components ✅
- ✅ `server/models/Booth.js` - Booth database model with agent assignment
- ✅ `server/middleware/auth.js` - Authentication & authorization middleware
- ✅ `server/routes/rbac.js` - Complete RBAC API routes
- ✅ `server/scripts/setupRBAC.js` - Automated setup script
- ✅ `server/index.js` - Updated with RBAC route integration

### Frontend Components ✅
- ✅ `src/pages/l0/UserManagement.tsx` - Super Admin user management
- ✅ `src/pages/shared/BoothAgentManagement.tsx` - Booth & agent management
- ✅ `src/components/DashboardLayout.tsx` - Updated with RBAC navigation
- ✅ `src/App.tsx` - Updated with RBAC routes

### Documentation ✅
- ✅ `RBAC_IMPLEMENTATION_GUIDE.md` - Complete implementation guide
- ✅ `QUICK_START.md` - This file!

---

## 🎯 User Roles

| Role | Code | Description | Capabilities |
|------|------|-------------|--------------|
| **Super Admin** | L0 | System administrator | Full access - manage all users, booths, agents |
| **ACIM** | L1 | Assembly Constituency Manager | Manage booths & agents within assigned AC |
| **ACI** | L2 | Assembly Constituency In-charge | Manage booths & agents within assigned AC |
| **Booth Agent** | BoothAgent | Field agent | View assigned booths, submit surveys |

---

## 🏃 Quick Start (3 Steps)

### Step 1: Setup Database

```powershell
# Navigate to server directory
cd server

# Run the setup script
node scripts/setupRBAC.js
```

This creates:
- 1 Super Admin (L0)
- 1 ACIM (L1) for AC 119 - Thondamuthur
- 1 ACI (L2) for AC 119 - Thondamuthur
- 5 Booth Agents
- 5 Sample Booths with agent assignments

### Step 2: Start Backend

```powershell
# In server directory
npm start
```

Server will start on: http://localhost:4000

### Step 3: Start Frontend

```powershell
# In root directory (new terminal)
npm run dev
```

Frontend will start on: http://localhost:5173

---

## 🔑 Test Credentials

### Super Admin (L0) - Full Access
```
Email: admin@kuralapp.com
Password: admin123
```

**Can do:**
- Create/manage all user types
- Manage booths across all ACs
- Assign agents to any booth
- View system-wide statistics

### ACIM (L1) - Thondamuthur
```
Email: acim119@kuralapp.com
Password: acim123
```

**Can do:**
- Manage booths in AC 119 only
- Manage agents in AC 119 only
- Assign agents to AC 119 booths
- View AC 119 statistics

### ACI (L2) - Thondamuthur
```
Email: aci119@kuralapp.com
Password: aci123
```

**Can do:**
- Manage booths in AC 119 only
- Manage agents in AC 119 only
- Assign agents to AC 119 booths
- View AC 119 statistics

### Booth Agents
```
Phone: 9999999001, 9999999002, 9999999003, 9999999004, 9999999005
Password: agent123 (for all)
```

**Can do:**
- View assigned booths
- Submit survey data
- Update voter information

---

## 🧪 Quick Test Scenarios

### Test 1: User Management (L0)
1. ✅ Login as Super Admin
2. ✅ Go to **User Management**
3. ✅ Click **Add User**
4. ✅ Create new ACI user:
   - Name: Test ACI
   - Role: ACI
   - Assigned AC: 119
   - Password: test123
5. ✅ Verify user appears in list
6. ✅ Edit the user
7. ✅ Delete the user

### Test 2: Booth Management (L1)
1. ✅ Login as ACIM (acim119@kuralapp.com)
2. ✅ Go to **Booth Management**
3. ✅ Verify only AC 119 booths are shown
4. ✅ Click **Add Booth**
5. ✅ Create new booth:
   - Booth Number: 110
   - Booth Name: Test Booth
   - AC ID: 119 (pre-filled)
   - Total Voters: 1500
6. ✅ Verify booth appears in list

### Test 3: Agent Assignment (L2)
1. ✅ Login as ACI (aci119@kuralapp.com)
2. ✅ Go to **Booth & Agent Management**
3. ✅ Click **Assign** on any booth
4. ✅ Select an agent
5. ✅ Check **Set as Primary Agent**
6. ✅ Click **Assign Agent**
7. ✅ Verify agent appears in booth's agent list
8. ✅ Click trash icon to unassign

### Test 4: Access Control
1. ✅ Login as ACI (L2)
2. ✅ Verify **User Management** menu is NOT visible
3. ✅ Try to access `/l0/users` directly
4. ✅ Verify you're redirected (unauthorized)
5. ✅ Verify you can only see AC 119 data

---

## 📋 API Endpoints Reference

Base URL: `http://localhost:4000/api/rbac`

### User Management (L0 only)
- `GET /users` - List users
- `POST /users` - Create user
- `PUT /users/:userId` - Update user
- `DELETE /users/:userId` - Delete user

### Booth Management (L0, L1, L2)
- `GET /booths` - List booths (AC-filtered)
- `POST /booths` - Create booth
- `PUT /booths/:boothId` - Update booth
- `DELETE /booths/:boothId` - Delete booth

### Agent Management (L0, L1, L2)
- `GET /booth-agents` - List agents (AC-filtered)
- `POST /booth-agents/:boothId/assign` - Assign agent
- `DELETE /booth-agents/:boothId/unassign/:agentId` - Unassign agent

### Dashboard
- `GET /dashboard/stats` - Get statistics (role-based)

---

## 🎨 Features Implemented

### ✅ User Management (L0)
- Create ACIM, ACI, and Booth Agent users
- Edit user information
- Delete users (soft delete)
- Filter by role and AC
- Search by name, email, phone
- Password hashing with bcrypt
- Duplicate prevention

### ✅ Booth Management (L0, L1, L2)
- Create booths with AC assignment
- Edit booth information
- Delete booths (soft delete)
- Auto-generate booth codes
- AC-based filtering (automatic for L1/L2)
- Search functionality
- Voter count tracking

### ✅ Agent Management (L0, L1, L2)
- List all booth agents
- Filter by assignment status
- Assign agents to booths
- Set primary agent
- Assign multiple agents to one booth
- Unassign agents
- AC-based filtering

### ✅ Access Control
- Role-based route protection
- AC-level data isolation
- Middleware enforcement
- Frontend menu hiding
- Backend API restrictions
- Session-based authentication

### ✅ Dashboard Statistics
- System-wide stats for L0
- AC-specific stats for L1/L2
- Agent assignment metrics
- Booth counts
- User counts (L0 only)

---

## 🔧 Common Commands

### Reset Database
```powershell
node server/scripts/setupRBAC.js
```

### Start Development
```powershell
# Terminal 1 - Backend
cd server
npm start

# Terminal 2 - Frontend
npm run dev
```

### Check Logs
```powershell
# Backend logs appear in terminal where npm start was run
# Frontend logs appear in browser console (F12)
```

---

## 🐛 Troubleshooting

### Issue: "Authentication required"
**Solution:** Login first. Session may have expired.

### Issue: "Access denied to this AC"
**Solution:** You're trying to access data outside your assigned AC.

### Issue: Booth agents not showing
**Solution:** Ensure agents have `assignedAC` matching the booth's AC.

### Issue: Can't create user
**Solution:** Only L0 (Super Admin) can create users.

### Issue: Setup script fails
**Solution:** Ensure MongoDB is running and connection string is correct in `.env`

---

## 📱 Navigation Menus

### L0 Menu
- System Dashboard
- **User Management** 👈 NEW!
- Admin Management
- Voter Data
- Survey Forms
- Booth Management
- Booth Agent Management
- Activity Logs
- App Settings

### L1 Menu
- Constituencies
- Analytics Dashboard
- AC Analytics Dashboard
- AC Comparison
- Advanced Analytics
- Survey Forms
- Survey Form Assignments
- Moderator Management
- **Booth Management** 👈 RBAC-enabled!
- Booth Agent Management
- Live Survey Monitor
- Activity Logs

### L2 Menu
- My Dashboard
- Voter Manager
- Family Manager
- Survey Forms
- Survey Manager
- **Booth & Agent Management** 👈 RBAC-enabled!
- Live Booth Updates
- Activity Logs

---

## 🎯 Success Checklist

Before deploying to production, verify:

- [ ] All test credentials work
- [ ] Super Admin can create users
- [ ] L1 users see only their AC data
- [ ] L2 users see only their AC data
- [ ] Agents can be assigned to booths
- [ ] Primary agent designation works
- [ ] Unassigning agents works
- [ ] Soft deletes work (data preserved)
- [ ] Search and filters work
- [ ] Role-based menus are correct
- [ ] Unauthorized routes redirect
- [ ] Password hashing works
- [ ] Duplicate prevention works

---

## 📚 Next Steps

1. **Test thoroughly** with all roles
2. **Customize ACs** - Add your actual Assembly Constituencies
3. **Add more users** - Create real ACIM and ACI accounts
4. **Import data** - Bulk import booths and agents
5. **Configure production** - Set up production MongoDB
6. **Enable HTTPS** - Secure your production deployment
7. **Set up monitoring** - Add logging and error tracking
8. **Train users** - Provide documentation to your team

---

## 📖 Additional Documentation

- **Full Implementation Guide:** `RBAC_IMPLEMENTATION_GUIDE.md`
- **API Documentation:** See "API Endpoints" section in implementation guide
- **Database Schema:** See "Database Schema" section in implementation guide
- **Security Features:** See "Security Features" section in implementation guide

---

## 🎉 You're All Set!

Your RBAC system is fully functional. Start by running the setup script, then test with the provided credentials.

**Happy managing! 🚀**

---

**Questions?** Check the full implementation guide or review:
- `server/middleware/auth.js` - Authentication logic
- `server/routes/rbac.js` - API implementations
- `src/pages/l0/UserManagement.tsx` - User management UI
- `src/pages/shared/BoothAgentManagement.tsx` - Booth & agent UI
