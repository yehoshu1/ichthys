# Dashboard User Guide

The web dashboard is the command center for your server. It allows you to configure all aspects of the bot, from welcome messages to leveling rewards.

## accessing the Dashboard
1.  Navigate to your dashboard URL (e.g., `http://localhost:3000`).
2.  Click **Login with Discord**.
3.  Authorize the application to access your guilds.
4.  Select the server you wish to manage from the list.

---

## 🧩 Modules

### 👋 Welcome System
Greet new members instantly.
- **Templates**: Create multiple message templates. Support for standard text and Rich Embeds.
- **Triggers**: Define rules for *when* to send a message.
    - *Example*: "When a user gets the 'Member' role, send the 'Welcome' template to #general."
- **Placeholders**: Use `{user}`, `{server}`, `{count}` to make messages dynamic.

### 🛡️ Verification
Secure your server from bots and raids.
- **Grace Period**: Set how long (in days) a user has to verify.
- **Auto-Kick**: Automatically remove users who fail to verify within the grace period.
- **Stats**: View pending verifications and kick history.

### 🚀 Boost Management
Reward your server boosters.
- **Announcement**: Send a custom thank-you message to a channel when someone boosts.
- **Role Reward**: Automatically assign a VIP role to boosters.
- **Duration**: Track how long users have maintained their boost.
- **Expiration**: Remove rewards if a user stops boosting (with a configurable grace period).

### ⭐ Leveling
Gamify your community.
- **XP Rates**: Configure how much XP users earn per message or per minute of voice chat.
- **Cooldowns**: Prevent spam by setting XP cooldowns.
- **Rewards**: Automatically assign roles when users reach specific levels (e.g., Level 10 -> "Regular").
- **Leaderboard**: detailed server rankings.

### 🤖 Role Actions
Automate moderation and administrative tasks.
- **Triggers**: "When Role X is ADDED" or "When Role Y is REMOVED".
- **Actions**:
    - **DM**: Send a private message.
    - **Kick**: Kick the user from the server.
    - **Log**: Record the event in the audit log.
- **Delays**: Schedule actions to happen after a set time (e.g., "Remove 'New' role after 24 hours").

### 📊 Analytics
Gain insights into your community.
- **Growth**: Track joins and leaves over time.
- **Activity**: Monitor member retention and verification rates.
- **Exports**: Download raw data (CSV/JSON) for offline analysis.

### ⚙️ Settings
- **Backups**: Export your entire server configuration to a JSON file.
- **Restore**: Import a configuration to apply settings instantly (useful for setting up new servers).
