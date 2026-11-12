#!/usr/bin/env node

/**
 * Creates or updates an Admin user in the PocketBase `users` collection.
 * Credentials come from environment variables or command-line flags, never hard-coded.
 *
 * Usage:
 *   PB_ADMIN_EMAIL=admin@ojlinker.sa PB_ADMIN_PASSWORD=Password123 node backend/scripts/create-admin.mjs
 *   node backend/scripts/create-admin.mjs --email=admin@ojlinker.sa --password=Password123 --name="عمر الحربي"
 */

import PocketBase from "pocketbase";

const args = process.argv.slice(2);
function getArg(name) {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

const pbUrl = process.env.VITE_PB_URL || process.env.PB_URL || "http://127.0.0.1:8090";
const email = getArg("email") || process.env.PB_ADMIN_EMAIL;
const password = getArg("password") || process.env.PB_ADMIN_PASSWORD;
const name = getArg("name") || process.env.PB_ADMIN_NAME || "مدير النظام";

if (!email || !password) {
  console.error("Error: Missing credentials.");
  console.error("Please provide PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env variables or --email and --password flags.");
  process.exit(1);
}

if (password.length < 8) {
  console.error("Error: Password must be at least 8 characters long.");
  process.exit(1);
}

const pb = new PocketBase(pbUrl);

async function main() {
  console.log(`Connecting to PocketBase at ${pbUrl}...`);

  try {
    // Check if user already exists
    const existing = await pb.collection("users").getList(1, 1, {
      filter: pb.filter("email = {:email}", { email }),
    });

    if (existing.items.length > 0) {
      const user = existing.items[0];
      console.log(`User ${email} already exists (id: ${user.id}). Updating role to admin...`);
      await pb.collection("users").update(user.id, {
        role: "admin",
        name,
        password,
        passwordConfirm: password,
      });
      console.log("Admin user updated successfully.");
      return;
    }

    // Create new admin user
    const created = await pb.collection("users").create({
      email,
      name,
      role: "admin",
      password,
      passwordConfirm: password,
      emailVisibility: false,
    });

    console.log(`Admin user created successfully (id: ${created.id}, email: ${created.email}, role: admin).`);
  } catch (err) {
    console.error("Failed to create admin user:", err?.message || err);
    if (err?.data) {
      console.error("Details:", JSON.stringify(err.data, null, 2));
    }
    process.exit(1);
  }
}

main();
