# Kural Backend - Upgrade Plan

## 1. Current State Analysis

### Server Structure
- **server/index.js**: ~4500+ lines (VERY LARGE - needs splitting)
- **server/routes/rbac.js**: User/Booth management routes (already split)
- **server/models/**: 12 model files (properly organized)
- **server/middleware/auth.js**: Authentication middleware
- **server/utils/voterCollection.js**: Voter sharding utilities

### Current API Routes in index.js (48+ routes)

| Route Group | Endpoints | Lines | Priority |
|-------------|-----------|-------|----------|
| Auth | /api/auth/* (login, logout, me, debug) | 716-1040 | HIGH |
| Surveys | /api/surveys/* (CRUD) | 1041-1284 | HIGH |
| Dashboard | /api/dashboard/stats/:acId | 1285-1413 | MEDIUM |
| Voters | /api/voters/* (CRUD, fields, details) | 1414-1950 | HIGH |
| Families | /api/families/* | 1684-1862 | MEDIUM |
| Survey Responses | /api/survey-responses/* | 1863-2021 | MEDIUM |
| Reports | /api/reports/* | 2022-2125 | LOW |
| Master Data | /api/master-data/* | 2126-2611 | MEDIUM |
| Mobile App Questions | /api/mobile-app-questions/* | 2612-2720 | MEDIUM |
| Mobile App Responses | /api/mobile-app-responses/* | 3291-3330 | MEDIUM |
| Voter Fields | /api/voters/fields/* | 3331-3950 | HIGH |
| Survey Master Data Mappings | /api/survey-master-data-mappings/* | 3951-4143 | LOW |
| Mapped Fields | /api/mapped-fields/* | 4145-4524 | LOW |
| Health | /api/health | 4525 | LOW |

---

## 2. Admin (L0) Features List

### Dashboard (src/pages/l0/Dashboard.tsx)
- [ ] View system-wide statistics
- [ ] Total users count
- [ ] Total surveys count
- [ ] Total voters count
- [ ] Quick actions navigation

### User Management (src/pages/l0/UserManagement.tsx)
- [ ] View all users (L0, L1, L2, BoothAgent)
- [ ] Create new users with roles
- [ ] Edit user details
- [ ] Delete/deactivate users
- [ ] Filter by role tabs
- [ ] Search users
- [ ] Assign AC to L1/L2 users

### Voter Field Manager (src/pages/l0/VoterFieldManager.tsx)
- [ ] View existing voter fields
- [ ] Create custom voter fields
- [ ] Rename fields
- [ ] Toggle field visibility
- [ ] Delete fields
- [ ] Convert all fields

### Master Data (src/pages/l0/MasterData.tsx)
- [ ] Create master data sections
- [ ] Add questions to sections
- [ ] Edit/delete sections
- [ ] Edit/delete questions

### Survey Forms (src/pages/l0/SurveyBank.tsx)
- [ ] View all surveys
- [ ] Create new surveys
- [ ] Edit surveys
- [ ] Delete surveys
- [ ] Form builder functionality

### Survey Responses (src/pages/l0/SurveyResponses.tsx)
- [ ] View all survey responses
- [ ] Filter by AC
- [ ] Export responses

### Mobile App Questions (src/pages/l0/MobileAppQuestions.tsx)
- [ ] Create mobile app questions
- [ ] Edit questions
- [ ] Delete questions
- [ ] Reorder questions

### Mobile App Responses (src/pages/l0/MobileAppResponses.tsx)
- [ ] View mobile app responses
- [ ] Filter responses
- [ ] Export data

### Booth Management (src/pages/shared/BoothManagement.tsx)
- [ ] View all booths across ACs
- [ ] Create booths
- [ ] Edit booth details
- [ ] Assign agents to booths

### Booth Agent Management (src/pages/shared/BoothAgentManagement.tsx)
- [ ] View all booth agents
- [ ] Create booth agents
- [ ] Assign to booths
- [ ] Edit/delete agents

### Activity Logs (src/pages/l0/ActivityLogs.tsx)
- [ ] View system activity logs
- [ ] Filter by user/action
- [ ] Date range filtering

### Settings (src/pages/l0/AppSettings.tsx)
- [ ] Application settings
- [ ] Configuration options

---

## 3. ACI (L2) Features List

### Dashboard (src/pages/l2/Dashboard.tsx)
- [ ] View AC-specific statistics
- [ ] Total families in AC
- [ ] Total members in AC
- [ ] Surveys completed in AC
- [ ] Total booths in AC
- [ ] Quick actions
- [ ] Booth status monitor

### Voter Manager (src/pages/l2/VoterManager.tsx)
- [ ] View voters in assigned AC
- [ ] Search/filter voters
- [ ] Edit voter details
- [ ] View voter by booth

### Family Manager (src/pages/l2/FamilyManager.tsx)
- [ ] View families in assigned AC
- [ ] Manage family records
- [ ] Link voters to families

### Survey Forms (src/pages/l2/SurveyForms.tsx)
- [ ] View available survey forms
- [ ] Access surveys for AC

### Survey Manager (src/pages/l2/SurveyManager.tsx)
- [ ] Complete surveys
- [ ] Review survey responses
- [ ] Filter by booth/family

### Booth Management (src/pages/shared/BoothManagement.tsx)
- [ ] View booths in assigned AC only
- [ ] Create booths
- [ ] Update booth details

### Booth Agent Management (src/pages/shared/BoothAgentManagement.tsx)
- [ ] View agents in assigned AC
- [ ] Create booth agents
- [ ] Assign to booths

### Live Booth Updates (src/pages/l2/LiveBoothUpdates.tsx)
- [ ] Real-time booth status
- [ ] Agent activity monitoring

### Reports (src/pages/l2/Reports.tsx)
- [ ] Booth performance reports
- [ ] Survey completion rates

### Activity Logs (src/pages/l2/ActivityLogs.tsx)
- [ ] View activity logs for AC
- [ ] Filter by action type

---

## 4. Proposed Modular Structure

```
server/
├── index.js                    # Main entry - Express setup, middleware, route mounting (~200 lines)
├── config/
│   ├── database.js             # MongoDB connection
│   ├── session.js              # Session configuration
│   └── cors.js                 # CORS configuration
├── middleware/
│   ├── auth.js                 # Authentication middleware (existing)
│   ├── validation.js           # Request validation middleware
│   └── errorHandler.js         # Global error handling
├── routes/
│   ├── index.js                # Route aggregator
│   ├── auth.routes.js          # /api/auth/*
│   ├── surveys.routes.js       # /api/surveys/*
│   ├── voters.routes.js        # /api/voters/*
│   ├── voterFields.routes.js   # /api/voters/fields/*
│   ├── families.routes.js      # /api/families/*
│   ├── dashboard.routes.js     # /api/dashboard/*
│   ├── reports.routes.js       # /api/reports/*
│   ├── masterData.routes.js    # /api/master-data/*
│   ├── mobileApp.routes.js     # /api/mobile-app-*
│   ├── mappedFields.routes.js  # /api/mapped-fields/*
│   ├── surveyResponses.routes.js # /api/survey-responses/*
│   ├── rbac.js                 # /api/rbac/* (existing)
│   └── health.routes.js        # /api/health
├── controllers/                # (Optional - for complex logic)
│   ├── auth.controller.js
│   ├── surveys.controller.js
│   └── ...
├── services/                   # Business logic layer
│   ├── auth.service.js
│   ├── voter.service.js
│   └── ...
├── models/                     # Mongoose models (existing - no change)
│   ├── User.js
│   ├── Survey.js
│   └── ...
├── utils/
│   ├── voterCollection.js      # (existing)
│   ├── helpers.js              # Shared helper functions
│   └── constants.js            # Role mapping, AC IDs, etc.
└── scripts/                    # Utility scripts (existing)
```

---

## 5. Implementation Plan (Step-by-Step)

### Phase 1: Preparation
1. Create backup of current index.js
2. Set up new folder structure
3. Create shared utilities file (constants, helpers)

### Phase 2: Extract Core Configuration
1. Extract database config to `config/database.js`
2. Extract session config to `config/session.js`
3. Extract CORS config to `config/cors.js`

### Phase 3: Extract Routes (One at a time)
1. **auth.routes.js** - Authentication routes
2. **surveys.routes.js** - Survey CRUD
3. **voters.routes.js** - Voter management
4. **voterFields.routes.js** - Voter field management
5. **families.routes.js** - Family management
6. **dashboard.routes.js** - Dashboard stats
7. **masterData.routes.js** - Master data management
8. **mobileApp.routes.js** - Mobile app questions/responses
9. **reports.routes.js** - Reports
10. **surveyResponses.routes.js** - Survey responses
11. **mappedFields.routes.js** - Mapped fields
12. **health.routes.js** - Health check

### Phase 4: Create Route Aggregator
1. Create `routes/index.js` to mount all routes
2. Update main `index.js` to use route aggregator

### Phase 5: Testing
1. Test each feature after extraction
2. Run full end-to-end tests
3. Verify Admin (L0) features
4. Verify ACI (L2) features

### Phase 6: Documentation
1. Update README
2. Document API endpoints
3. Update CLAUDE.md

---

## 6. Risk Mitigation

1. **Backup**: Keep original index.js as index.js.backup
2. **Incremental**: Extract one route file at a time
3. **Test After Each Change**: Don't batch changes
4. **Git Commits**: Commit after each successful extraction
5. **Rollback Plan**: Easy to revert if issues arise

---

## 7. Expected Benefits

1. **Maintainability**: Each route file is focused and manageable
2. **Readability**: Easier to find and understand code
3. **Scalability**: Easy to add new routes
4. **Testing**: Can unit test individual route files
5. **Collaboration**: Multiple developers can work on different routes
6. **Debugging**: Easier to locate issues
7. **Code Reuse**: Shared utilities and middleware

---

## 8. Feature Verification Checklist

### Admin (L0) - To Verify
- [ ] Login/Logout
- [ ] Dashboard loads
- [ ] User Management - List users
- [ ] User Management - Create user
- [ ] User Management - Edit user
- [ ] User Management - Delete user
- [ ] Voter Field Manager - List fields
- [ ] Voter Field Manager - Create field
- [ ] Master Data - List sections
- [ ] Master Data - Create section
- [ ] Survey Forms - List surveys
- [ ] Survey Forms - Create survey
- [ ] Survey Responses - List responses
- [ ] Mobile App Questions - List
- [ ] Mobile App Questions - Create
- [ ] Mobile App Responses - List
- [ ] Booth Management - List booths
- [ ] Booth Management - Create booth
- [ ] Booth Agent Management - List agents
- [ ] Booth Agent Management - Create agent
- [ ] Activity Logs - View logs
- [ ] Settings - View settings

### ACI (L2) - To Verify
- [ ] Login/Logout
- [ ] Dashboard loads with AC data
- [ ] Dashboard shows correct AC (assigned only)
- [ ] Voter Manager - List voters
- [ ] Voter Manager - Edit voter
- [ ] Family Manager - List families
- [ ] Survey Forms - View forms
- [ ] Survey Manager - Complete surveys
- [ ] Booth Management - List booths (AC only)
- [ ] Booth Management - Create booth
- [ ] Booth Agent Management - List agents (AC only)
- [ ] Booth Agent Management - Create agent
- [ ] Live Booth Updates - View updates
- [ ] Reports - View reports
- [ ] Activity Logs - View logs

---

## Next Steps

1. Review and approve this plan
2. Start Phase 1: Preparation
3. Execute incrementally with testing
