# Supabase setup

1. Create a Supabase project and open **SQL Editor**.
2. Run [`schema.sql`](./schema.sql) to create pharmacy-scoped inventory, batch, stock-ledger, transaction, and benchmark tables, RLS policies, and the stock mutation functions.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for browser-side Supabase Auth.
4. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` (at least 32 random characters), and `MANAGER_APPROVAL_PASSWORD` only in the Express server environment.
5. Disable public Supabase Auth signups. New users are provisioned through the manager-approved Express endpoint and then sign in normally.

The service-role key bypasses RLS, so it must remain server-side. Express authorizes every request using its signed HttpOnly session cookie and scopes each data query to the signed-in user's pharmacy. The SQL migration drops public inventory policies from the earlier prototype; old records without an owner are not visible to application users.

See the project [README](../README.md) for development and test commands.
