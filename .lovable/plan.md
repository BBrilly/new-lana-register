

## Plan: Remove Dashboard, Make Wallets the Default

The Dashboard page duplicates wallet information already shown on the Wallets page. We'll remove it and redirect all Dashboard references to Wallets.

### Changes

1. **`src/App.tsx`** -- Remove Dashboard import and route. Keep all other routes.

2. **`src/components/Layout.tsx`** -- Remove the Dashboard NavLink from navigation (both desktop and mobile). Remove `LayoutDashboard` icon import.

3. **`src/pages/Login.tsx`** -- Change `navigate("/dashboard")` to `navigate("/wallets")` after successful login.

4. **`src/pages/Dashboard.tsx`** -- Delete this file (no longer needed).

