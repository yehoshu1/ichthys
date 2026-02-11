# Testing Checklist - New Features

## Database Migration

- [ ] Run `npm run db:generate` - generates migration files
- [ ] Run `npm run db:push` - applies migrations
- [ ] Verify new tables exist:
  ```sql
  \dt welcome_config
  \dt reaction_role_message
  ```
- [ ] Verify new enums exist:
  ```sql
  SELECT * FROM pg_type WHERE typname LIKE 'welcome_%';
  SELECT * FROM pg_type WHERE typname LIKE 'role_component_%';
  ```

## Bot Functionality

### Welcome System

- [ ] Join a test server with welcome enabled
- [ ] Verify welcome message sends to channel
- [ ] Verify welcome DM sends (if configured)
- [ ] Test image generation with different backgrounds:
  - [ ] Solid color
  - [ ] Gradient
  - [ ] Image URL
- [ ] Test avatar shapes:
  - [ ] Circle
  - [ ] Square
  - [ ] Rounded
- [ ] Test cooldown functionality
- [ ] Verify permissions check (bot can't send = error log)

### Role Components

- [ ] Create reaction-based role message
- [ ] Create button-based role message
- [ ] Create dropdown-based role message
- [ ] Test role assignment via each component type
- [ ] Test exclusive roles
- [ ] Test TOGGLE mode (add/remove)
- [ ] Test ADD_ONLY mode
- [ ] Test REMOVE_ONLY mode
- [ ] Test UNIQUE mode (removes other roles)

## Dashboard

### Welcome Configuration Page

- [ ] Load welcome config page
- [ ] Toggle enable/disable
- [ ] Change target type (Channel/DM)
- [ ] Select channel from dropdown
- [ ] Edit message template
- [ ] Toggle embed mode
- [ ] Enable image card
- [ ] Change background type
- [ ] Set background value
- [ ] Generate preview image
- [ ] Save configuration
- [ ] Verify changes persist after reload

### Reaction Roles Page

- [ ] Create new role message
- [ ] Select component type (reaction/button/dropdown)
- [ ] Add role entries with emoji/label
- [ ] Set max selections (for dropdowns)
- [ ] Send message to Discord
- [ ] Test role assignment works

## API Endpoints

### Welcome API

```bash
# Get config
curl http://localhost:3000/api/guilds/[GUILD_ID]/welcome/config \
  -H "Cookie: [AUTH_COOKIE]"

# Update config
curl -X POST http://localhost:3000/api/guilds/[GUILD_ID]/welcome/config \
  -H "Content-Type: application/json" \
  -H "Cookie: [AUTH_COOKIE]" \
  -d '{"enabled": true, "targetType": "CHANNEL", "channelId": "..."}'

# Generate preview
curl -X POST http://localhost:3000/api/guilds/[GUILD_ID]/welcome/preview \
  -H "Content-Type: application/json" \
  -H "Cookie: [AUTH_COOKIE]" \
  -d '{"imageEnabled": true, "backgroundType": "COLOR", "backgroundValue": "#7289da"}'
```

## Error Handling

### Welcome System

- [ ] Missing channel ID when target is CHANNEL
- [ ] Invalid background image URL
- [ ] Bot lacks SEND_MESSAGES permission
- [ ] Bot lacks ATTACH_FILES permission
- [ ] Bot lacks MANAGE_ROLES permission (for auto-role)
- [ ] User has DMs disabled

### Role Components

- [ ] Role doesn't exist
- [ ] Bot's role is below target role
- [ ] Bot lacks MANAGE_ROLES permission
- [ ] Message component not found

## Performance Testing

### Welcome Image Generation

- [ ] Generate 10 images sequentially - check timing
- [ ] Generate image with large background URL
- [ ] Verify cooldown prevents spam

### Role Components

- [ ] Click button rapidly - should handle gracefully
- [ ] Select multiple roles in dropdown quickly
- [ ] Verify caching reduces DB queries

## Build Verification

```bash
# Build bot
npm run build

# Type-check dashboard
cd src/dashboard && npx tsc --noEmit

# Verify no TypeScript errors
```

## Security Checks

- [ ] Verify only guild admins can access welcome config
- [ ] Verify only guild admins can create role messages
- [ ] Check rate limiting on API endpoints
- [ ] Verify SQL injection protection in all inputs

## Browser Compatibility

Test dashboard in:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if available)

## Mobile Responsiveness

- [ ] Dashboard welcome page on mobile
- [ ] Dashboard reaction roles page on mobile
- [ ] Preview image displays correctly

## Documentation Review

- [ ] PERFORMANCE_TUNING.md is accurate
- [ ] New environment variables documented
- [ ] API endpoints documented
- [ ] Feature limitations noted

## Rollback Plan

If issues are encountered:
1. [ ] Disable welcome system in database
2. [ ] Remove role component messages
3. [ ] Revert to previous bot version
4. [ ] Rollback database migration if needed

## Sign-off

- [ ] All tests passing
- [ ] No critical bugs
- [ ] Documentation complete
- [ ] Ready for production

---

**Test Date:** ___________  
**Tester:** ___________  
**Status:** ⬜ PASS / ⬜ FAIL
