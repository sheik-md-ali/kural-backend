# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Election Campaign Management System** for managing Assembly Constituencies (AC) in Tamil Nadu, India. It's a full-stack application with:
- **Frontend**: React 18.3 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + MongoDB (with Mongoose)
- **Architecture**: Monorepo with client in `src/` and server in `server/`

The system manages 21 Assembly Constituencies (AC 101-126, excluding 103-107) with comprehensive voter, family, booth, and survey management.

## Common Development Commands

### Development
```bash
# Start backend server (runs on port 4000)
node server/index.js

# Start frontend dev server (runs on port 8080)
npm run dev

# Both are typically run in separate terminals
```

### Building
```bash
# Production build
npm run build

# Development build
npm run build:dev

# Preview production build
npm run preview
```

### Code Quality
```bash
# Lint code
npm run lint
```

### Database Setup
```bash
# Setup RBAC system with test users and data
node server/scripts/setupRBAC.js

# Seed admin user
node server/scripts/seedAdmin.js
```

### Deployment
```bash
# Deploy using PM2 (requires PM2_PROCESS_NAME env var)
./deploy.sh
```

## Architecture Overview

### Role-Based Access Control (RBAC)

The system implements a 4-tier role hierarchy:

1. **L0 (Super Admin)**: System-wide access, manages all users, booths, agents across all ACs
2. **L1 (ACIM - AC In-charge Manager)**: Manages specific AC(s), can manage booths and agents within assigned AC(s)
3. **L2 (ACI - AC In-charge)**: Similar to L1 but with operational focus on assigned AC
4. **BoothAgent**: Field agents assigned to specific booths, can submit surveys

**Critical**: L1 and L2 users have an `assignedAC` field that restricts their data access to only that AC. All database queries and API endpoints for these roles MUST filter by AC.

### Backend Structure

```
server/
├── index.js                 # Main Express server (3000+ lines)
├── models/                  # Mongoose models
│   ├── User.js             # User authentication & roles
│   ├── Voter.js            # Voter information
│   ├── Booth.js            # Booth data with agent assignments
│   ├── Survey.js           # Survey responses
│   ├── VoterField.js       # Custom voter fields
│   ├── MasterDataSection.js
│   └── SurveyMasterDataMapping.js
├── routes/
│   └── rbac.js             # RBAC-specific routes
├── middleware/
│   └── auth.js             # Authentication & authorization middleware
├── scripts/                # Utility scripts for DB operations
└── utils/                  # Helper utilities
```

### Frontend Structure

```
src/
├── pages/                  # Route-based pages
│   ├── l0/                # L0 Super Admin pages
│   ├── l1/                # L1 ACIM pages
│   ├── l2/                # L2 ACI pages
│   └── shared/            # Shared pages across roles
├── components/
│   ├── ui/                # shadcn/ui base components
│   ├── DashboardLayout.tsx # Main layout with role-based navigation
│   ├── StatCard.tsx
│   └── ActionButton.tsx
├── contexts/
│   ├── AuthContext.tsx    # Authentication state
│   ├── NotificationContext.tsx
│   └── ActivityLogContext.tsx
├── constants/
│   └── constituencies.ts  # AC definitions (101-126)
└── App.tsx                # Routes with role-based protection
```

### Key Architectural Patterns

1. **AC-Based Data Isolation**: All data is scoped by Assembly Constituency (acId field). Queries for L1/L2 users automatically filter by their assignedAC.

2. **Session-Based Authentication**: Uses express-session with MongoDB store (connect-mongo). Sessions are stored in MongoDB and cookies are sent to frontend.

3. **Proxy Architecture**: Vite dev server (port 8080) proxies `/api/*` requests to Express backend (port 4000). In production, both are served from same domain.

4. **Soft Deletes**: Most models use `deleted: Boolean` flag instead of hard deletes for audit trail.

5. **Master Data System**: Survey forms can map to master data sections (like "Caste", "Education") to standardize responses across surveys.

## Database Schema Key Points

### User Model
- `role`: 'L0' | 'L1' | 'L2' | 'BoothAgent'
- `assignedAC`: Number (required for L1, L2, BoothAgent)
- `password`: bcrypt hashed
- `deleted`: Boolean for soft delete

### Voter Model
- `acId`: Number (Assembly Constituency)
- `familyId`: ObjectId reference
- `boothNumber`: String
- `voterIdNumber`: String (unique)
- Supports custom fields via VoterField model

### Booth Model
- `acId`: Number
- `boothNumber`: String
- `assignedAgents`: Array of ObjectIds (User references)
- `primaryAgent`: ObjectId (one designated primary)

### Survey Model
- `acId`: Number
- `familyId`: ObjectId
- `formId`: ObjectId
- `responses`: Mixed (flexible JSON structure)
- `completedBy`: ObjectId (User who submitted)

## Important Implementation Details

### Authentication Flow
1. Login via POST `/api/login` creates session
2. Session ID stored in MongoDB via connect-mongo
3. Cookie with session ID sent to frontend
4. Middleware `isAuthenticated` validates session on protected routes
5. Middleware `hasRole(['L0', 'L1'])` enforces role requirements
6. Middleware `validateACAccess` ensures L1/L2 only access their AC

### API Endpoint Pattern
```javascript
// Example: AC-scoped query for L1/L2 users
router.get('/voters/:acId', isAuthenticated, async (req, res) => {
  const { acId } = req.params;
  const user = req.session.user;

  // L1/L2 can only access their assigned AC
  if (['L1', 'L2'].includes(user.role) && user.assignedAC !== Number(acId)) {
    return res.status(403).json({ message: 'Access denied to this AC' });
  }

  const voters = await Voter.find({ acId: Number(acId), deleted: false });
  res.json(voters);
});
```

### Frontend Route Protection
```typescript
<Route
  path="/l0/dashboard"
  element={
    <ProtectedRoute allowedRoles={['L0']}>
      <L0Dashboard />
    </ProtectedRoute>
  }
/>
```

### Environment Configuration

Backend `.env` (in `server/` directory or root):
```
PORT=4000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:8080,http://localhost:5173
MONGODB_URI=mongodb://username:password@host:port/kuralapp?authSource=admin
SESSION_COOKIE_DOMAIN=
SESSION_COOKIE_SAMESITE=lax
```

Frontend `.env` (optional, uses Vite proxy by default):
```
VITE_DEV_API_PROXY_TARGET=http://localhost:4000
VITE_DEV_SERVER_PORT=8080
```

## Data Relationships

### Family → Voters → Survey Responses
- Families contain multiple Voters
- Surveys are submitted per Family (but can reference individual voters in responses)
- Each Voter belongs to one AC and one Booth

### Booth → Agents
- Booths can have multiple assigned agents
- One agent can be designated as primaryAgent
- Agents (role: BoothAgent) are scoped to specific AC via assignedAC

### Survey Forms → Master Data
- Survey forms define questions
- Questions can map to MasterDataSections (dropdowns with standardized options)
- MappedField model tracks which form fields map to master data
- This ensures consistent data entry (e.g., all "Caste" fields use same options)

## Testing

### Test Credentials (from setupRBAC.js)
```
Super Admin (L0):
  Email: admin@kuralapp.com
  Password: admin123

ACIM (L1) - AC 119:
  Email: acim119@kuralapp.com
  Password: acim123

ACI (L2) - AC 119:
  Email: aci119@kuralapp.com
  Password: aci123

Booth Agents:
  Phone: 9999999001-9999999005
  Password: agent123
```

### Running Tests
- Backend has utility scripts in `server/scripts/` for testing specific features
- Frontend tests: No test suite currently configured
- Manual testing: Use the test credentials above

## Common Pitfalls & Conventions

1. **AC Filtering**: ALWAYS filter by acId for L1/L2 users. Check user.assignedAC before allowing data access.

2. **Soft Deletes**: Use `deleted: false` in queries. Never hard delete records.

3. **Path Aliases**: Use `@/` prefix for imports (maps to `src/`):
   ```typescript
   import { Button } from "@/components/ui/button"
   ```

4. **Session Handling**: Backend session is stored in MongoDB. If MongoDB connection fails, sessions won't work.

5. **CORS**: Backend explicitly allows origins from CLIENT_ORIGIN env var. Add frontend URLs there.

6. **ObjectId vs String**: MongoDB _id is ObjectId, acId/boothNumber are Numbers/Strings. Don't mix.

7. **Vite Proxy**: In development, frontend proxies /api to backend. Direct backend calls use http://localhost:4000/api, but frontend should use relative /api URLs.

## Common Maintenance Tasks

### Adding a New User Role
1. Update User model role enum
2. Add to hasRole middleware checks
3. Create role-specific routes in App.tsx
4. Add navigation menu in DashboardLayout.tsx
5. Update AuthContext types

### Adding a New Survey Field Type
1. Update Survey model responses schema validation
2. Update frontend FormBuilder component
3. Optionally map to MasterDataSection if standardized

### Adding a New AC
1. Update CONSTITUENCIES array in `src/constants/constituencies.ts`
2. Add test data in setupRBAC.js if needed
3. No backend changes needed (AC is just a number)

### Modifying Voter Schema
1. Update Voter model in `server/models/Voter.js`
2. Update frontend voter management pages
3. Run migration script if changing existing data
4. Consider if field should be in VoterField (custom fields) instead

## Production Deployment Notes

- Build output goes to `dist/`
- Backend expects MongoDB connection (no fallback)
- PM2 process name defaults to "kuralapp-website"
- Deploy script (`deploy.sh`) pulls from git, builds, and restarts PM2
- Set NODE_ENV=production for production builds
- Session cookies use sameSite='none' in production (requires HTTPS)

## Additional Documentation

For detailed implementation guides, see:
- `QUICK_START.md` - Quick setup guide with test scenarios
- `RBAC_IMPLEMENTATION_GUIDE.md` - Complete RBAC documentation
- `TECHNICAL_DOCUMENTATION.md` - Frontend architecture deep dive
- `SERVER_MANAGEMENT.md` - Server troubleshooting guide
