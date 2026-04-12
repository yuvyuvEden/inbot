# Project Memory

## Core
INBOT - Israeli invoice processing SaaS. Hebrew RTL (dir="rtl", lang="he").
3 roles: admin, accountant, client. Roles in user_roles table, never on profiles.
Lovable Cloud backend. Currency: ILS. VAT support on invoices.
Font: Heebo. Primary #1e3a5f navy, accent #e8941a orange, bg #f0f4f8.

## Memories
- [Design tokens](mem://design/tokens) — Full INBOT color palette, typography, component styling
- [DB schema](mem://features/db-schema) — Tables: user_roles, profiles, invoices with RLS
- [Roles system](mem://features/roles) — app_role enum, has_role() security definer function, auto-assign client on signup
